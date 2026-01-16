import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { ConfigService } from '@nestjs/config';
import { WorkspaceService } from '../workspace/workspace.service';
import { UserService } from '../user/user.service';

@Injectable()
export class BotFlowDispatcher {
    private readonly logger = new Logger(BotFlowDispatcher.name);
    private readonly pendingWorkspaceCreation = new Map<string, boolean>();

    constructor(
        private readonly userService: UserService,
        private readonly workspaceService: WorkspaceService,
        private readonly configService: ConfigService,
    ) { }

    async onUpdate(ctx: any): Promise<void> {
        const telegramUserId = ctx.from?.id?.toString?.();

        if (!telegramUserId) {
            return;
        }

        if (ctx.chat?.type !== 'private') {
            // На этапах 1–2 вся работа с Workspace идёт через личный чат с ботом
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

        // Любое другое сообщение в личке ведёт к экрану выбора/создания Workspace
        if (this.isAnyUserMessage(ctx)) {
            const pendingKey = this.buildPendingKey(user.id, ctx.chat?.id?.toString());
            if (pendingKey && this.pendingWorkspaceCreation.has(pendingKey)) {
                await this.handleWorkspaceTitleInput(ctx, user.id, pendingKey);
                return;
            }

            await this.showWorkspaceEntry(ctx, user.id);
        }
    }

    private async showWorkspaceEntry(ctx: any, userId: string): Promise<void> {
        const memberships = await this.workspaceService.getUserMemberships(userId);

        if (memberships.length === 0) {
            await this.showNoWorkspace(ctx);
            return;
        }

        if (memberships.length === 1) {
            const membership = memberships[0];
            if ((membership.workspace as any).id) {
                await this.userService.setActiveWorkspace(userId, membership.workspace.id);
            }
            await this.showWorkspaceHome(ctx, {
                userId,
                workspaceId: membership.workspace.id,
                title: membership.workspace.title,
                role: membership.role,
            });
            return;
        }

        await this.showWorkspaceSelector(ctx, memberships.map((m) => ({ id: m.workspace.id, title: m.workspace.title, role: m.role })));
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

            await this.showWorkspaceSelector(ctx, memberships.map((m) => ({ id: m.workspace.id, title: m.workspace.title, role: m.role })));
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
                title: membership.workspace.title,
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

        return `${webappBaseUrl}/?userId=${params.userId}&apiBaseUrl=${encodeURIComponent(webappBaseUrl)}&activeWorkspaceId=${params.activeWorkspaceId}`;
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

            await this.safeReply(ctx, `Создано рабочее пространство: ${workspace.title}`);
            await this.showWorkspaceHome(ctx, {
                userId,
                workspaceId: workspace.id,
                title: workspace.title,
                role: 'OWNER',
            });
        } catch (error) {
            this.logger.error('Ошибка при создании рабочего пространства', error as any);
            await this.safeReply(ctx, 'Не удалось создать рабочее пространство. Попробуйте позже.');
        }
    }
}
