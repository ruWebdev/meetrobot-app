import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventReminderScheduler } from '../../infra/queue/event-reminder.scheduler';
import { TelegramNotificationService } from '../../telegram/telegram-notification.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateWorkspaceEventDto } from './dto/create-workspace-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class EventsService {
    private readonly logger = new Logger(EventsService.name);

    constructor(
        private prisma: PrismaService,
        private telegramNotificationService: TelegramNotificationService,
        private eventReminderScheduler: EventReminderScheduler,
        private workspaceService: WorkspaceService,
    ) { }

    async createWorkspaceEvent(params: { userId: string; workspaceId: string; dto: CreateWorkspaceEventDto }) {
        const { userId, workspaceId, dto } = params;

        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId,
        });

        if (!membership) {
            throw new ForbiddenException('Вы не состоите в этом рабочем пространстве');
        }

        if (!['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
            throw new ForbiddenException('Недостаточно прав для создания события');
        }

        const title = (dto.title ?? '').trim();
        if (!title) {
            throw new BadRequestException('Название события обязательно');
        }

        const eventType = dto.type;
        if (!eventType || !['single', 'parent', 'service'].includes(eventType)) {
            throw new BadRequestException('Некорректный тип события');
        }

        if ((eventType === 'single' || eventType === 'parent') && !dto.date) {
            throw new BadRequestException('Дата события обязательна');
        }

        if (dto.date) {
            const parsedDate = new Date(dto.date);
            if (Number.isNaN(parsedDate.getTime())) {
                throw new BadRequestException('Некорректный формат даты');
            }
        }

        if (dto.maxParticipants !== undefined && dto.maxParticipants !== null && dto.maxParticipants <= 0) {
            throw new BadRequestException('Максимальное число участников должно быть положительным');
        }

        if (eventType === 'service') {
            if (!dto.slots || dto.slots.length === 0) {
                throw new BadRequestException('Добавьте хотя бы один слот');
            }

            dto.slots.forEach((slot: { startTime: string; endTime: string; maxParticipants?: number }, index: number) => {
                if (!slot.startTime || !slot.endTime) {
                    throw new BadRequestException(`Слот #${index + 1}: время начала и окончания обязательны`);
                }

                const start = new Date(slot.startTime);
                const end = new Date(slot.endTime);
                if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                    throw new BadRequestException(`Слот #${index + 1}: некорректный формат времени`);
                }
            });
        }

        const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const event = await (tx as any).event.create({
                data: {
                    workspaceId,
                    parentEventId: null,
                    type: eventType,
                    title,
                    description: dto.description?.trim() ? dto.description.trim() : null,
                    location: dto.location?.trim() ? dto.location.trim() : null,
                    maxParticipants: eventType === 'parent' ? null : dto.maxParticipants ?? null,
                    mandatoryAttendance: eventType === 'parent' ? dto.mandatoryAttendance ?? false : null,
                    confirmationMode: eventType === 'service' ? dto.confirmationMode ?? 'auto' : null,
                    status: 'draft',
                    createdById: userId,
                    ...(dto.date ? { date: new Date(dto.date) } : {}),
                    ...(dto.time ? { time: dto.time } : {}),
                },
            });

            if (eventType === 'service' && dto.slots?.length) {
                const eventSlotClient = (tx as any).eventSlot as { createMany: (args: any) => Promise<any> };
                await eventSlotClient.createMany({
                    data: dto.slots.map((slot: { startTime: string; endTime: string; maxParticipants?: number }) => ({
                        eventId: event.id,
                        startTime: new Date(slot.startTime),
                        endTime: new Date(slot.endTime),
                        maxParticipants: slot.maxParticipants ?? null,
                    })),
                });
            }

            return event;
        });

        return {
            id: created.id,
            type: created.type,
            title: created.title,
            status: created.status,
            createdAt: created.createdAt,
            workspaceId: created.workspaceId,
        };
    }

    async createEvent(params: { userId: string; dto: CreateEventDto }) {
        const { userId, dto } = params;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, telegramId: true },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const workspace = await this.prisma.workspace.findUnique({
            where: { id: dto.workspaceId },
            select: { id: true },
        });

        if (!workspace) {
            throw new NotFoundException('Workspace не найден');
        }

        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId: dto.workspaceId,
                },
            },
            select: { role: true },
        });

        if (!membership || membership.role !== 'OWNER') {
            throw new ForbiddenException('Только владелец Workspace может создать событие');
        }

        const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const masterEvent = await tx.event.create({
                data: {
                    workspaceId: dto.workspaceId,
                    parentEventId: null,
                    type: 'master',
                    title: dto.title,
                    description: dto.description ?? null,
                    date: new Date(dto.date),
                    timeStart: dto.timeStart,
                    timeEnd: dto.timeEnd,
                    location: dto.location,
                    status: 'scheduled',
                    createdById: user.id,
                },
            });

            const subEventsPayload = dto.subEvents ?? [];

            const subEvents = await Promise.all(
                subEventsPayload.map((se) => tx.event.create({
                    data: {
                        workspaceId: dto.workspaceId,
                        parentEventId: masterEvent.id,
                        type: 'sub',
                        title: se.title,
                        description: null,
                        date: new Date(se.date),
                        timeStart: se.timeStart,
                        timeEnd: se.timeEnd,
                        location: se.location,
                        status: 'scheduled',
                        createdById: user.id,
                    },
                })),
            );

            const members = await tx.workspaceMember.findMany({
                where: { workspaceId: dto.workspaceId },
                select: { userId: true, user: { select: { telegramId: true } } },
            });

            const allEvents = [masterEvent, ...subEvents];

            for (const ev of allEvents) {
                await Promise.all(
                    members.map((m) => tx.participation.create({
                        data: {
                            eventId: ev.id,
                            userId: m.userId,
                            responseStatus: 'pending',
                            responseUpdatedAt: null,
                        },
                    })),
                );
            }

            return { masterEvent, subEvents, members };
        });

        try {
            await this.telegramNotificationService.sendEventCreated(created.masterEvent.id);
        } catch (error) {
            this.logger.warn(`[Telegram] Failed to send event card ${created.masterEvent.id}`, error as any);
        }

        try {
            if (created.masterEvent.date && created.masterEvent.timeStart) {
                await this.eventReminderScheduler.scheduleReminderForEvent({
                    eventId: created.masterEvent.id,
                    date: created.masterEvent.date,
                    timeStart: created.masterEvent.timeStart,
                });
            }

            await Promise.all(
                created.subEvents.map((se) => {
                    if (!se.date || !se.timeStart) return null;
                    return this.eventReminderScheduler.scheduleReminderForEvent({
                        eventId: se.id,
                        date: se.date,
                        timeStart: se.timeStart,
                    });
                }),
            );
        } catch (error) {
            this.logger.warn(`[Reminder] Failed to schedule reminders for master event ${created.masterEvent.id}`, error as any);
        }

        return {
            masterEvent: created.masterEvent,
            subEvents: created.subEvents,
        };
    }

    async getEventForEdit(params: { userId: string; eventId: string }) {
        const { userId, eventId } = params;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const masterEvent = await this.prisma.event.findFirst({
            where: {
                id: eventId,
                type: 'master',
                deletedAt: null,
            },
            select: {
                id: true,
                workspaceId: true,
                title: true,
                description: true,
                date: true,
                timeStart: true,
                timeEnd: true,
                location: true,
            },
        });

        if (!masterEvent) {
            throw new NotFoundException('Событие не найдено');
        }

        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId: masterEvent.workspaceId,
                },
            },
            select: { role: true },
        });

        if (!membership || membership.role !== 'OWNER') {
            throw new ForbiddenException('Только владелец Workspace может просматривать событие');
        }

        const subEvents = await this.prisma.event.findMany({
            where: {
                parentEventId: masterEvent.id,
                deletedAt: null,
            },
            select: {
                id: true,
                title: true,
                date: true,
                timeStart: true,
                timeEnd: true,
                location: true,
            },
            orderBy: [{ date: 'asc' }, { timeStart: 'asc' }],
        });

        return {
            masterEvent,
            subEvents,
        };
    }

    async updateEvent(params: { userId: string; eventId: string; dto: UpdateEventDto }) {
        const { userId, eventId, dto } = params;

        if (!dto || Object.keys(dto).length === 0) {
            throw new BadRequestException('Payload не может быть пустым');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const existing = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                workspaceId: true,
                title: true,
                description: true,
                date: true,
                timeStart: true,
                timeEnd: true,
                location: true,
                deletedAt: true,
            },
        });

        if (!existing) {
            throw new NotFoundException('Событие не найдено');
        }

        if (existing.deletedAt) {
            throw new NotFoundException('Событие не найдено');
        }

        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId: existing.workspaceId,
                },
            },
            select: { role: true },
        });

        if (!membership || membership.role !== 'OWNER') {
            throw new ForbiddenException('Только владелец Workspace может обновлять событие');
        }

        const newDate = dto.date ? new Date(dto.date) : existing.date;
        const newTimeStart = dto.timeStart ?? existing.timeStart;
        const newTimeEnd = dto.timeEnd ?? existing.timeEnd;
        const newLocation = dto.location ?? existing.location;

        const significantChanged =
            (dto.date ? (!existing.date || newDate.getTime() !== existing.date.getTime()) : false) ||
            (dto.timeStart ? dto.timeStart !== existing.timeStart : false) ||
            (dto.timeEnd ? dto.timeEnd !== existing.timeEnd : false) ||
            (dto.location ? dto.location !== existing.location : false);

        const updated = await this.prisma.event.update({
            where: { id: existing.id },
            data: {
                title: dto.title ?? undefined,
                description: dto.description === undefined ? undefined : dto.description,
                date: dto.date ? newDate : undefined,
                timeStart: dto.timeStart ?? undefined,
                timeEnd: dto.timeEnd ?? undefined,
                location: dto.location ?? undefined,
            },
        });

        this.logger.log(`[Event] Event ${eventId} updated by user ${userId}`);

        if (significantChanged) {
            await this.prisma.participation.updateMany({
                where: { eventId: existing.id },
                data: {
                    responseStatus: 'pending',
                    responseUpdatedAt: null,
                },
            });

            this.logger.log(`[Participation] Reset participation for event ${eventId}`);

            try {
                await this.telegramNotificationService.sendEventUpdated(existing.id);
            } catch (error) {
                this.logger.warn(`[Telegram] Failed to send event updated notification ${existing.id}`, error as any);
            }
        }

        return updated;
    }

    async deleteEvent(params: { userId: string; eventId: string }) {
        const { userId, eventId } = params;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const masterEvent = await this.prisma.event.findFirst({
            where: {
                id: eventId,
                type: 'master',
                deletedAt: null,
            },
            select: {
                id: true,
                workspaceId: true,
            },
        });

        if (!masterEvent) {
            throw new NotFoundException('Событие не найдено');
        }

        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId: masterEvent.workspaceId,
                },
            },
            select: { role: true },
        });

        if (!membership || membership.role !== 'OWNER') {
            throw new ForbiddenException('Только владелец Workspace может удалить событие');
        }

        const now = new Date();

        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.event.updateMany({
                where: {
                    OR: [
                        { id: masterEvent.id },
                        { parentEventId: masterEvent.id },
                    ],
                    deletedAt: null,
                },
                data: {
                    deletedAt: now,
                },
            });
        });

        try {
            await this.telegramNotificationService.sendEventCancelled(masterEvent.id);
        } catch (error) {
            this.logger.warn(`[Telegram] Failed to send event cancelled notification ${masterEvent.id}`, error as any);
        }

        return { ok: true };
    }
}
