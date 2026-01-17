import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EventReminderScheduler {
    private readonly logger = new Logger(EventReminderScheduler.name);

    constructor(
        @InjectQueue('event-reminders')
        private readonly queue: Queue,
    ) { }

    async scheduleReminderForEvent(params: { eventId: string; startAt: Date }) {
        const reminderAt = this.computeReminderAt(params.startAt);
        if (!reminderAt) {
            return;
        }

        const delayMs = reminderAt.getTime() - Date.now();
        if (delayMs <= 0) {
            return;
        }

        this.logger.log(`[Reminder] Scheduled reminder for event ${params.eventId} at ${reminderAt.toISOString()}`);

        await this.queue.add(
            'remind',
            { eventId: params.eventId },
            {
                jobId: `remind:${params.eventId}`,
                delay: delayMs,
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: true,
            },
        );
    }

    async scheduleCompletionForEvent(params: { eventId: string; endAt: Date }) {
        const delayMs = params.endAt.getTime() - Date.now();
        if (delayMs <= 0) {
            return;
        }

        this.logger.log(`[Reminder] Scheduled completion for event ${params.eventId} at ${params.endAt.toISOString()}`);

        await this.queue.add(
            'complete',
            { eventId: params.eventId },
            {
                jobId: `complete:${params.eventId}`,
                delay: delayMs,
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: true,
            },
        );
    }

    async removeScheduledJobs(eventId: string): Promise<void> {
        await Promise.all([
            this.safeRemoveJob(`remind:${eventId}`),
            this.safeRemoveJob(`complete:${eventId}`),
        ]);
    }

    private computeReminderAt(startAt: Date): Date | null {
        const reminderAt = new Date(startAt.getTime() - 60 * 60 * 1000);
        return reminderAt;
    }

    private async safeRemoveJob(jobId: string): Promise<void> {
        try {
            await this.queue.remove(jobId);
        } catch (error) {
            this.logger.warn(`[Reminder] Failed to remove job ${jobId}`, error as any);
        }
    }
}
