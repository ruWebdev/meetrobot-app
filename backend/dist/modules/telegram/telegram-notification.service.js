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
var TelegramNotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramNotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const telegram_service_1 = require("./telegram.service");
const grammy_1 = require("grammy");
let TelegramNotificationService = TelegramNotificationService_1 = class TelegramNotificationService {
    prisma;
    telegramService;
    logger = new common_1.Logger(TelegramNotificationService_1.name);
    constructor(prisma, telegramService) {
        this.prisma = prisma;
        this.telegramService = telegramService;
    }
    async sendEventInvitations(eventId, participantIds) {
        this.logger.log(`[Telegram] Sending invitations for event ${eventId}`);
        const event = await this.prisma.event.findUnique({
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
        const participants = await this.prisma.eventParticipant.findMany({
            where: { eventId: event.id },
            select: {
                userId: true,
                role: true,
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
        const organizer = participants.find((p) => p.role === 'organizer');
        const organizerTelegramId = organizer?.user?.telegramId;
        const organizerKeyboard = this.buildOrganizerKeyboard(event.id);
        const tgGroup = await this.prisma.telegramGroup.findFirst({
            where: { workspaceId: event.workspaceId },
            select: { telegramChatId: true, type: true },
        });
        if (tgGroup?.telegramChatId && (tgGroup.type === 'group' || tgGroup.type === 'supergroup')) {
            try {
                await bot.api.sendMessage(tgGroup.telegramChatId, text, { reply_markup: keyboard });
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event invite to group ${tgGroup.telegramChatId}: ${eventId}`, error);
            }
        }
        if (!participantIds.length)
            return;
        const invitedUsers = participants.filter((p) => participantIds.includes(p.userId));
        await Promise.all(invitedUsers.map(async (p) => {
            const telegramId = p.user?.telegramId;
            if (!telegramId)
                return;
            try {
                await bot.api.sendMessage(telegramId, text, { reply_markup: keyboard });
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event invite to user ${telegramId}: ${eventId}`, error);
            }
        }));
        if (organizerTelegramId) {
            try {
                await bot.api.sendMessage(organizerTelegramId, text, { reply_markup: organizerKeyboard });
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver organizer card to ${organizerTelegramId}: ${eventId}`, error);
            }
        }
    }
    async sendEventCancelled(eventId) {
        const event = await this.prisma.event.findUnique({
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
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event cancelled notification to group ${tgGroup.telegramChatId}: ${eventId}`, error);
            }
        }
        const participants = await this.prisma.eventParticipant.findMany({
            where: { eventId: event.id },
            select: { user: { select: { telegramId: true } } },
        });
        await Promise.all(participants.map(async (p) => {
            const telegramId = p.user?.telegramId;
            if (!telegramId)
                return;
            try {
                await bot.api.sendMessage(telegramId, text);
            }
            catch (error) {
                this.logger.warn(`[Telegram] Failed to deliver event cancelled notification to user ${telegramId}: ${eventId}`, error);
            }
        }));
    }
    async sendParticipationStatusChanged(eventId, userId) {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, title: true },
        });
        if (!event) {
            this.logger.warn(`[Telegram] Event not found for participation update: ${eventId}`);
            return;
        }
        const organizer = await this.prisma.eventParticipant.findFirst({
            where: { eventId, role: 'organizer' },
            select: { user: { select: { telegramId: true } } },
        });
        const participant = await this.prisma.eventParticipant.findUnique({
            where: {
                eventId_userId: { eventId, userId },
            },
            select: { participationStatus: true, user: { select: { firstName: true, lastName: true, username: true } } },
        });
        const telegramId = organizer?.user?.telegramId;
        if (!telegramId || !participant) {
            return;
        }
        const text = `Ответ на приглашение\n\n` +
            `Событие: ${event.title}\n` +
            `Участник: ${this.formatUserName(participant.user)}\n` +
            `Статус: ${this.mapStatus(participant.participationStatus)}`;
        try {
            await this.telegramService.getBot().api.sendMessage(telegramId, text);
        }
        catch (error) {
            this.logger.warn(`[Telegram] Failed to notify organizer ${telegramId} about status update: ${eventId}`, error);
        }
    }
    buildParticipationKeyboard(eventId) {
        return new grammy_1.InlineKeyboard()
            .text('Подтвердить', `event:${eventId}:response:confirmed`)
            .text('Отказаться', `event:${eventId}:response:declined`)
            .row()
            .text('Под вопросом', `event:${eventId}:response:tentative`);
    }
    buildOrganizerKeyboard(eventId) {
        return new grammy_1.InlineKeyboard().text('Отменить событие', `event:${eventId}:cancel`);
    }
    buildEventCardText(params) {
        const start = params.startAt.toLocaleString('ru-RU');
        const end = params.endAt.toLocaleString('ru-RU');
        let text = `Событие\n\n` +
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
    buildParticipantsList(participants) {
        return participants
            .map((p) => `${this.mapStatus(p.participationStatus)} ${this.formatUserName(p.user)}${p.role === 'organizer' ? ' (организатор)' : ''}`)
            .join('\n');
    }
    formatUserName(user) {
        if (!user)
            return 'Без имени';
        const base = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        if (base)
            return base;
        if (user.username)
            return `@${user.username}`;
        return 'Без имени';
    }
    mapStatus(status) {
        if (status === 'confirmed')
            return '✅';
        if (status === 'declined')
            return '❌';
        if (status === 'tentative')
            return '❔';
        if (status === 'invited')
            return '📨';
        return '•';
    }
};
exports.TelegramNotificationService = TelegramNotificationService;
exports.TelegramNotificationService = TelegramNotificationService = TelegramNotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => telegram_service_1.TelegramService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        telegram_service_1.TelegramService])
], TelegramNotificationService);
