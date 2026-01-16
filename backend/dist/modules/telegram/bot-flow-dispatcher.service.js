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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotFlowDispatcher = void 0;
const common_1 = require("@nestjs/common");
const grammy_1 = require("grammy");
const workspace_service_1 = require("../workspace/workspace.service");
const user_service_1 = require("../user/user.service");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const flow_type_1 = require("./flow-type");
const user_session_service_1 = require("./user-session.service");
const event_series_flow_1 = require("./flows/event-series.flow");
const single_event_flow_1 = require("./flows/single-event.flow");
const service_booking_flow_1 = require("./flows/service-booking.flow");
let BotFlowDispatcher = class BotFlowDispatcher {
    userService;
    workspaceService;
    prisma;
    userSessionService;
    eventSeriesFlow;
    singleEventFlow;
    serviceBookingFlow;
    constructor(userService, workspaceService, prisma, userSessionService, eventSeriesFlow, singleEventFlow, serviceBookingFlow) {
        this.userService = userService;
        this.workspaceService = workspaceService;
        this.prisma = prisma;
        this.userSessionService = userSessionService;
        this.eventSeriesFlow = eventSeriesFlow;
        this.singleEventFlow = singleEventFlow;
        this.serviceBookingFlow = serviceBookingFlow;
    }
    async onUpdate(ctx) {
        const telegramUserId = ctx.from?.id?.toString?.();
        const telegramChatId = ctx.chat?.id?.toString?.();
        if (!telegramUserId || !telegramChatId) {
            return;
        }
        await this.userService.findOrCreateUser(telegramUserId);
        const workspaceId = await this.resolveWorkspaceId({ ctx, telegramUserId, telegramChatId });
        if (!workspaceId) {
            await this.safeReply(ctx, 'Рабочее пространство не найдено.');
            return;
        }
        const session = await this.userSessionService.getOrCreate({ telegramUserId, telegramChatId, workspaceId });
        const handledGlobal = await this.tryHandleGlobal({ ctx, session });
        if (handledGlobal) {
            return;
        }
        if (session.activeFlowType) {
            const flow = this.getFlow(session.activeFlowType);
            await flow.onUpdate(ctx);
            return;
        }
        const isStart = this.isCommand(ctx, 'start');
        const isHelp = this.isCommand(ctx, 'help');
        if (isHelp) {
            await this.showHelp(ctx);
            return;
        }
        if (isStart) {
            await this.showWelcome(ctx);
            return;
        }
        if (this.isAnyUserMessage(ctx) || this.isCallbackQuery(ctx)) {
            await this.showWelcome(ctx);
        }
    }
    getFlow(flowType) {
        if (flowType === flow_type_1.FlowType.EVENT_SERIES)
            return this.eventSeriesFlow;
        if (flowType === flow_type_1.FlowType.SINGLE_EVENT)
            return this.singleEventFlow;
        return this.serviceBookingFlow;
    }
    async tryHandleGlobal(params) {
        const { ctx, session } = params;
        if (this.isCommand(ctx, 'help')) {
            await this.showHelp(ctx);
            return true;
        }
        const callbackData = ctx.callbackQuery?.data;
        if (!callbackData) {
            return false;
        }
        if (callbackData === 'global:help') {
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.showHelp(ctx);
            return true;
        }
        if (callbackData === 'global:exit') {
            if (session.activeFlowType) {
                const flow = this.getFlow(session.activeFlowType);
                await flow.onExit(ctx);
            }
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.userSessionService.reset({
                telegramUserId: session.telegramUserId,
                telegramChatId: session.telegramChatId,
                workspaceId: session.workspaceId,
            });
            await this.showWelcome(ctx);
            return true;
        }
        if (callbackData === `menu:${flow_type_1.FlowType.EVENT_SERIES}`) {
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.userSessionService.updateActiveFlow({
                telegramUserId: session.telegramUserId,
                telegramChatId: session.telegramChatId,
                workspaceId: session.workspaceId,
                activeFlowType: flow_type_1.FlowType.EVENT_SERIES,
                activeEntityId: null,
            });
            await this.eventSeriesFlow.onEnter(ctx);
            return true;
        }
        if (callbackData === `menu:${flow_type_1.FlowType.SINGLE_EVENT}`) {
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.userSessionService.updateActiveFlow({
                telegramUserId: session.telegramUserId,
                telegramChatId: session.telegramChatId,
                workspaceId: session.workspaceId,
                activeFlowType: flow_type_1.FlowType.SINGLE_EVENT,
                activeEntityId: null,
            });
            await this.singleEventFlow.onEnter(ctx);
            return true;
        }
        if (callbackData === `menu:${flow_type_1.FlowType.SERVICE_BOOKING}`) {
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.userSessionService.updateActiveFlow({
                telegramUserId: session.telegramUserId,
                telegramChatId: session.telegramChatId,
                workspaceId: session.workspaceId,
                activeFlowType: flow_type_1.FlowType.SERVICE_BOOKING,
                activeEntityId: null,
            });
            await this.serviceBookingFlow.onEnter(ctx);
            return true;
        }
        return false;
    }
    async showWelcome(ctx) {
        const text = 'Здравствуйте!\n\n' +
            'Я помогу вам управлять мероприятиями или записываться на услуги.\n\n' +
            'Выберите, с чем вы хотите работать:';
        const keyboard = new grammy_1.InlineKeyboard()
            .text('🎭 Мероприятия с программой', `menu:${flow_type_1.FlowType.EVENT_SERIES}`)
            .row()
            .text('📅 Разовое мероприятие', `menu:${flow_type_1.FlowType.SINGLE_EVENT}`)
            .row()
            .text('💅 Запись на услугу', `menu:${flow_type_1.FlowType.SERVICE_BOOKING}`)
            .row()
            .text('ℹ️ Помощь', 'global:help');
        await this.safeReply(ctx, text, keyboard);
    }
    async showHelp(ctx) {
        const text = 'Справка\n\n' +
            'Этот бот позволяет:\n' +
            '— управлять мероприятиями с несколькими событиями\n' +
            '— создавать и вести разовые мероприятия\n' +
            '— записываться на услуги по свободным слотам\n\n' +
            'Навигация:\n' +
            '— используйте кнопки под сообщениями\n' +
            '— для смены режима всегда выходите в главное меню\n\n' +
            'Если вы не уверены, с чего начать — выберите подходящий раздел в главном меню.';
        await this.safeReply(ctx, text);
    }
    async safeReply(ctx, text, keyboard) {
        try {
            await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
        }
        catch {
            try {
                await ctx.api.sendMessage(ctx.chat.id, text, keyboard ? { reply_markup: keyboard } : undefined);
            }
            catch {
                return;
            }
        }
    }
    isCallbackQuery(ctx) {
        return Boolean(ctx.callbackQuery?.data);
    }
    isAnyUserMessage(ctx) {
        return Boolean(ctx.message);
    }
    isCommand(ctx, command) {
        const text = ctx.message?.text;
        if (!text)
            return false;
        if (text === `/${command}`)
            return true;
        if (text.startsWith(`/${command}@`))
            return true;
        return false;
    }
    async resolveWorkspaceId(params) {
        const { ctx, telegramUserId, telegramChatId } = params;
        if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
            const tgGroup = await this.prisma.telegramGroup.findUnique({
                where: { telegramChatId },
                select: { workspaceId: true },
            });
            return tgGroup?.workspaceId ?? null;
        }
        if (ctx.chat?.type !== 'private') {
            return null;
        }
        const user = await this.userService.findByTelegramId(telegramUserId);
        if (!user) {
            return null;
        }
        const memberships = await this.prisma.workspaceMember.findMany({
            where: { userId: user.id },
            select: { workspaceId: true },
            orderBy: { createdAt: 'asc' },
        });
        if (memberships.length === 0) {
            const result = await this.workspaceService.onboardFromTelegram({
                telegramId: telegramUserId,
                firstName: ctx.from?.first_name ?? null,
            });
            const createdWorkspaceId = result.workspaceId;
            if (createdWorkspaceId) {
                return createdWorkspaceId;
            }
            const membershipAfter = await this.prisma.workspaceMember.findFirst({
                where: { userId: user.id },
                select: { workspaceId: true },
                orderBy: { createdAt: 'asc' },
            });
            return membershipAfter?.workspaceId ?? null;
        }
        return memberships[0].workspaceId;
    }
};
exports.BotFlowDispatcher = BotFlowDispatcher;
exports.BotFlowDispatcher = BotFlowDispatcher = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService,
        workspace_service_1.WorkspaceService,
        prisma_service_1.PrismaService,
        user_session_service_1.UserSessionService,
        event_series_flow_1.EventSeriesFlow,
        single_event_flow_1.SingleEventFlow,
        service_booking_flow_1.ServiceBookingFlow])
], BotFlowDispatcher);
