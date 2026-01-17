import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { TelegramService } from '../modules/telegram/telegram.service';
import { InlineKeyboard } from 'grammy';

@Injectable()
export class TelegramNotificationService {
    private readonly logger = new Logger(TelegramNotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => TelegramService))
        private readonly telegramService: TelegramService,
    ) { }

    async sendEventInvitations(eventId: string, participantIds: string[]): Promise<void> {
        this.logger.log(`[Telegram] Sending invitations for event ${eventId}`);

        const event = await (this.prisma as any).event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                workspaceId: true,
                title: true,
                description: true,
                startAt: true,
                endAt: true,
            },
        });

        if (!event) {
            this.logger.warn(`[Telegram] Event not found for invitations: ${eventId}`);
            return;
        }

        const participants = await (this.prisma as any).eventParticipant.findMany({
            where: { eventId: event.id },
            select: {
                userId: true,
                participationStatus: true,
                user: { select: { telegramId: true, firstName: true, lastName: true, username: true } },
            },
            orderBy: [{ participationStatus: 'asc' }],
        });

        const list = this.buildParticipantsList(participants);
        const text = this.buildEventCardText({
            title: event.title,
            description: event.description,
            startAt: event.startAt,
            endAt: event.endAt,
            participants: list,
        });

        const bot = this.telegramService.getBot();
        const keyboard = this.buildParticipationKeyboard(event.id);

        const tgGroup = await this.prisma.telegramGroup.findFirst({
            where: { workspaceId: event.workspaceId },
            select: { telegramChatId: true, type: true },
        });

        if (tgGroup?.telegramChatId && (tgGroup.type === 'group' || tgGroup.type === 'supergroup')) {
            try {
                await bot.api.sendMessage(tgGroup.telegramChatId, text, { reply_markup: keyboard });
            } catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event invite to group ${tgGroup.telegramChatId}: ${eventId}`, error as any);
            }
        }

        if (!participantIds.length) return;

        const invitedUsers = participants.filter((p: { userId: string }) => participantIds.includes(p.userId));

        await Promise.all(
            invitedUsers.map(async (p: { user?: { telegramId?: string | null } }) => {
                const telegramId = p.user?.telegramId;
                if (!telegramId) return;

                try {
                    await bot.api.sendMessage(telegramId, text, { reply_markup: keyboard });
                } catch (error) {
                    this.logger.warn(`[Telegram] Failed to deliver event invite to user ${telegramId}: ${eventId}`, error as any);
                }
            }),
        );
    }

    async sendEventCancelled(eventId: string): Promise<void> {
        const event = await (this.prisma as any).event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                workspaceId: true,
                title: true,
            },
        });

        if (!event) {
            this.logger.warn(`[Telegram] Event not found for cancel notification: ${eventId}`);
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
        }

        const participants = await (this.prisma as any).eventParticipant.findMany({
            where: { eventId: event.id },
            select: { user: { select: { telegramId: true } } },
        });

        await Promise.all(
            participants.map(async (p: { user?: { telegramId?: string | null } }) => {
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

    async sendParticipationStatusChanged(eventId: string, userId: string): Promise<void> {
        const event = await (this.prisma as any).event.findUnique({
            where: { id: eventId },
            select: { id: true, title: true },
        });

        if (!event) {
            this.logger.warn(`[Telegram] Event not found for participation update: ${eventId}`);
            return;
        }

        const organizer = await (this.prisma as any).eventParticipant.findFirst({
            where: { eventId, role: 'organizer' },
            select: { user: { select: { telegramId: true } } },
        });

        const participant = await (this.prisma as any).eventParticipant.findUnique({
            where: {
                eventId_userId: { eventId, userId },
            },
            select: { participationStatus: true, user: { select: { firstName: true, lastName: true, username: true } } },
        });

        const telegramId = organizer?.user?.telegramId;
        if (!telegramId || !participant) {
            return;
        }

        const text =
            `Ответ на приглашение\n\n` +
            `Событие: ${event.title}\n` +
            `Участник: ${this.formatUserName(participant.user)}\n` +
            `Статус: ${this.mapStatus(participant.participationStatus)}`;

        try {
            await this.telegramService.getBot().api.sendMessage(telegramId, text);
        } catch (error) {
            this.logger.warn(`[Telegram] Failed to notify organizer ${telegramId} about status update: ${eventId}`, error as any);
        }
    }

    private buildParticipationKeyboard(eventId: string): InlineKeyboard {
        return new InlineKeyboard()
            .text('Подтвердить', `event:${eventId}:response:confirmed`)
            .text('Отказаться', `event:${eventId}:response:declined`)
            .row()
            .text('Под вопросом', `event:${eventId}:response:tentative`);
    }

    private buildEventCardText(params: {
        title: string;
        description: string | null;
        startAt: Date;
        endAt: Date;
        participants: string;
    }): string {
        const start = params.startAt.toLocaleString('ru-RU');
        const end = params.endAt.toLocaleString('ru-RU');

        let text =
            `Событие\n\n` +
            `Название: ${params.title}\n` +
            `Начало: ${start}\n` +
            `Окончание: ${end}`;

        if (params.description) {
            text += `\n\n${params.description}`;
        }

        if (params.participants) {
            text += `\n\nУчастники:\n${params.participants}`;
        }

        return text;
    }

    private buildParticipantsList(participants: Array<{ user?: { firstName?: string | null; lastName?: string | null; username?: string | null }; participationStatus: string }>): string {
        return participants
            .map((p) => `${this.mapStatus(p.participationStatus)} ${this.formatUserName(p.user)}`)
            .join('\n');
    }

    private formatUserName(user?: { firstName?: string | null; lastName?: string | null; username?: string | null }): string {
        if (!user) return 'Без имени';
        const base = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        if (base) return base;
        if (user.username) return `@${user.username}`;
        return 'Без имени';
    }

    private mapStatus(status: string): string {
        if (status === 'confirmed') return '✅';
        if (status === 'declined') return '❌';
        if (status === 'tentative') return '❔';
        if (status === 'invited') return '📨';
        return '•';
    }
}
