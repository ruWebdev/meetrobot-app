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
var EventRemindersProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventRemindersProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const telegram_service_1 = require("../../modules/telegram/telegram.service");
let EventRemindersProcessor = EventRemindersProcessor_1 = class EventRemindersProcessor extends bullmq_1.WorkerHost {
    prisma;
    telegramService;
    logger = new common_1.Logger(EventRemindersProcessor_1.name);
    constructor(prisma, telegramService) {
        super();
        this.prisma = prisma;
        this.telegramService = telegramService;
    }
    async process(job) {
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
                },
            });
            if (!event) {
                this.logger.warn(`[Reminder] Event not found: ${eventId}`);
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
                }
                catch (error) {
                    this.logger.warn(`[Reminder] Failed to send reminder to group ${tgGroup.telegramChatId} for event ${eventId}`, error);
                }
                return;
            }
            await Promise.all(participations.map(async (p) => {
                const telegramId = p.user?.telegramId;
                if (!telegramId)
                    return;
                try {
                    await bot.api.sendMessage(telegramId, text);
                    this.logger.log(`[Reminder] Reminder sent to dm ${telegramId}`);
                }
                catch (error) {
                    this.logger.warn(`[Reminder] Failed to send reminder to user ${telegramId} for event ${eventId}`, error);
                }
            }));
        }
        catch (error) {
            this.logger.warn(`[Reminder] Unexpected error while processing reminder job for event ${eventId}`, error);
        }
    }
    buildReminderText(params) {
        if (params.isSubEvent) {
            return (`⏰ Reminder\n\n` +
                `Rehearsal reminder\n\n` +
                `Event: ${params.title}\n` +
                `Starts at: ${params.timeStart}\n` +
                `Location: ${params.location}`);
        }
        return (`⏰ Reminder\n\n` +
            `Event: ${params.title}\n` +
            `Starts at: ${params.timeStart}\n` +
            `Location: ${params.location}`);
    }
};
exports.EventRemindersProcessor = EventRemindersProcessor;
exports.EventRemindersProcessor = EventRemindersProcessor = EventRemindersProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('event-reminders'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        telegram_service_1.TelegramService])
], EventRemindersProcessor);
