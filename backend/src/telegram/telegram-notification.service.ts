import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { TelegramService } from '../modules/telegram/telegram.service';
import { InlineKeyboard } from 'grammy';

@Injectable()
export class TelegramNotificationService {
    private readonly logger = new Logger(TelegramNotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly telegramService: TelegramService,
    ) { }

    async sendEventCreated(eventId: string): Promise<void> {
        this.logger.log(`[Telegram] Sending event card ${eventId}`);

        const masterEvent = await this.prisma.event.findFirst({
            where: { id: eventId, deletedAt: null },
            select: {
                id: true,
                workspaceId: true,
                title: true,
                description: true,
                date: true,
                timeStart: true,
                timeEnd: true,
                location: true,
                type: true,
                deletedAt: true,
            },
        });

        if (!masterEvent) {
            this.logger.warn(`[Telegram] Event not found for card delivery: ${eventId}`);
            return;
        }

        if (masterEvent.type !== 'master') {
            this.logger.warn(`[Telegram] Event is not master (skip card delivery): ${eventId}`);
            return;
        }

        const subEvents = await this.prisma.event.findMany({
            where: { parentEventId: masterEvent.id, deletedAt: null },
            select: {
                id: true,
                title: true,
                date: true,
                timeStart: true,
                timeEnd: true,
            },
            orderBy: [{ date: 'asc' }, { timeStart: 'asc' }],
        });

        const text = this.buildEventCardText({
            masterEvent: {
                title: masterEvent.title,
                description: masterEvent.description,
                date: masterEvent.date,
                timeStart: masterEvent.timeStart,
                timeEnd: masterEvent.timeEnd,
                location: masterEvent.location,
            },
            subEvents: subEvents.map((se) => ({
                title: se.title,
                date: se.date,
                timeStart: se.timeStart,
                timeEnd: se.timeEnd,
            })),
        });

        const bot = this.telegramService.getBot();
        const keyboard = this.buildParticipationKeyboard(masterEvent.id);

        const tgGroup = await this.prisma.telegramGroup.findFirst({
            where: { workspaceId: masterEvent.workspaceId },
            select: { telegramChatId: true, type: true },
        });

        if (tgGroup?.telegramChatId && (tgGroup.type === 'group' || tgGroup.type === 'supergroup')) {
            try {
                await bot.api.sendMessage(tgGroup.telegramChatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
                this.logger.log(`[Telegram] Event card delivered to group ${tgGroup.telegramChatId}`);
            } catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event card to group ${tgGroup.telegramChatId}: ${eventId}`, error as any);
            }
            return;
        }

        const participations = await this.prisma.participation.findMany({
            where: { eventId: masterEvent.id },
            select: { user: { select: { telegramId: true } } },
        });

        await Promise.all(
            participations.map(async (p) => {
                const telegramId = p.user?.telegramId;
                if (!telegramId) return;

                try {
                    await bot.api.sendMessage(telegramId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
                } catch (error) {
                    this.logger.warn(`[Telegram] Failed to deliver event card to user ${telegramId}: ${eventId}`, error as any);
                }
            }),
        );
    }

    async sendEventCancelled(eventId: string): Promise<void> {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                workspaceId: true,
                title: true,
                type: true,
            },
        });

        if (!event) {
            this.logger.warn(`[Telegram] Event not found for cancel notification: ${eventId}`);
            return;
        }

        if (event.type !== 'master') {
            this.logger.warn(`[Telegram] Event is not master (skip cancel notification): ${eventId}`);
            return;
        }

        const text = `Событие отменено\n\nСобытие "${event.title}" было отменено.`;
        const bot = this.telegramService.getBot();

        const tgGroup = await this.prisma.telegramGroup.findFirst({
            where: { workspaceId: event.workspaceId },
            select: { telegramChatId: true, type: true },
        });

        if (tgGroup?.telegramChatId && (tgGroup.type === 'group' || tgGroup.type === 'supergroup')) {
            try {
                await bot.api.sendMessage(tgGroup.telegramChatId, text);
            } catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event cancelled notification to group ${tgGroup.telegramChatId}: ${eventId}`, error as any);
            }
            return;
        }

        const participations = await this.prisma.participation.findMany({
            where: { eventId: event.id },
            select: { user: { select: { telegramId: true } } },
        });

        await Promise.all(
            participations.map(async (p) => {
                const telegramId = p.user?.telegramId;
                if (!telegramId) return;

                try {
                    await bot.api.sendMessage(telegramId, text);
                } catch (error) {
                    this.logger.warn(`[Telegram] Failed to deliver event cancelled notification to user ${telegramId}: ${eventId}`, error as any);
                }
            }),
        );
    }

    async sendEventUpdated(eventId: string): Promise<void> {
        const event = await this.prisma.event.findFirst({
            where: { id: eventId, deletedAt: null },
            select: {
                id: true,
                workspaceId: true,
                title: true,
                date: true,
                timeStart: true,
                timeEnd: true,
                location: true,
            },
        });

        if (!event) {
            this.logger.warn(`[Telegram] Event not found for update notification: ${eventId}`);
            return;
        }

        const text = this.buildEventUpdatedText({
            title: event.title,
            date: event.date,
            timeStart: event.timeStart,
            timeEnd: event.timeEnd,
            location: event.location,
        });

        const bot = this.telegramService.getBot();

        const tgGroup = await this.prisma.telegramGroup.findFirst({
            where: { workspaceId: event.workspaceId },
            select: { telegramChatId: true, type: true },
        });

        if (tgGroup?.telegramChatId && (tgGroup.type === 'group' || tgGroup.type === 'supergroup')) {
            try {
                await bot.api.sendMessage(tgGroup.telegramChatId, text);
            } catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event updated notification to group ${tgGroup.telegramChatId}: ${eventId}`, error as any);
            }
            return;
        }

        const participations = await this.prisma.participation.findMany({
            where: { eventId: event.id },
            select: { user: { select: { telegramId: true } } },
        });

        await Promise.all(
            participations.map(async (p) => {
                const telegramId = p.user?.telegramId;
                if (!telegramId) return;

                try {
                    await bot.api.sendMessage(telegramId, text);
                } catch (error) {
                    this.logger.warn(`[Telegram] Failed to deliver event updated notification to user ${telegramId}: ${eventId}`, error as any);
                }
            }),
        );
    }

    private buildParticipationKeyboard(eventId: string): InlineKeyboard {
        return new InlineKeyboard()
            .text('Буду участвовать', `event:${eventId}:response:accepted`)
            .text('Не буду участвовать', `event:${eventId}:response:declined`)
            .row()
            .text('Пока не уверен', `event:${eventId}:response:tentative`);
    }

    private buildEventCardText(params: {
        masterEvent: {
            title: string;
            description: string | null;
            date: Date;
            timeStart: string;
            timeEnd: string;
            location: string;
        };
        subEvents: Array<{ title: string; date: Date; timeStart: string; timeEnd: string }>;
    }): string {
        const date = params.masterEvent.date.toLocaleDateString('ru-RU');

        let text =
            `Новое событие\n\n` +
            `Название: ${params.masterEvent.title}\n` +
            `Дата: ${date}\n` +
            `Время: ${params.masterEvent.timeStart}–${params.masterEvent.timeEnd}\n` +
            `Место: ${params.masterEvent.location}`;

        if (params.masterEvent.description) {
            text += `\n\n${params.masterEvent.description}`;
        }

        if (params.subEvents.length) {
            text += `\n\nПод-события:`;
            for (const se of params.subEvents) {
                const seDate = se.date.toLocaleDateString('ru-RU');
                text += `\n- ${se.title}: ${seDate}, ${se.timeStart}–${se.timeEnd}`;
            }
        }

        return text;
    }

    private buildEventUpdatedText(params: { title: string; date: Date; timeStart: string; timeEnd: string; location: string }): string {
        const date = params.date.toLocaleDateString('ru-RU');
        return (
            `Событие обновлено\n\n` +
            `Событие: ${params.title}\n` +
            `Дата: ${date}\n` +
            `Время: ${params.timeStart}–${params.timeEnd}\n` +
            `Место: ${params.location}\n\n` +
            `Ваш предыдущий ответ сброшен.\n` +
            `Пожалуйста, подтвердите участие ещё раз.`
        );
    }
}
