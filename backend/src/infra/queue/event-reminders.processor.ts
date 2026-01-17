import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../../modules/telegram/telegram.service';

@Processor('event-reminders')
export class EventRemindersProcessor extends WorkerHost {
    private readonly logger = new Logger(EventRemindersProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly telegramService: TelegramService,
    ) {
        super();
    }

    async process(job: Job<{ eventId: string }>): Promise<void> {
        const eventId = job.data.eventId;

        try {
            if (job.name === 'complete') {
                await this.completeEvent(eventId);
                return;
            }

            await this.sendReminder(eventId);
        } catch (error) {
            this.logger.warn(`[Reminder] Unexpected error while processing job for event ${eventId}`, error as any);
        }
    }

    private async sendReminder(eventId: string): Promise<void> {
        this.logger.log(`[Reminder] Sending reminder for event ${eventId}`);

        const event = await (this.prisma as any).event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                workspaceId: true,
                title: true,
                startAt: true,
                endAt: true,
                status: true,
            },
        });

        if (!event) {
            this.logger.warn(`[Reminder] Event not found: ${eventId}`);
            return;
        }

        if (event.status === 'cancelled' || event.status === 'completed') {
            this.logger.log(`[Reminder] Skip reminder for event ${eventId} with status ${event.status}`);
            return;
        }

        const participants = await (this.prisma as any).eventParticipant.findMany({
            where: {
                eventId: event.id,
                participationStatus: { in: ['confirmed', 'tentative'] },
            },
            select: { user: { select: { telegramId: true } } },
        });

        if (participants.length === 0) {
            this.logger.log(`[Reminder] No recipients (confirmed/tentative) for event ${eventId}`);
            return;
        }

        const bot = this.telegramService.getBot();

        const tgGroup = await this.prisma.telegramGroup.findFirst({
            where: { workspaceId: event.workspaceId },
            select: { telegramChatId: true, type: true },
        });

        const text = this.buildReminderText({
            title: event.title,
            startAt: event.startAt,
            endAt: event.endAt,
        });

        if (tgGroup?.telegramChatId && (tgGroup.type === 'group' || tgGroup.type === 'supergroup')) {
            try {
                await bot.api.sendMessage(tgGroup.telegramChatId, text);
                this.logger.log(`[Reminder] Reminder sent to group ${tgGroup.telegramChatId}`);
            } catch (error) {
                this.logger.warn(`[Reminder] Failed to send reminder to group ${tgGroup.telegramChatId} for event ${eventId}`, error as any);
            }
            return;
        }

        await Promise.all(
            participants.map(async (p: { user?: { telegramId?: string | null } }) => {
                const telegramId = p.user?.telegramId;
                if (!telegramId) return;

                try {
                    await bot.api.sendMessage(telegramId, text);
                    this.logger.log(`[Reminder] Reminder sent to dm ${telegramId}`);
                } catch (error) {
                    this.logger.warn(`[Reminder] Failed to send reminder to user ${telegramId} for event ${eventId}`, error as any);
                }
            }),
        );
    }

    private async completeEvent(eventId: string): Promise<void> {
        const event = await (this.prisma as any).event.findUnique({
            where: { id: eventId },
            select: { id: true, endAt: true, status: true },
        });

        if (!event) {
            this.logger.warn(`[Reminder] Event not found for completion: ${eventId}`);
            return;
        }

        if (event.status === 'cancelled' || event.status === 'completed') {
            return;
        }

        if (event.endAt > new Date()) {
            return;
        }

        await (this.prisma as any).event.update({
            where: { id: eventId },
            data: { status: 'completed' },
        });
    }

    private buildReminderText(params: { title: string; startAt: Date; endAt: Date }): string {
        const start = params.startAt.toLocaleString('ru-RU');
        const end = params.endAt.toLocaleString('ru-RU');
        return (
            `Напоминание\n\n` +
            `Событие: ${params.title}\n` +
            `Начало: ${start}\n` +
            `Окончание: ${end}`
        );
    }
}
