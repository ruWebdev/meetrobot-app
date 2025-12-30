import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TelegramNotificationService } from '../../telegram/telegram-notification.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
    private readonly logger = new Logger(EventsService.name);

    constructor(
        private prisma: PrismaService,
        private telegramNotificationService: TelegramNotificationService,
    ) { }

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

        return {
            masterEvent: created.masterEvent,
            subEvents: created.subEvents,
        };
    }
}
