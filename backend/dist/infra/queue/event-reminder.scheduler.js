"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EventReminderScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventReminderScheduler = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
let EventReminderScheduler = EventReminderScheduler_1 = class EventReminderScheduler {
    queue;
    logger = new common_1.Logger(EventReminderScheduler_1.name);
    constructor(queue) {
        this.queue = queue;
    }
    async scheduleReminderForEvent(params) {
        const reminderAt = this.computeReminderAt(params.date, params.timeStart);
        if (!reminderAt) {
            return;
        }
        const delayMs = reminderAt.getTime() - Date.now();
        if (delayMs <= 0) {
            return;
        }
        this.logger.log(`[Reminder] Scheduled reminder for event ${params.eventId} at ${reminderAt.toISOString()}`);
        await this.queue.add('remind', { eventId: params.eventId }, {
            delay: delayMs,
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: true,
        });
    }
    computeReminderAt(date, timeStart) {
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
};
exports.EventReminderScheduler = EventReminderScheduler;
exports.EventReminderScheduler = EventReminderScheduler = EventReminderScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('event-reminders')),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], EventReminderScheduler);
