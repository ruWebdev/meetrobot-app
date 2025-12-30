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
var TelegramNotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramNotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../infra/prisma/prisma.service");
const telegram_service_1 = require("../modules/telegram/telegram.service");
const grammy_1 = require("grammy");
let TelegramNotificationService = TelegramNotificationService_1 = class TelegramNotificationService {
    prisma;
    telegramService;
    logger = new common_1.Logger(TelegramNotificationService_1.name);
    constructor(prisma, telegramService) {
        this.prisma = prisma;
        this.telegramService = telegramService;
    }
    async sendEventCreated(eventId) {
        this.logger.log(`[Telegram] Sending event card ${eventId}`);
        const masterEvent = await this.prisma.event.findUnique({
            where: { id: eventId },
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
            where: { parentEventId: masterEvent.id },
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
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event card to group ${tgGroup.telegramChatId}: ${eventId}`, error);
            }
            return;
        }
        const participations = await this.prisma.participation.findMany({
            where: { eventId: masterEvent.id },
            select: { user: { select: { telegramId: true } } },
        });
        await Promise.all(participations.map(async (p) => {
            const telegramId = p.user?.telegramId;
            if (!telegramId)
                return;
            try {
                await bot.api.sendMessage(telegramId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event card to user ${telegramId}: ${eventId}`, error);
            }
        }));
    }
    async sendEventUpdated(eventId) {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
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
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event updated notification to group ${tgGroup.telegramChatId}: ${eventId}`, error);
            }
            return;
        }
        const participations = await this.prisma.participation.findMany({
            where: { eventId: event.id },
            select: { user: { select: { telegramId: true } } },
        });
        await Promise.all(participations.map(async (p) => {
            const telegramId = p.user?.telegramId;
            if (!telegramId)
                return;
            try {
                await bot.api.sendMessage(telegramId, text);
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event updated notification to user ${telegramId}: ${eventId}`, error);
            }
        }));
    }
    buildParticipationKeyboard(eventId) {
        return new grammy_1.InlineKeyboard()
            .text('✅ Will attend', `event:${eventId}:response:accepted`)
            .text('❌ Will not attend', `event:${eventId}:response:declined`)
            .row()
            .text('❓ Not sure', `event:${eventId}:response:tentative`);
    }
    buildEventCardText(params) {
        const date = params.masterEvent.date.toLocaleDateString('ru-RU');
        let text = `🎵 New Event Scheduled\n\n` +
            `Title: ${params.masterEvent.title}\n` +
            `Date: ${date}\n` +
            `Time: ${params.masterEvent.timeStart}–${params.masterEvent.timeEnd}\n` +
            `Location: ${params.masterEvent.location}`;
        if (params.masterEvent.description) {
            text += `\n\n${params.masterEvent.description}`;
        }
        if (params.subEvents.length) {
            text += `\n\nRehearsals:`;
            for (const se of params.subEvents) {
                const seDate = se.date.toLocaleDateString('ru-RU');
                text += `\n• ${se.title} — ${seDate}, ${se.timeStart}–${se.timeEnd}`;
            }
        }
        return text;
    }
    buildEventUpdatedText(params) {
        const date = params.date.toLocaleDateString('ru-RU');
        return (`⚠️ Event Updated\n\n` +
            `Event: ${params.title}\n` +
            `Date: ${date}\n` +
            `Time: ${params.timeStart}–${params.timeEnd}\n` +
            `Location: ${params.location}\n\n` +
            `Your previous response was reset.\n` +
            `Please confirm your participation again.`);
    }
};
exports.TelegramNotificationService = TelegramNotificationService;
exports.TelegramNotificationService = TelegramNotificationService = TelegramNotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        telegram_service_1.TelegramService])
], TelegramNotificationService);
