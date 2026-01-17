import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventReminderScheduler } from '../../infra/queue/event-reminder.scheduler';
import { TelegramNotificationService } from '../../telegram/telegram-notification.service';
import { CreateEventDto } from './dto/create-event.dto';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class EventsService {
    private readonly logger = new Logger(EventsService.name);
    private readonly participantRoleOrganizer = 'organizer' as const;
    private readonly participantRoleParticipant = 'participant' as const;
    private readonly statusConfirmed = 'confirmed' as const;
    private readonly statusInvited = 'invited' as const;

    constructor(
        private prisma: PrismaService,
        private telegramNotificationService: TelegramNotificationService,
        private eventReminderScheduler: EventReminderScheduler,
        private workspaceService: WorkspaceService,
    ) { }
    async createEvent(params: { userId: string; dto: CreateEventDto }) {
        const { userId, dto } = params;

        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId: dto.workspaceId,
        });

        if (!membership) {
            throw new ForbiddenException('Вы не состоите в этом рабочем пространстве');
        }

        const title = (dto.title ?? '').trim();
        if (!title) {
            throw new BadRequestException('Название события обязательно');
        }

        const startAt = new Date(dto.startAt);
        const endAt = new Date(dto.endAt);
        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
            throw new BadRequestException('Некорректный формат даты/времени');
        }

        if (endAt <= startAt) {
            throw new BadRequestException('Время окончания должно быть позже времени начала');
        }

        const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const event = await (tx as any).event.create({
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

            await (tx as any).eventParticipant.create({
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

    async inviteParticipants(params: { userId: string; eventId: string; participantIds: string[] }) {
        const { userId, eventId, participantIds } = params;

        const event = await (this.prisma as any).event.findUnique({
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
            throw new NotFoundException('Событие не найдено');
        }

        if (event.status !== 'draft') {
            throw new BadRequestException('Приглашения можно отправлять только в статусе draft');
        }

        const organizer = await (this.prisma as any).eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId: event.id,
                    userId,
                },
            },
            select: { role: true },
        });

        if (!organizer || organizer.role !== this.participantRoleOrganizer) {
            throw new ForbiddenException('Только организатор может приглашать участников');
        }

        const uniqueIds = Array.from(new Set((participantIds ?? []).filter(Boolean)));
        if (uniqueIds.length === 0) {
            throw new BadRequestException('Список участников не может быть пустым');
        }

        const workspaceMembers = await this.prisma.workspaceMember.findMany({
            where: {
                workspaceId: event.workspaceId,
                userId: { in: uniqueIds },
            },
            select: { userId: true },
        });

        if (workspaceMembers.length === 0) {
            throw new BadRequestException('Выбранные пользователи не состоят в рабочем пространстве');
        }

        const allowedIds = workspaceMembers.map((m) => m.userId);
        const existing = await (this.prisma as any).eventParticipant.findMany({
            where: {
                eventId: event.id,
                userId: { in: allowedIds },
            },
            select: { userId: true },
        });

        const existingIds = new Set(existing.map((p: { userId: string }) => p.userId));
        const newIds = allowedIds.filter((id) => !existingIds.has(id));

        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            if (newIds.length > 0) {
                await (tx as any).eventParticipant.createMany({
                    data: newIds.map((id) => ({
                        eventId: event.id,
                        userId: id,
                        role: this.participantRoleParticipant,
                        participationStatus: this.statusInvited,
                        invitedAt: new Date(),
                    })),
                });
            }

            await (tx as any).event.update({
                where: { id: event.id },
                data: { status: 'scheduled' },
            });
        });

        try {
            await this.telegramNotificationService.sendEventInvitations(event.id, newIds);
        } catch (error) {
            this.logger.warn(`[Telegram] Failed to send invitations for event ${event.id}`, error as any);
        }

        try {
            await this.eventReminderScheduler.scheduleReminderForEvent({
                eventId: event.id,
                startAt: (event as any).startAt,
            });
        } catch (error) {
            this.logger.warn(`[Reminder] Failed to schedule reminder for event ${event.id}`, error as any);
        }

        try {
            await this.eventReminderScheduler.scheduleCompletionForEvent({
                eventId: event.id,
                endAt: (event as any).endAt,
            });
        } catch (error) {
            this.logger.warn(`[Reminder] Failed to schedule completion for event ${event.id}`, error as any);
        }

        return { invited: newIds.length, status: 'scheduled' as const };
    }

    async respondToEvent(params: { userId: string; eventId: string; status: 'invited' | 'confirmed' | 'declined' | 'tentative' }) {
        const { userId, eventId, status } = params;

        const event = await (this.prisma as any).event.findUnique({
            where: { id: eventId },
            select: { id: true, startAt: true },
        });

        if (!event) {
            throw new NotFoundException('Событие не найдено');
        }

        const eventStartAt = new Date((event as any).startAt);
        if (eventStartAt <= new Date()) {
            throw new ForbiddenException('Нельзя изменить участие после начала события');
        }

        const participant = await (this.prisma as any).eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId: event.id,
                    userId,
                },
            },
        });

        if (!participant) {
            throw new ForbiddenException('Вы не приглашены на событие');
        }

        const updated = await (this.prisma as any).eventParticipant.update({
            where: { id: participant.id },
            data: {
                participationStatus: status,
                respondedAt: new Date(),
            },
        });

        try {
            await this.telegramNotificationService.sendParticipationStatusChanged(event.id, userId);
        } catch (error) {
            this.logger.warn(`[Telegram] Failed to notify organizer for event ${event.id}`, error as any);
        }

        return updated;
    }

    async cancelEvent(params: { userId: string; eventId: string }) {
        const { userId, eventId } = params;

        const organizer = await (this.prisma as any).eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId,
                },
            },
            select: { role: true },
        });

        if (!organizer || organizer.role !== this.participantRoleOrganizer) {
            throw new ForbiddenException('Только организатор может отменить событие');
        }

        const updated = await (this.prisma as any).event.update({
            where: { id: eventId },
            data: { status: 'cancelled' },
        });

        try {
            await this.eventReminderScheduler.removeScheduledJobs(eventId);
        } catch (error) {
            this.logger.warn(`[Reminder] Failed to remove scheduled jobs for event ${eventId}`, error as any);
        }

        try {
            await this.telegramNotificationService.sendEventCancelled(eventId);
        } catch (error) {
            this.logger.warn(`[Telegram] Failed to send cancel notification ${eventId}`, error as any);
        }

        return updated;
    }

    async getEventDetails(params: { userId: string; eventId: string }) {
        const { userId, eventId } = params;

        const participant = await (this.prisma as any).eventParticipant.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId,
                },
            },
            select: { id: true },
        });

        if (!participant) {
            throw new ForbiddenException('Нет доступа к событию');
        }

        const event = await (this.prisma as any).event.findUnique({
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
            throw new NotFoundException('Событие не найдено');
        }

        return event;
    }
}
