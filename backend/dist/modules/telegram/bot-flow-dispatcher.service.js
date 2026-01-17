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
var BotFlowDispatcher_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotFlowDispatcher = void 0;
const common_1 = require("@nestjs/common");
const grammy_1 = require("grammy");
const config_1 = require("@nestjs/config");
const workspace_service_1 = require("../workspace/workspace.service");
const user_service_1 = require("../user/user.service");
const user_session_service_1 = require("./user-session.service");
const events_service_1 = require("../events/events.service");
let BotFlowDispatcher = BotFlowDispatcher_1 = class BotFlowDispatcher {
    userService;
    workspaceService;
    configService;
    userSessionService;
    eventsService;
    logger = new common_1.Logger(BotFlowDispatcher_1.name);
    pendingWorkspaceCreation = new Map();
    constructor(userService, workspaceService, configService, userSessionService, eventsService) {
        this.userService = userService;
        this.workspaceService = workspaceService;
        this.configService = configService;
        this.userSessionService = userSessionService;
        this.eventsService = eventsService;
    }
    async onUpdate(ctx) {
        const telegramUserId = ctx.from?.id?.toString?.();
        if (!telegramUserId) {
            return;
        }
        if (ctx.chat?.type !== 'private') {
            if (this.isCommand(ctx, 'start')) {
                await this.safeReply(ctx, 'Для управления рабочими пространствами откройте личный чат со мной и отправьте команду /start.');
            }
            return;
        }
        const profile = {
            firstName: ctx.from?.first_name ?? null,
            lastName: ctx.from?.last_name ?? null,
            username: ctx.from?.username ?? null,
        };
        const user = await this.userService.findOrCreateUser(telegramUserId, profile);
        const callbackData = ctx.callbackQuery?.data;
        if (callbackData) {
            await this.handleCallback(ctx, user.id, callbackData);
            return;
        }
        const isStart = this.isCommand(ctx, 'start');
        const isHelp = this.isCommand(ctx, 'help');
        if (isHelp) {
            this.clearPendingWorkspaceCreation(user.id, ctx.chat?.id?.toString());
            await this.showHelp(ctx);
            return;
        }
        if (isStart) {
            this.clearPendingWorkspaceCreation(user.id, ctx.chat?.id?.toString());
            await this.showWorkspaceEntry(ctx, user.id);
            return;
        }
        if (this.isAnyUserMessage(ctx)) {
            const pendingKey = this.buildPendingKey(user.id, ctx.chat?.id?.toString());
            if (pendingKey && this.pendingWorkspaceCreation.has(pendingKey)) {
                await this.handleWorkspaceTitleInput(ctx, user.id, pendingKey);
                return;
            }
            const activeWorkspaceId = user.activeWorkspaceId ?? null;
            if (activeWorkspaceId) {
                const session = await this.userSessionService.getOrCreate({
                    telegramUserId,
                    telegramChatId: ctx.chat?.id?.toString() ?? '',
                    workspaceId: activeWorkspaceId,
                });
                if (session.eventDraftStep) {
                    await this.handleEventDraftInput(ctx, user.id, session);
                    return;
                }
            }
            if (this.isCommand(ctx, 'event') || this.isCommand(ctx, 'create_event')) {
                await this.startEventDraft(ctx, user.id, user.activeWorkspaceId ?? null);
                return;
            }
            await this.showWorkspaceEntry(ctx, user.id);
        }
    }
    async handleEventCallback(ctx, userId, callbackData) {
        const parts = callbackData.split(':');
        const eventId = parts[1];
        const action = parts[2];
        const value = parts[3];
        if (!eventId || !action)
            return;
        if (action === 'response' && value) {
            await ctx.answerCallbackQuery({ text: 'Ответ принят', show_alert: false });
            try {
                await this.eventsService.respondToEvent({
                    userId,
                    eventId,
                    status: value,
                });
                await ctx.reply('Ваш ответ записан. Спасибо!');
            }
            catch (error) {
                this.logger.warn('Ошибка ответа на приглашение', error);
                await ctx.reply('Не удалось обновить статус участия. Попробуйте позже.');
            }
            return;
        }
        if (action === 'invite') {
            await ctx.answerCallbackQuery({ text: 'Приглашение участников', show_alert: false });
            try {
                const members = await this.workspaceService.getUserMemberships(userId);
                const participantIds = members.map((m) => m.userId);
                await this.eventsService.inviteParticipants({ userId, eventId, participantIds });
                await ctx.reply('Приглашения отправлены участникам.');
            }
            catch (error) {
                this.logger.warn('Ошибка отправки приглашений', error);
                await ctx.reply('Не удалось отправить приглашения. Проверьте статус события.');
            }
            return;
        }
        if (action === 'cancel') {
            await ctx.answerCallbackQuery({ text: 'Отмена события', show_alert: false });
            try {
                await this.eventsService.cancelEvent({ userId, eventId });
                await ctx.reply('Событие отменено.');
            }
            catch (error) {
                this.logger.warn('Ошибка отмены события', error);
                await ctx.reply('Не удалось отменить событие.');
            }
            return;
        }
        if (action === 'create' && value) {
            await ctx.answerCallbackQuery({ text: 'Создание события', show_alert: false });
            if (value === 'confirm') {
                await this.finalizeEventDraft(ctx, userId);
                return;
            }
            if (value === 'cancel') {
                await this.cancelEventDraft(ctx, userId);
                return;
            }
        }
    }
    async startEventDraft(ctx, userId, workspaceId) {
        if (!workspaceId) {
            await this.safeReply(ctx, 'Сначала выберите активное рабочее пространство.');
            return;
        }
        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({ userId, workspaceId });
        if (!membership) {
            await this.safeReply(ctx, 'Вы не состоите в активном рабочем пространстве.');
            return;
        }
        const session = await this.userSessionService.getOrCreate({
            telegramUserId: ctx.from.id.toString(),
            telegramChatId: ctx.chat.id.toString(),
            workspaceId,
        });
        session.eventDraft = { workspaceId };
        session.eventDraftStep = 'title';
        session.updatedAt = new Date();
        await this.userSessionService.save(session);
        await this.safeReply(ctx, 'Введите название события.');
    }
    async handleEventDraftInput(ctx, userId, session) {
        const text = (ctx.message?.text ?? '').trim();
        if (!text) {
            await this.safeReply(ctx, 'Сообщение не может быть пустым.');
            return;
        }
        const draft = session.eventDraft ?? {};
        if (session.eventDraftStep === 'title') {
            draft.title = text;
            session.eventDraft = draft;
            session.eventDraftStep = 'description';
            session.updatedAt = new Date();
            await this.userSessionService.save(session);
            await this.safeReply(ctx, 'Введите описание события или отправьте «-», чтобы пропустить.');
            return;
        }
        if (session.eventDraftStep === 'description') {
            draft.description = text === '-' ? null : text;
            session.eventDraft = draft;
            session.eventDraftStep = 'startAt';
            session.updatedAt = new Date();
            await this.userSessionService.save(session);
            await this.safeReply(ctx, 'Введите дату и время начала (ДД.ММ.ГГГГ ЧЧ:ММ).');
            return;
        }
        if (session.eventDraftStep === 'startAt') {
            const parsed = this.parseDateTime(text);
            if (!parsed) {
                await this.safeReply(ctx, 'Не удалось распознать дату/время. Формат: ДД.ММ.ГГГГ ЧЧ:ММ');
                return;
            }
            draft.startAt = parsed.toISOString();
            session.eventDraft = draft;
            session.eventDraftStep = 'endAt';
            session.updatedAt = new Date();
            await this.userSessionService.save(session);
            await this.safeReply(ctx, 'Введите дату и время окончания (ДД.ММ.ГГГГ ЧЧ:ММ).');
            return;
        }
        if (session.eventDraftStep === 'endAt') {
            const parsed = this.parseDateTime(text);
            if (!parsed) {
                await this.safeReply(ctx, 'Не удалось распознать дату/время. Формат: ДД.ММ.ГГГГ ЧЧ:ММ');
                return;
            }
            const startAt = draft.startAt ? new Date(draft.startAt) : null;
            if (startAt && parsed <= startAt) {
                await this.safeReply(ctx, 'Время окончания должно быть позже времени начала.');
                return;
            }
            draft.endAt = parsed.toISOString();
            session.eventDraft = draft;
            session.eventDraftStep = 'confirm';
            session.updatedAt = new Date();
            await this.userSessionService.save(session);
            const summary = `Проверьте данные:\n` +
                `Название: ${draft.title}\n` +
                `Описание: ${draft.description ?? '—'}\n` +
                `Начало: ${draft.startAt ? new Date(draft.startAt).toLocaleString('ru-RU') : '—'}\n` +
                `Окончание: ${draft.endAt ? new Date(draft.endAt).toLocaleString('ru-RU') : '—'}`;
            const keyboard = new grammy_1.InlineKeyboard()
                .text('Создать', 'event:create:confirm')
                .text('Отменить', 'event:create:cancel');
            await this.safeReply(ctx, summary, keyboard);
            return;
        }
    }
    async finalizeEventDraft(ctx, userId) {
        const workspaceId = ctx.chat?.id?.toString() ?? '';
        const session = await this.userSessionService.getOrCreate({
            telegramUserId: ctx.from.id.toString(),
            telegramChatId: ctx.chat.id.toString(),
            workspaceId,
        });
        const draft = session.eventDraft;
        if (!draft?.workspaceId || !draft.title || !draft.startAt || !draft.endAt) {
            await this.safeReply(ctx, 'Данные для создания события не найдены. Начните заново.');
            await this.cancelEventDraft(ctx, userId);
            return;
        }
        try {
            const created = await this.eventsService.createEvent({
                userId,
                dto: {
                    workspaceId: draft.workspaceId,
                    title: draft.title,
                    description: draft.description ?? undefined,
                    startAt: draft.startAt,
                    endAt: draft.endAt,
                },
            });
            session.eventDraft = null;
            session.eventDraftStep = null;
            session.updatedAt = new Date();
            await this.userSessionService.save(session);
            const keyboard = new grammy_1.InlineKeyboard()
                .text('Пригласить участников', `event:${created.id}:invite`)
                .text('Отменить событие', `event:${created.id}:cancel`);
            await this.safeReply(ctx, 'Событие создано в статусе draft. Отправьте приглашения, когда будете готовы.', keyboard);
        }
        catch (error) {
            this.logger.warn('Ошибка создания события', error);
            await this.safeReply(ctx, 'Не удалось создать событие. Попробуйте позже.');
        }
    }
    async cancelEventDraft(ctx, userId) {
        const session = await this.userSessionService.getOrCreate({
            telegramUserId: ctx.from.id.toString(),
            telegramChatId: ctx.chat.id.toString(),
            workspaceId: ctx.chat.id.toString(),
        });
        session.eventDraft = null;
        session.eventDraftStep = null;
        session.updatedAt = new Date();
        await this.userSessionService.save(session);
        await this.safeReply(ctx, 'Создание события отменено.');
    }
    parseDateTime(value) {
        const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
        if (!match)
            return null;
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        const hours = Number(match[4]);
        const minutes = Number(match[5]);
        const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
        if (Number.isNaN(date.getTime()))
            return null;
        return date;
    }
    async showWorkspaceEntry(ctx, userId) {
        const memberships = await this.workspaceService.getUserMemberships(userId);
        if (memberships.length === 0) {
            await this.showNoWorkspace(ctx);
            return;
        }
        if (memberships.length === 1) {
            const membership = memberships[0];
            const workspaceTitle = membership.workspace.title ?? membership.workspace.name ?? 'Рабочее пространство';
            if (membership.workspace.id) {
                await this.userService.setActiveWorkspace(userId, membership.workspace.id);
            }
            await this.showWorkspaceHome(ctx, {
                userId,
                workspaceId: membership.workspace.id,
                title: workspaceTitle,
                role: membership.role,
            });
            return;
        }
        await this.showWorkspaceSelector(ctx, memberships.map((m) => ({
            id: m.workspace.id,
            title: m.workspace.title ?? m.workspace.name ?? 'Рабочее пространство',
            role: m.role,
        })));
    }
    async showNoWorkspace(ctx) {
        const text = 'У вас ещё нет ни одного рабочего пространства.\n\n' +
            'Вы можете создать своё первое рабочее пространство. Все дальнейшие действия в системе будут выполняться только в его контексте.';
        const keyboard = new grammy_1.InlineKeyboard().text('Создать рабочее пространство', 'ws:create');
        await this.safeReply(ctx, text, keyboard);
    }
    async showWorkspaceHome(ctx, params) {
        const text = `Активное рабочее пространство: ${params.title}\n` +
            `Ваша роль: ${params.role}`;
        const keyboard = new grammy_1.InlineKeyboard();
        const webAppUrl = this.buildWebAppUrl({
            userId: params.userId,
            activeWorkspaceId: params.workspaceId,
        });
        if (webAppUrl) {
            keyboard.webApp('Открыть рабочее пространство', webAppUrl).row();
        }
        keyboard.text('Сменить рабочее пространство', 'ws:change');
        await this.safeReply(ctx, text, keyboard);
    }
    async showWorkspaceSelector(ctx, workspaces) {
        const text = 'Выберите рабочее пространство, с которым хотите работать:';
        const keyboard = new grammy_1.InlineKeyboard();
        for (const ws of workspaces) {
            keyboard.text(`${ws.title} (${ws.role})`, `ws:select:${ws.id}`).row();
        }
        await this.safeReply(ctx, text, keyboard);
    }
    async handleCallback(ctx, userId, callbackData) {
        if (callbackData.startsWith('event:')) {
            await this.handleEventCallback(ctx, userId, callbackData);
            return;
        }
        if (callbackData === 'ws:create') {
            await ctx.answerCallbackQuery({ text: 'Создание рабочего пространства', show_alert: false });
            const memberships = await this.workspaceService.getUserMemberships(userId);
            if (memberships.length > 0) {
                await this.showWorkspaceEntry(ctx, userId);
                return;
            }
            const pendingKey = this.buildPendingKey(userId, ctx.chat?.id?.toString());
            if (!pendingKey) {
                await this.safeReply(ctx, 'Не удалось продолжить создание рабочего пространства. Попробуйте позже.');
                return;
            }
            this.pendingWorkspaceCreation.set(pendingKey, true);
            await this.safeReply(ctx, 'Введите название рабочего пространства.');
            return;
        }
        if (callbackData === 'ws:change') {
            await ctx.answerCallbackQuery({ text: 'Выбор рабочего пространства', show_alert: false });
            const memberships = await this.workspaceService.getUserMemberships(userId);
            if (memberships.length === 0) {
                await this.showNoWorkspace(ctx);
                return;
            }
            await this.showWorkspaceSelector(ctx, memberships.map((m) => ({
                id: m.workspace.id,
                title: m.workspace.title ?? m.workspace.name ?? 'Рабочее пространство',
                role: m.role,
            })));
            return;
        }
        if (callbackData.startsWith('ws:select:')) {
            await ctx.answerCallbackQuery({ text: 'Рабочее пространство выбрано', show_alert: false });
            const workspaceId = callbackData.slice('ws:select:'.length);
            const membership = await this.workspaceService.ensureUserMembershipInWorkspace({ userId, workspaceId });
            if (!membership) {
                await this.safeReply(ctx, 'Вы не состоите в этом рабочем пространстве.');
                return;
            }
            await this.userService.setActiveWorkspace(userId, workspaceId);
            await this.showWorkspaceHome(ctx, {
                userId,
                workspaceId: membership.workspace.id,
                title: membership.workspace.title ?? membership.workspace.name ?? 'Рабочее пространство',
                role: membership.role,
            });
            return;
        }
    }
    async showHelp(ctx) {
        const text = 'Справка\n\n' +
            'Бот помогает выбрать и переключать рабочие пространства.\n\n' +
            'Правила:\n' +
            '— все сущности системы существуют только внутри рабочего пространства;\n' +
            '— у пользователя всегда может быть выбрано только одно активное рабочее пространство;\n' +
            '— без выбранного рабочего пространства любые действия, кроме выбора/создания рабочего пространства, запрещены.';
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
    buildWebAppUrl(params) {
        const webappHost = this.configService.get('WEBAPP_HOST');
        if (!webappHost) {
            this.logger.warn('Переменная WEBAPP_HOST не задана. Кнопка Web App будет скрыта.');
            return null;
        }
        const trimmedWebappHost = webappHost.trim().replace(/\/+$/, '');
        const webappBaseUrl = trimmedWebappHost.startsWith('http://') || trimmedWebappHost.startsWith('https://')
            ? trimmedWebappHost
            : `https://${trimmedWebappHost}`;
        const apiBaseUrl = this.configService.get('API_BASE_URL')?.trim().replace(/\/+$/, '') ?? webappBaseUrl;
        return `${webappBaseUrl}/?userId=${params.userId}&apiBaseUrl=${encodeURIComponent(apiBaseUrl)}&activeWorkspaceId=${params.activeWorkspaceId}`;
    }
    buildPendingKey(userId, chatId) {
        if (!chatId)
            return null;
        return `${userId}:${chatId}`;
    }
    clearPendingWorkspaceCreation(userId, chatId) {
        const key = this.buildPendingKey(userId, chatId);
        if (!key)
            return;
        this.pendingWorkspaceCreation.delete(key);
    }
    async handleWorkspaceTitleInput(ctx, userId, pendingKey) {
        const title = (ctx.message?.text ?? '').trim();
        if (!title) {
            await this.safeReply(ctx, 'Название не может быть пустым. Введите другое название.');
            return;
        }
        try {
            const workspace = await this.workspaceService.createWorkspace(userId, title);
            this.pendingWorkspaceCreation.delete(pendingKey);
            const workspaceTitle = workspace.title ?? workspace.name ?? 'Рабочее пространство';
            await this.safeReply(ctx, `Создано рабочее пространство: ${workspaceTitle}`);
            await this.showWorkspaceHome(ctx, {
                userId,
                workspaceId: workspace.id,
                title: workspaceTitle,
                role: 'OWNER',
            });
        }
        catch (error) {
            this.logger.error('Ошибка при создании рабочего пространства', error);
            await this.safeReply(ctx, 'Не удалось создать рабочее пространство. Попробуйте позже.');
        }
    }
};
exports.BotFlowDispatcher = BotFlowDispatcher;
exports.BotFlowDispatcher = BotFlowDispatcher = BotFlowDispatcher_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService,
        workspace_service_1.WorkspaceService,
        config_1.ConfigService,
        user_session_service_1.UserSessionService,
        events_service_1.EventsService])
], BotFlowDispatcher);
