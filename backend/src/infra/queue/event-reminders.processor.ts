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
            this.logger.log(`[Reminder] Sending reminder for event ${eventId}`);

            const event = await this.prisma.event.findUnique({
                where: { id: eventId },
                select: {
                    id: true,
                    workspaceId: true,
                    type: true,
                    title: true,
                    timeStart: true,
                    location: true,
                    deletedAt: true,
                },
            });

            if (!event) {
                this.logger.warn(`[Reminder] Event not found: ${eventId}`);
                return;
            }

            if (event.deletedAt) {
                this.logger.log(`[Reminder] Skip deleted event ${eventId}`);
                return;
            }

            const participations = await this.prisma.participation.findMany({
                where: {
                    eventId: event.id,
                    responseStatus: { in: ['accepted', 'tentative'] },
                },
                select: { user: { select: { telegramId: true } } },
            });

            if (participations.length === 0) {
                this.logger.log(`[Reminder] No recipients (accepted/tentative) for event ${eventId}`);
                return;
            }

            const bot = this.telegramService.getBot();

            const tgGroup = await this.prisma.telegramGroup.findFirst({
                where: { workspaceId: event.workspaceId },
                select: { telegramChatId: true, type: true },
            });

            const text = this.buildReminderText({
                title: event.title,
                timeStart: event.timeStart,
                location: event.location,
                isSubEvent: event.type === 'sub',
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
                participations.map(async (p) => {
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
        } catch (error) {
            this.logger.warn(`[Reminder] Unexpected error while processing reminder job for event ${eventId}`, error as any);
        }
    }

    private buildReminderText(params: { title: string; timeStart: string; location: string; isSubEvent: boolean }): string {
        if (params.isSubEvent) {
            return (
                `⏰ Reminder\n\n` +
                `Rehearsal reminder\n\n` +
                `Event: ${params.title}\n` +
                `Starts at: ${params.timeStart}\n` +
                `Location: ${params.location}`
            );
        }

        return (
            `⏰ Reminder\n\n` +
            `Event: ${params.title}\n` +
            `Starts at: ${params.timeStart}\n` +
            `Location: ${params.location}`
        );
    }
}
