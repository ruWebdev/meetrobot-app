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

    async scheduleReminderForEvent(params: { eventId: string; date: Date; timeStart: string }) {
        const reminderAt = this.computeReminderAt(params.date, params.timeStart);
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
                delay: delayMs,
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: true,
            },
        );
    }

    private computeReminderAt(date: Date, timeStart: string): Date | null {
        const match = timeStart.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) {
            return null;
        }

        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return null;
        }

        const startsAt = new Date(date);
        startsAt.setHours(hours, minutes, 0, 0);

        const reminderAt = new Date(startsAt.getTime() - 60 * 60 * 1000);
        return reminderAt;
    }
}
