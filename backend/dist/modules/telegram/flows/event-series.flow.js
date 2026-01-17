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
var EventSeriesFlow_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSeriesFlow = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const grammy_1 = require("grammy");
const prisma_service_1 = require("../../../infra/prisma/prisma.service");
const user_service_1 = require("../../user/user.service");
const workspace_service_1 = require("../../workspace/workspace.service");
const events_service_1 = require("../../events/events.service");
const flow_keyboards_1 = require("./flow-keyboards");
let EventSeriesFlow = EventSeriesFlow_1 = class EventSeriesFlow {
    configService;
    workspaceService;
    userService;
    prisma;
    eventsService;
    logger = new common_1.Logger(EventSeriesFlow_1.name);
    constructor(configService, workspaceService, userService, prisma, eventsService) {
        this.configService = configService;
        this.workspaceService = workspaceService;
        this.userService = userService;
        this.prisma = prisma;
        this.eventsService = eventsService;
    }
    async onEnter(ctx) {
        const text = 'Мероприятия с программой\n\n' +
            'Раздел предназначен для работы с мероприятиями, которые содержат несколько событий.';
        const keyboard = new grammy_1.InlineKeyboard()
            .text('Создать событие', 'event_series:hint:create')
            .row()
            .text('Отметить посещаемость', 'event_series:hint:attendance')
            .row();
        keyboard.text('⬅️ Выйти в главное меню', 'global:exit');
        await ctx.reply(text, { reply_markup: keyboard });
    }
    async onUpdate(ctx) {
        const callbackData = ctx.callbackQuery?.data;
        if (callbackData) {
            if (callbackData === 'event_series:hint:create') {
                await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
                await ctx.reply('Создание событий доступно через Web App.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            if (callbackData === 'event_series:hint:attendance') {
                await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
                await ctx.reply('Функционал посещаемости временно недоступен.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
        }
        if (this.isCommand(ctx, 'attendance')) {
            await ctx.reply('Функционал посещаемости временно недоступен.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        if (this.isCommand(ctx, 'create_event')) {
            await this.handleCreateEventCommand(ctx);
            return;
        }
        if (this.isCommand(ctx, 'connect')) {
            await this.handleConnectCommand(ctx);
            return;
        }
        if (this.isCommand(ctx, 'workspace')) {
            await this.handleWorkspaceCommand(ctx);
            return;
        }
        if (this.isCommand(ctx, 'whoami')) {
            await this.handleWhoAmICommand(ctx);
            return;
        }
        await ctx.reply('Используйте кнопки под сообщениями или команду /help.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
    }
    async onExit(ctx) {
        return;
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
    async handleCreateEventCommand(ctx) {
        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) {
            await ctx.reply('Пользователь не зарегистрирован', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        const user = await this.userService.findByTelegramId(telegramId);
        if (!user) {
            await ctx.reply('Пользователь не зарегистрирован', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        let workspaceId = null;
        if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
            const telegramChatId = ctx.chat.id.toString();
            const tgGroup = await this.prisma.telegramGroup.findUnique({
                where: { telegramChatId },
                select: { workspaceId: true },
            });
            workspaceId = tgGroup?.workspaceId ?? null;
        }
        else if (ctx.chat.type === 'private') {
            const memberships = await this.prisma.workspaceMember.findMany({
                where: { userId: user.id },
                select: { workspaceId: true },
                take: 2,
            });
            if (memberships.length === 0) {
                await ctx.reply('Нет доступных рабочих пространств', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            if (memberships.length > 1) {
                await ctx.reply('У вас несколько рабочих пространств. Создание событий из личного чата пока недоступно.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            workspaceId = memberships[0].workspaceId;
        }
        else {
            return;
        }
        if (!workspaceId) {
            await ctx.reply('Рабочее пространство не найдено', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        const workspaceExists = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { id: true },
        });
        if (!workspaceExists) {
            await ctx.reply('Рабочее пространство не найдено', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId,
                },
            },
            select: { role: true },
        });
        if (!membership) {
            await ctx.reply('Вы не состоите в этом рабочем пространстве', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        if (!['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
            this.logger.log(`[Telegram] Deny open WebApp (insufficient role) for user ${user.id}, workspace ${workspaceId}`);
            await ctx.reply('Недостаточно прав для создания события', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        const webappHost = this.configService.get('WEBAPP_HOST');
        if (!webappHost) {
            await ctx.reply('Рабочее пространство не найдено', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        const trimmedWebappHost = webappHost.trim().replace(/\/+$/, '');
        const webappBaseUrl = trimmedWebappHost.startsWith('http://') || trimmedWebappHost.startsWith('https://')
            ? trimmedWebappHost
            : `https://${trimmedWebappHost}`;
        const apiBaseUrl = this.configService.get('API_BASE_URL')?.trim().replace(/\/+$/, '') ?? webappBaseUrl;
        const url = `${webappBaseUrl}/workspaces/${workspaceId}/events/create?userId=${user.id}&apiBaseUrl=${encodeURIComponent(apiBaseUrl)}`;
        const keyboard = new grammy_1.InlineKeyboard().webApp('Создать событие', url);
        if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
            const fromId = ctx.from?.id;
            if (!fromId) {
                await ctx.reply('Не удалось определить пользователя. Попробуйте позже.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            try {
                await ctx.api.sendMessage(fromId, 'Откройте форму создания события:', {
                    reply_markup: keyboard,
                });
                this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
                await ctx.reply('Я отправил кнопку для открытия Web App вам в личные сообщения.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            catch {
                this.logger.log(`[Telegram] Failed to send WebApp button to DM for user ${user.id}, workspace ${workspaceId}`);
                await ctx.reply('Не удалось отправить кнопку в личные сообщения. Откройте чат с ботом и попробуйте снова.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
        }
        this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
        await ctx.reply('Откройте форму создания события:', {
            reply_markup: keyboard,
        });
    }
    async handleWorkspaceCommand(ctx) {
        if (ctx.chat.type === 'private') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        if (ctx.chat.type === 'channel') {
            return;
        }
        if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        const telegramChatId = ctx.chat.id.toString();
        this.logger.log(`Вызов команды /workspace: chatId=${telegramChatId}, type=${ctx.chat.type}`);
        try {
            const result = await this.workspaceService.getWorkspaceInfoForTelegramGroup(telegramChatId);
            if (!result.ok) {
                this.logger.log(`Workspace-контекст не найден для /workspace: chatId=${telegramChatId}`);
                await ctx.reply('Эта группа не подключена ни к одному рабочему пространству.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            const createdAt = new Date(result.workspace.createdAt).toLocaleDateString('ru-RU');
            await ctx.reply(`Рабочее пространство: ${result.workspace.name}\n` +
                `Создано: ${createdAt}\n` +
                `Участников: ${result.workspace.membersCount}\n` +
                `Подключённых групп: ${result.workspace.telegramGroupsCount}`, { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
        }
        catch (error) {
            this.logger.error('Ошибка при обработке команды /workspace', error);
            await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
        }
    }
    async handleWhoAmICommand(ctx) {
        if (ctx.chat.type === 'private') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        if (ctx.chat.type === 'channel') {
            return;
        }
        if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        const telegramChatId = ctx.chat.id.toString();
        this.logger.log(`Вызов команды /whoami: chatId=${telegramChatId}, type=${ctx.chat.type}`);
        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) {
            await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        try {
            const result = await this.workspaceService.getWhoAmIForTelegramGroup({
                telegramChatId,
                telegramId,
            });
            if (!result.ok) {
                if (result.reason === 'NO_CONTEXT') {
                    this.logger.log(`Workspace-контекст не найден для /whoami: chatId=${telegramChatId}`);
                    await ctx.reply('Эта группа не подключена ни к одному рабочему пространству.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                    return;
                }
                if (result.reason === 'USER_NOT_REGISTERED') {
                    await ctx.reply('Вы пока не зарегистрированы в системе.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                    return;
                }
                await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            if (!result.isMember) {
                await ctx.reply(`Рабочее пространство: ${result.workspaceName}\n` +
                    'Вы не состоите в этом рабочем пространстве.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            await ctx.reply(`Рабочее пространство: ${result.workspaceName}\n` +
                `Роль: ${result.role}`, { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
        }
        catch (error) {
            this.logger.error('Ошибка при обработке команды /whoami', error);
            await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
        }
    }
    async handleConnectCommand(ctx) {
        if (ctx.chat.type === 'private') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        if (ctx.chat.type === 'channel') {
            return;
        }
        if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
            return;
        }
        const telegramId = ctx.from?.id?.toString();
        if (!telegramId)
            return;
        const telegramChatId = ctx.chat.id.toString();
        const title = ctx.chat.title ?? 'Группа';
        const type = ctx.chat.type;
        this.logger.log(`Попытка привязки Telegram-группы: chatId=${telegramChatId}, type=${type}`);
        try {
            const result = await this.workspaceService.connectTelegramGroup({
                telegramId,
                telegramChatId,
                title,
                type,
            });
            if (!result.ok) {
                if (result.reason === 'NOT_OWNER') {
                    await ctx.reply('Только владелец рабочего пространства может подключить группу.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                    return;
                }
                if (result.reason === 'MULTIPLE_WORKSPACES') {
                    await ctx.reply('У вас несколько рабочих пространств. Подключение через группу пока невозможно.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                    return;
                }
                if (result.reason === 'ALREADY_CONNECTED') {
                    await ctx.reply('Эта группа уже подключена к рабочему пространству.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                    return;
                }
                await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
                return;
            }
            this.logger.log(`Telegram-группа успешно привязана: chatId=${telegramChatId}`);
            await ctx.reply('Группа успешно подключена к рабочему пространству.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
        }
        catch (error) {
            this.logger.error('Ошибка при обработке команды /connect', error);
            await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
        }
    }
};
exports.EventSeriesFlow = EventSeriesFlow;
exports.EventSeriesFlow = EventSeriesFlow = EventSeriesFlow_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        workspace_service_1.WorkspaceService,
        user_service_1.UserService,
        prisma_service_1.PrismaService,
        events_service_1.EventsService])
], EventSeriesFlow);
