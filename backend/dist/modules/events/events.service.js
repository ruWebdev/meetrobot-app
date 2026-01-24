"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EventsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const event_reminder_scheduler_1 = require("../../infra/queue/event-reminder.scheduler");
const telegram_notification_service_1 = require("../telegram/telegram-notification.service");
const workspace_service_1 = require("../workspace/workspace.service");
let EventsService = EventsService_1 = class EventsService {
    prisma;
    telegramNotificationService;
    eventReminderScheduler;
    workspaceService;
    logger = new common_1.Logger(EventsService_1.name);
    participantRoleOrganizer = 'organizer';
    participantRoleParticipant = 'participant';
    statusConfirmed = 'confirmed';
    statusInvited = 'invited';
    constructor(prisma, telegramNotificationService, eventReminderScheduler, workspaceService) {
        this.prisma = prisma;
        this.telegramNotificationService = telegramNotificationService;
        this.eventReminderScheduler = eventReminderScheduler;
        this.workspaceService = workspaceService;
    }
    async createEvent(params) {
        const { userId, dto } = params;
        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId: dto.workspaceId,
        });
        if (!membership) {
            throw new common_1.ForbiddenException('Вы не состоите в этом рабочем пространстве');
        }
        const title = (dto.title ?? '').trim();
        if (!title) {
            throw new common_1.BadRequestException('Название события обязательно');
        }
        const startAt = new Date(dto.startAt);
        const endAt = new Date(dto.endAt);
        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
            throw new common_1.BadRequestException('Некорректный формат даты/времени');
        }
        if (endAt <= startAt) {
            throw new common_1.BadRequestException('Время окончания должно быть позже времени начала');
        }
        const created = await this.prisma.$transaction(async (tx) => {
            const event = await tx.event.create({
                data: {
                    workspaceId: dto.workspaceId,
                    title,
                    description: dto.description?.trim() ? dto.description.trim() : null,
                    startAt,
                    endAt,
                    status: 'draft',
                    createdById: userId,
                },
            });
            await tx.eventParticipant.create({
                data: {
                    eventId: event.id,
                    userId,
                    role: this.participantRoleOrganizer,
                    participationStatus: this.statusConfirmed,
                    invitedAt: new Date(),
                    respondedAt: new Date(),
                },
            });
            return event;
        });
        return created;
    }
    async inviteParticipants(params) {
        const { userId, eventId, participantIds } = params;
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                workspaceId: true,
                status: true,
                startAt: true,
                endAt: true,
            },
        });
        if (!event) {
            throw new common_1.NotFoundException('Событие не найдено');
        }
        if (event.status !== 'draft') {
            throw new common_1.BadRequestException('Приглашения можно отправлять только в статусе draft');
        }
        const organizer = await this.prisma.eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId: event.id,
                    userId,
                },
            },
            select: { role: true },
        });
        if (!organizer || organizer.role !== this.participantRoleOrganizer) {
            throw new common_1.ForbiddenException('Только организатор может приглашать участников');
        }
        const uniqueIds = Array.from(new Set((participantIds ?? []).filter(Boolean)));
        if (uniqueIds.length === 0) {
            throw new common_1.BadRequestException('Список участников не может быть пустым');
        }
        const workspaceMembers = await this.prisma.workspaceMember.findMany({
            where: {
                workspaceId: event.workspaceId,
                userId: { in: uniqueIds },
            },
            select: { userId: true },
        });
        if (workspaceMembers.length === 0) {
            throw new common_1.BadRequestException('Выбранные пользователи не состоят в рабочем пространстве');
        }
        const allowedIds = workspaceMembers.map((m) => m.userId);
        const existing = await this.prisma.eventParticipant.findMany({
            where: {
                eventId: event.id,
                userId: { in: allowedIds },
            },
            select: { userId: true },
        });
        const existingIds = new Set(existing.map((p) => p.userId));
        const newIds = allowedIds.filter((id) => !existingIds.has(id));
        await this.prisma.$transaction(async (tx) => {
            if (newIds.length > 0) {
                await tx.eventParticipant.createMany({
                    data: newIds.map((id) => ({
                        eventId: event.id,
                        userId: id,
                        role: this.participantRoleParticipant,
                        participationStatus: this.statusInvited,
                        invitedAt: new Date(),
                    })),
                });
            }
            await tx.event.update({
                where: { id: event.id },
                data: { status: 'scheduled' },
            });
        });
        try {
            await this.telegramNotificationService.sendEventInvitations(event.id, newIds);
        }
        catch (error) {
            this.logger.warn(`[Telegram] Failed to send invitations for event ${event.id}`, error);
        }
        try {
            await this.eventReminderScheduler.scheduleReminderForEvent({
                eventId: event.id,
                startAt: event.startAt,
            });
        }
        catch (error) {
            this.logger.warn(`[Reminder] Failed to schedule reminder for event ${event.id}`, error);
        }
        try {
            await this.eventReminderScheduler.scheduleCompletionForEvent({
                eventId: event.id,
                endAt: event.endAt,
            });
        }
        catch (error) {
            this.logger.warn(`[Reminder] Failed to schedule completion for event ${event.id}`, error);
        }
        return { invited: newIds.length, status: 'scheduled' };
    }
    async respondToEvent(params) {
        const { userId, eventId, status } = params;
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, startAt: true },
        });
        if (!event) {
            throw new common_1.NotFoundException('Событие не найдено');
        }
        const eventStartAt = new Date(event.startAt);
        if (eventStartAt <= new Date()) {
            throw new common_1.ForbiddenException('Нельзя изменить участие после начала события');
        }
        const participant = await this.prisma.eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId: event.id,
                    userId,
                },
            },
        });
        if (!participant) {
            throw new common_1.ForbiddenException('Вы не приглашены на событие');
        }
        const updated = await this.prisma.eventParticipant.update({
            where: { id: participant.id },
            data: {
                participationStatus: status,
                respondedAt: new Date(),
            },
        });
        try {
            await this.telegramNotificationService.sendParticipationStatusChanged(event.id, userId);
        }
        catch (error) {
            this.logger.warn(`[Telegram] Failed to notify organizer for event ${event.id}`, error);
        }
        return updated;
    }
    async cancelEvent(params) {
        const { userId, eventId } = params;
        const organizer = await this.prisma.eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId,
                },
            },
            select: { role: true },
        });
        if (!organizer || organizer.role !== this.participantRoleOrganizer) {
            throw new common_1.ForbiddenException('Только организатор может отменить событие');
        }
        const updated = await this.prisma.event.update({
            where: { id: eventId },
            data: { status: 'cancelled' },
        });
        try {
            await this.eventReminderScheduler.removeScheduledJobs(eventId);
        }
        catch (error) {
            this.logger.warn(`[Reminder] Failed to remove scheduled jobs for event ${eventId}`, error);
        }
        try {
            await this.telegramNotificationService.sendEventCancelled(eventId);
        }
        catch (error) {
            this.logger.warn(`[Telegram] Failed to send cancel notification ${eventId}`, error);
        }
        return updated;
    }
    async getEventDetails(params) {
        const { userId, eventId } = params;
        const participant = await this.prisma.eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId,
                },
            },
            select: { id: true },
        });
        if (!participant) {
            throw new common_1.ForbiddenException('Нет доступа к событию');
        }
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                workspaceId: true,
                title: true,
                description: true,
                startAt: true,
                endAt: true,
                status: true,
                createdById: true,
                createdAt: true,
                participants: {
                    select: {
                        userId: true,
                        role: true,
                        participationStatus: true,
                        invitedAt: true,
                        respondedAt: true,
                        user: { select: { firstName: true, lastName: true, username: true } },
                    },
                    orderBy: [{ role: 'asc' }, { invitedAt: 'asc' }],
                },
            },
        });
        if (!event) {
            throw new common_1.NotFoundException('Событие не найдено');
        }
        return event;
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = EventsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        telegram_notification_service_1.TelegramNotificationService,
        event_reminder_scheduler_1.EventReminderScheduler,
        workspace_service_1.WorkspaceService])
], EventsService);
