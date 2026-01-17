import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { ConfigService } from '@nestjs/config';
import { WorkspaceService } from '../workspace/workspace.service';
import { UserService } from '../user/user.service';
import { UserSessionService } from './user-session.service';
import { UserSession } from './user-session';
import { EventsService } from '../events/events.service';

@Injectable()
export class BotFlowDispatcher {
    private readonly logger = new Logger(BotFlowDispatcher.name);
    private readonly pendingWorkspaceCreation = new Map<string, boolean>();

    constructor(
        private readonly userService: UserService,
        private readonly workspaceService: WorkspaceService,
        private readonly configService: ConfigService,
        private readonly userSessionService: UserSessionService,
        private readonly eventsService: EventsService,
    ) { }

    async onUpdate(ctx: any): Promise<void> {
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

        const callbackData = ctx.callbackQuery?.data as string | undefined;
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

    private async handleEventCallback(ctx: any, userId: string, callbackData: string): Promise<void> {
        const parts = callbackData.split(':');
        const eventId = parts[1];
        const action = parts[2];
        const value = parts[3];

        if (!eventId || !action) return;

        if (action === 'response' && value) {
            await ctx.answerCallbackQuery({ text: 'Ответ принят', show_alert: false });
            try {
                await this.eventsService.respondToEvent({
                    userId,
                    eventId,
                    status: value as 'invited' | 'confirmed' | 'declined' | 'tentative',
                });
                await ctx.reply('Ваш ответ записан. Спасибо!');
            } catch (error) {
                this.logger.warn('Ошибка ответа на приглашение', error as any);
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
            } catch (error) {
                this.logger.warn('Ошибка отправки приглашений', error as any);
                await ctx.reply('Не удалось отправить приглашения. Проверьте статус события.');
            }
            return;
        }

        if (action === 'cancel') {
            await ctx.answerCallbackQuery({ text: 'Отмена события', show_alert: false });
            try {
                await this.eventsService.cancelEvent({ userId, eventId });
                await ctx.reply('Событие отменено.');
            } catch (error) {
                this.logger.warn('Ошибка отмены события', error as any);
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

    private async startEventDraft(ctx: any, userId: string, workspaceId: string | null): Promise<void> {
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

    private async handleEventDraftInput(ctx: any, userId: string, session: UserSession) {
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
            await this.userSessionService.save(session as any);
            await this.safeReply(ctx, 'Введите описание события или отправьте «-», чтобы пропустить.');
            return;
        }

        if (session.eventDraftStep === 'description') {
            draft.description = text === '-' ? null : text;
            session.eventDraft = draft;
            session.eventDraftStep = 'startAt';
            session.updatedAt = new Date();
            await this.userSessionService.save(session as any);
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
            await this.userSessionService.save(session as any);
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
            await this.userSessionService.save(session as any);

            const summary =
                `Проверьте данные:\n` +
                `Название: ${draft.title}\n` +
                `Описание: ${draft.description ?? '—'}\n` +
                `Начало: ${draft.startAt ? new Date(draft.startAt).toLocaleString('ru-RU') : '—'}\n` +
                `Окончание: ${draft.endAt ? new Date(draft.endAt).toLocaleString('ru-RU') : '—'}`;

            const keyboard = new InlineKeyboard()
                .text('Создать', 'event:create:confirm')
                .text('Отменить', 'event:create:cancel');

            await this.safeReply(ctx, summary, keyboard);
            return;
        }
    }

    private async finalizeEventDraft(ctx: any, userId: string): Promise<void> {
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
            await this.userSessionService.save(session as any);

            const keyboard = new InlineKeyboard()
                .text('Пригласить участников', `event:${created.id}:invite`)
                .text('Отменить событие', `event:${created.id}:cancel`);

            await this.safeReply(ctx, 'Событие создано в статусе draft. Отправьте приглашения, когда будете готовы.', keyboard);
        } catch (error) {
            this.logger.warn('Ошибка создания события', error as any);
            await this.safeReply(ctx, 'Не удалось создать событие. Попробуйте позже.');
        }
    }

    private async cancelEventDraft(ctx: any, userId: string): Promise<void> {
        const session = await this.userSessionService.getOrCreate({
            telegramUserId: ctx.from.id.toString(),
            telegramChatId: ctx.chat.id.toString(),
            workspaceId: ctx.chat.id.toString(),
        });
        session.eventDraft = null;
        session.eventDraftStep = null;
        session.updatedAt = new Date();
        await this.userSessionService.save(session as any);
        await this.safeReply(ctx, 'Создание события отменено.');
    }

    private parseDateTime(value: string): Date | null {
        const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
        if (!match) return null;
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        const hours = Number(match[4]);
        const minutes = Number(match[5]);
        const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
        if (Number.isNaN(date.getTime())) return null;
        return date;
    }

    private async showWorkspaceEntry(ctx: any, userId: string): Promise<void> {
        const memberships = await this.workspaceService.getUserMemberships(userId);

        if (memberships.length === 0) {
            await this.showNoWorkspace(ctx);
            return;
        }

        if (memberships.length === 1) {
            const membership = memberships[0];
            const workspaceTitle = (membership.workspace as any).title ?? (membership.workspace as any).name ?? 'Рабочее пространство';
            if ((membership.workspace as any).id) {
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
            title: (m.workspace as any).title ?? (m.workspace as any).name ?? 'Рабочее пространство',
            role: m.role,
        })));
    }

    private async showNoWorkspace(ctx: any): Promise<void> {
        const text =
            'У вас ещё нет ни одного рабочего пространства.\n\n' +
            'Вы можете создать своё первое рабочее пространство. Все дальнейшие действия в системе будут выполняться только в его контексте.';

        const keyboard = new InlineKeyboard().text('Создать рабочее пространство', 'ws:create');

        await this.safeReply(ctx, text, keyboard);
    }

    private async showWorkspaceHome(ctx: any, params: { userId: string; workspaceId: string; title: string; role: string }): Promise<void> {
        const text =
            `Активное рабочее пространство: ${params.title}\n` +
            `Ваша роль: ${params.role}`;

        const keyboard = new InlineKeyboard();
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

    private async showWorkspaceSelector(ctx: any, workspaces: { id: string; title: string; role: string }[]): Promise<void> {
        const text = 'Выберите рабочее пространство, с которым хотите работать:';

        const keyboard = new InlineKeyboard();
        for (const ws of workspaces) {
            keyboard.text(`${ws.title} (${ws.role})`, `ws:select:${ws.id}`).row();
        }

        await this.safeReply(ctx, text, keyboard);
    }

    private async handleCallback(ctx: any, userId: string, callbackData: string): Promise<void> {
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
                title: (m.workspace as any).title ?? (m.workspace as any).name ?? 'Рабочее пространство',
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
                title: (membership.workspace as any).title ?? (membership.workspace as any).name ?? 'Рабочее пространство',
                role: membership.role,
            });
            return;
        }
    }

    private async showHelp(ctx: any): Promise<void> {
        const text =
            'Справка\n\n' +
            'Бот помогает выбрать и переключать рабочие пространства.\n\n' +
            'Правила:\n' +
            '— все сущности системы существуют только внутри рабочего пространства;\n' +
            '— у пользователя всегда может быть выбрано только одно активное рабочее пространство;\n' +
            '— без выбранного рабочего пространства любые действия, кроме выбора/создания рабочего пространства, запрещены.';

        await this.safeReply(ctx, text);
    }

    private async safeReply(ctx: any, text: string, keyboard?: InlineKeyboard): Promise<void> {
        try {
            await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
        } catch {
            try {
                await ctx.api.sendMessage(ctx.chat.id, text, keyboard ? { reply_markup: keyboard } : undefined);
            } catch {
                return;
            }
        }
    }

    private isCallbackQuery(ctx: any): boolean {
        return Boolean(ctx.callbackQuery?.data);
    }

    private isAnyUserMessage(ctx: any): boolean {
        return Boolean(ctx.message);
    }
    private isCommand(ctx: any, command: string): boolean {
        const text = ctx.message?.text as string | undefined;
        if (!text) return false;

        if (text === `/${command}`) return true;
        if (text.startsWith(`/${command}@`)) return true;

        return false;
    }

    private buildWebAppUrl(params: { userId: string; activeWorkspaceId: string }): string | null {
        const webappHost = this.configService.get<string>('WEBAPP_HOST');
        if (!webappHost) {
            this.logger.warn('Переменная WEBAPP_HOST не задана. Кнопка Web App будет скрыта.');
            return null;
        }

        const trimmedWebappHost = webappHost.trim().replace(/\/+$/, '');
        const webappBaseUrl =
            trimmedWebappHost.startsWith('http://') || trimmedWebappHost.startsWith('https://')
                ? trimmedWebappHost
                : `https://${trimmedWebappHost}`;

        const apiBaseUrl = this.configService.get<string>('API_BASE_URL')?.trim().replace(/\/+$/, '') ?? webappBaseUrl;

        return `${webappBaseUrl}/?userId=${params.userId}&apiBaseUrl=${encodeURIComponent(apiBaseUrl)}&activeWorkspaceId=${params.activeWorkspaceId}`;
    }

    private buildPendingKey(userId: string, chatId?: string | null): string | null {
        if (!chatId) return null;
        return `${userId}:${chatId}`;
    }

    private clearPendingWorkspaceCreation(userId: string, chatId?: string | null): void {
        const key = this.buildPendingKey(userId, chatId);
        if (!key) return;
        this.pendingWorkspaceCreation.delete(key);
    }

    private async handleWorkspaceTitleInput(ctx: any, userId: string, pendingKey: string): Promise<void> {
        const title = (ctx.message?.text ?? '').trim();
        if (!title) {
            await this.safeReply(ctx, 'Название не может быть пустым. Введите другое название.');
            return;
        }

        try {
            const workspace = await this.workspaceService.createWorkspace(userId, title);
            this.pendingWorkspaceCreation.delete(pendingKey);

            const workspaceTitle = (workspace as any).title ?? (workspace as any).name ?? 'Рабочее пространство';
            await this.safeReply(ctx, `Создано рабочее пространство: ${workspaceTitle}`);
            await this.showWorkspaceHome(ctx, {
                userId,
                workspaceId: workspace.id,
                title: workspaceTitle,
                role: 'OWNER',
            });
        } catch (error) {
            this.logger.error('Ошибка при создании рабочего пространства', error as any);
            await this.safeReply(ctx, 'Не удалось создать рабочее пространство. Попробуйте позже.');
        }
    }
}
