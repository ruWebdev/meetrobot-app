import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InlineKeyboard } from 'grammy';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { UserService } from '../../user/user.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { EventsService } from '../../events/events.service';
import { FlowHandler } from './flow-handler';
import { buildExitKeyboard } from './flow-keyboards';

@Injectable()
export class EventSeriesFlow implements FlowHandler {
    private readonly logger = new Logger(EventSeriesFlow.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly workspaceService: WorkspaceService,
        private readonly userService: UserService,
        private readonly prisma: PrismaService,
        private readonly eventsService: EventsService,
    ) { }

    async onEnter(ctx: any): Promise<void> {
        const text =
            'Мероприятия с программой\n\n' +
            'Раздел предназначен для работы с мероприятиями, которые содержат несколько событий.';

        const keyboard = new InlineKeyboard()
            .text('Создать событие', 'event_series:hint:create')
            .row()
            .text('Отметить посещаемость', 'event_series:hint:attendance')
            .row();

        keyboard.text('⬅️ Выйти в главное меню', 'global:exit');

        await ctx.reply(text, { reply_markup: keyboard });
    }

    async onUpdate(ctx: any): Promise<void> {
        const callbackData = ctx.callbackQuery?.data as string | undefined;
        if (callbackData) {
            if (callbackData === 'event_series:hint:create') {
                await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
                await ctx.reply('Создание событий доступно через Web App.', { reply_markup: buildExitKeyboard() });
                return;
            }

            if (callbackData === 'event_series:hint:attendance') {
                await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
                await ctx.reply('Функционал посещаемости временно недоступен.', { reply_markup: buildExitKeyboard() });
                return;
            }
        }

        if (this.isCommand(ctx, 'attendance')) {
            await ctx.reply('Функционал посещаемости временно недоступен.', { reply_markup: buildExitKeyboard() });
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

        await ctx.reply('Используйте кнопки под сообщениями или команду /help.', { reply_markup: buildExitKeyboard() });
    }

    async onExit(ctx: any): Promise<void> {
        return;
    }

    private isCommand(ctx: any, command: string): boolean {
        const text = ctx.message?.text as string | undefined;
        if (!text) return false;
        if (text === `/${command}`) return true;
        if (text.startsWith(`/${command}@`)) return true;
        return false;
    }

    private async handleCreateEventCommand(ctx: any): Promise<void> {
        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) {
            await ctx.reply('Пользователь не зарегистрирован', { reply_markup: buildExitKeyboard() });
            return;
        }

        const user = await this.userService.findByTelegramId(telegramId);
        if (!user) {
            await ctx.reply('Пользователь не зарегистрирован', { reply_markup: buildExitKeyboard() });
            return;
        }

        let workspaceId: string | null = null;

        if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
            const telegramChatId = ctx.chat.id.toString();
            const tgGroup = await this.prisma.telegramGroup.findUnique({
                where: { telegramChatId },
                select: { workspaceId: true },
            });

            workspaceId = tgGroup?.workspaceId ?? null;
        } else if (ctx.chat.type === 'private') {
            const memberships = await this.prisma.workspaceMember.findMany({
                where: { userId: user.id },
                select: { workspaceId: true },
                take: 2,
            });

            if (memberships.length === 0) {
                await ctx.reply('Нет доступных рабочих пространств', { reply_markup: buildExitKeyboard() });
                return;
            }

            if (memberships.length > 1) {
                await ctx.reply('У вас несколько рабочих пространств. Создание событий из личного чата пока недоступно.', { reply_markup: buildExitKeyboard() });
                return;
            }

            workspaceId = memberships[0].workspaceId;
        } else {
            return;
        }

        if (!workspaceId) {
            await ctx.reply('Рабочее пространство не найдено', { reply_markup: buildExitKeyboard() });
            return;
        }

        const workspaceExists = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { id: true },
        });

        if (!workspaceExists) {
            await ctx.reply('Рабочее пространство не найдено', { reply_markup: buildExitKeyboard() });
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
            await ctx.reply('Вы не состоите в этом рабочем пространстве', { reply_markup: buildExitKeyboard() });
            return;
        }

        if (membership.role !== 'OWNER') {
            this.logger.log(`[Telegram] Deny open WebApp (not OWNER) for user ${user.id}, workspace ${workspaceId}`);
            await ctx.reply('Только владелец рабочего пространства может создавать события', { reply_markup: buildExitKeyboard() });
            return;
        }

        const webappHost = this.configService.get<string>('WEBAPP_HOST');
        if (!webappHost) {
            await ctx.reply('Рабочее пространство не найдено', { reply_markup: buildExitKeyboard() });
            return;
        }

        const trimmedWebappHost = webappHost.trim().replace(/\/+$/, '');
        const webappBaseUrl =
            trimmedWebappHost.startsWith('http://') || trimmedWebappHost.startsWith('https://')
                ? trimmedWebappHost
                : `https://${trimmedWebappHost}`;

        const url = `${webappBaseUrl}/workspaces/${workspaceId}/events/create?userId=${user.id}&apiBaseUrl=${encodeURIComponent(webappBaseUrl)}`;
        const keyboard = new InlineKeyboard().webApp('Создать событие', url);

        if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
            const fromId = ctx.from?.id;
            if (!fromId) {
                await ctx.reply('Не удалось определить пользователя. Попробуйте позже.', { reply_markup: buildExitKeyboard() });
                return;
            }

            try {
                await ctx.api.sendMessage(fromId, 'Откройте форму создания события:', {
                    reply_markup: keyboard,
                });
                this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
                await ctx.reply('Я отправил кнопку для открытия Web App вам в личные сообщения.', { reply_markup: buildExitKeyboard() });
                return;
            } catch {
                this.logger.log(`[Telegram] Failed to send WebApp button to DM for user ${user.id}, workspace ${workspaceId}`);
                await ctx.reply('Не удалось отправить кнопку в личные сообщения. Откройте чат с ботом и попробуйте снова.', { reply_markup: buildExitKeyboard() });
                return;
            }
        }

        this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
        await ctx.reply('Откройте форму создания события:', {
            reply_markup: keyboard,
        });
    }

    private async handleWorkspaceCommand(ctx: any): Promise<void> {
        if (ctx.chat.type === 'private') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: buildExitKeyboard() });
            return;
        }

        if (ctx.chat.type === 'channel') {
            return;
        }

        if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: buildExitKeyboard() });
            return;
        }

        const telegramChatId = ctx.chat.id.toString();
        this.logger.log(`Вызов команды /workspace: chatId=${telegramChatId}, type=${ctx.chat.type}`);

        try {
            const result = await this.workspaceService.getWorkspaceInfoForTelegramGroup(telegramChatId);
            if (!result.ok) {
                this.logger.log(`Workspace-контекст не найден для /workspace: chatId=${telegramChatId}`);
                await ctx.reply('Эта группа не подключена ни к одному рабочему пространству.', { reply_markup: buildExitKeyboard() });
                return;
            }

            const createdAt = new Date(result.workspace.createdAt).toLocaleDateString('ru-RU');

            await ctx.reply(
                `Рабочее пространство: ${result.workspace.name}\n` +
                `Создано: ${createdAt}\n` +
                `Участников: ${result.workspace.membersCount}\n` +
                `Подключённых групп: ${result.workspace.telegramGroupsCount}`,
                { reply_markup: buildExitKeyboard() },
            );
        } catch (error) {
            this.logger.error('Ошибка при обработке команды /workspace', error as any);
            await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: buildExitKeyboard() });
        }
    }

    private async handleWhoAmICommand(ctx: any): Promise<void> {
        if (ctx.chat.type === 'private') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: buildExitKeyboard() });
            return;
        }

        if (ctx.chat.type === 'channel') {
            return;
        }

        if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: buildExitKeyboard() });
            return;
        }

        const telegramChatId = ctx.chat.id.toString();
        this.logger.log(`Вызов команды /whoami: chatId=${telegramChatId}, type=${ctx.chat.type}`);

        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) {
            await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: buildExitKeyboard() });
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
                    await ctx.reply('Эта группа не подключена ни к одному рабочему пространству.', { reply_markup: buildExitKeyboard() });
                    return;
                }

                if (result.reason === 'USER_NOT_REGISTERED') {
                    await ctx.reply('Вы пока не зарегистрированы в системе.', { reply_markup: buildExitKeyboard() });
                    return;
                }

                await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: buildExitKeyboard() });
                return;
            }

            if (!result.isMember) {
                await ctx.reply(
                    `Рабочее пространство: ${result.workspaceName}\n` +
                    'Вы не состоите в этом рабочем пространстве.',
                    { reply_markup: buildExitKeyboard() },
                );
                return;
            }

            await ctx.reply(
                `Рабочее пространство: ${result.workspaceName}\n` +
                `Роль: ${result.role}`,
                { reply_markup: buildExitKeyboard() },
            );
        } catch (error) {
            this.logger.error('Ошибка при обработке команды /whoami', error as any);
            await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: buildExitKeyboard() });
        }
    }

    private async handleConnectCommand(ctx: any): Promise<void> {
        if (ctx.chat.type === 'private') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: buildExitKeyboard() });
            return;
        }

        if (ctx.chat.type === 'channel') {
            return;
        }

        if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
            await ctx.reply('Эта команда доступна только в группе.', { reply_markup: buildExitKeyboard() });
            return;
        }

        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) return;

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
                    await ctx.reply('Только владелец рабочего пространства может подключить группу.', { reply_markup: buildExitKeyboard() });
                    return;
                }
                if (result.reason === 'MULTIPLE_WORKSPACES') {
                    await ctx.reply('У вас несколько рабочих пространств. Подключение через группу пока невозможно.', { reply_markup: buildExitKeyboard() });
                    return;
                }
                if (result.reason === 'ALREADY_CONNECTED') {
                    await ctx.reply('Эта группа уже подключена к рабочему пространству.', { reply_markup: buildExitKeyboard() });
                    return;
                }

                await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: buildExitKeyboard() });
                return;
            }

            this.logger.log(`Telegram-группа успешно привязана: chatId=${telegramChatId}`);
            await ctx.reply('Группа успешно подключена к рабочему пространству.', { reply_markup: buildExitKeyboard() });
        } catch (error) {
            this.logger.error('Ошибка при обработке команды /connect', error as any);
            await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.', { reply_markup: buildExitKeyboard() });
        }
    }
}
