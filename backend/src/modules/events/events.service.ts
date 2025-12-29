import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
    constructor(
        private prisma: PrismaService,
        private telegramService: TelegramService,
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

        await this.deliverEventCardBestEffort({
            workspaceId: dto.workspaceId,
            masterEvent: created.masterEvent,
            members: created.members,
        });

        return {
            masterEvent: created.masterEvent,
            subEvents: created.subEvents,
        };
    }

    private async deliverEventCardBestEffort(params: {
        workspaceId: string;
        masterEvent: { id: string; title: string; description: string | null; date: Date; timeStart: string; timeEnd: string; location: string };
        members: Array<{ user: { telegramId: string } | null }>;
    }) {
        const bot = this.telegramService.getBot();

        const text =
            `Событие создано:\n` +
            `Название: ${params.masterEvent.title}\n` +
            (params.masterEvent.description ? `Описание: ${params.masterEvent.description}\n` : '') +
            `Дата: ${params.masterEvent.date.toLocaleDateString('ru-RU')}\n` +
            `Время: ${params.masterEvent.timeStart}–${params.masterEvent.timeEnd}\n` +
            `Место: ${params.masterEvent.location}`;

        const tgGroup = await this.prisma.telegramGroup.findFirst({
            where: { workspaceId: params.workspaceId },
            select: { telegramChatId: true },
        });

        if (tgGroup) {
            try {
                await bot.api.sendMessage(tgGroup.telegramChatId, text);
            } catch {
                // best-effort
            }
            return;
        }

        await Promise.all(
            params.members.map(async (m) => {
                const telegramId = m.user?.telegramId;
                if (!telegramId) return;

                try {
                    await bot.api.sendMessage(telegramId, text);
                } catch {
                    // best-effort
                }
            }),
        );
    }
}
