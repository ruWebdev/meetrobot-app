import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';
import { WorkspaceService } from '../workspace/workspace.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit {
    private readonly logger = new Logger(TelegramService.name);
    private bot?: Bot;

    constructor(
        private configService: ConfigService,
        private workspaceService: WorkspaceService,
        private userService: UserService,
        private prisma: PrismaService,
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        if (!token) {
            this.logger.error('Переменная окружения TELEGRAM_BOT_TOKEN не задана');
            return;
        }
        this.bot = new Bot(token);
    }

    async onModuleInit() {
        if (!this.bot) return;

        this.setupHandlers();

        this.logger.log('Обработчики Telegram-бота инициализированы для webhook');
    }

    private setupHandlers() {
        const bot = this.bot;
        if (!bot) return;

        bot.command('create_event', async (ctx) => {
            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) {
                return ctx.reply('User not registered');
            }

            const user = await this.userService.findByTelegramId(telegramId);
            if (!user) {
                return ctx.reply('User not registered');
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
                });

                if (memberships.length === 0) {
                    return ctx.reply('No workspace available');
                }

                if (memberships.length > 1) {
                    return ctx.reply('Please choose a workspace');
                }

                workspaceId = memberships[0].workspaceId;
            } else {
                return;
            }

            if (!workspaceId) {
                return ctx.reply('Workspace not found');
            }

            const workspaceExists = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { id: true },
            });

            if (!workspaceExists) {
                return ctx.reply('Workspace not found');
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
                return ctx.reply('You are not a member of this workspace');
            }

            if (membership.role !== 'OWNER') {
                this.logger.log(`[Telegram] Deny open WebApp (not OWNER) for user ${user.id}, workspace ${workspaceId}`);
                return ctx.reply('Only workspace owner can create events');
            }

            const webappHost = this.configService.get<string>('WEBAPP_HOST');
            if (!webappHost) {
                return ctx.reply('Workspace not found');
            }

            const trimmedWebappHost = webappHost.trim().replace(/\/+$/, '');
            const webappBaseUrl =
                trimmedWebappHost.startsWith('http://') || trimmedWebappHost.startsWith('https://')
                    ? trimmedWebappHost
                    : `https://${trimmedWebappHost}`;

            const url = `${webappBaseUrl}/workspaces/${workspaceId}/events/create?userId=${user.id}`;
            const keyboard = new InlineKeyboard().webApp('Create Event', url);

            this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
            return ctx.reply('Open event creation form', {
                reply_markup: keyboard,
            });
        });

        bot.command('workspace', async (ctx) => {
            if (ctx.chat.type === 'private') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            if (ctx.chat.type === 'channel') {
                return;
            }

            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            const telegramChatId = ctx.chat.id.toString();
            this.logger.log(`Вызов команды /workspace: chatId=${telegramChatId}, type=${ctx.chat.type}`);

            try {
                const result = await this.workspaceService.getWorkspaceInfoForTelegramGroup(telegramChatId);
                if (!result.ok) {
                    this.logger.log(`Workspace-контекст не найден для /workspace: chatId=${telegramChatId}`);
                    return ctx.reply('Эта группа не подключена ни к одному Workspace.');
                }

                const createdAt = new Date(result.workspace.createdAt).toLocaleDateString('ru-RU');

                return ctx.reply(
                    `Workspace: ${result.workspace.name}\n` +
                    `Создан: ${createdAt}\n` +
                    `Участников: ${result.workspace.membersCount}\n` +
                    `Подключённых групп: ${result.workspace.telegramGroupsCount}`,
                );
            } catch (error) {
                this.logger.error('Ошибка при обработке команды /workspace', error);
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });

        bot.command('whoami', async (ctx) => {
            if (ctx.chat.type === 'private') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            if (ctx.chat.type === 'channel') {
                return;
            }

            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            const telegramChatId = ctx.chat.id.toString();
            this.logger.log(`Вызов команды /whoami: chatId=${telegramChatId}, type=${ctx.chat.type}`);

            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) {
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }

            try {
                const result = await this.workspaceService.getWhoAmIForTelegramGroup({
                    telegramChatId,
                    telegramId,
                });

                if (!result.ok) {
                    if (result.reason === 'NO_CONTEXT') {
                        this.logger.log(`Workspace-контекст не найден для /whoami: chatId=${telegramChatId}`);
                        return ctx.reply('Эта группа не подключена ни к одному Workspace.');
                    }

                    if (result.reason === 'USER_NOT_REGISTERED') {
                        return ctx.reply('Вы пока не зарегистрированы в системе.');
                    }

                    return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
                }

                if (!result.isMember) {
                    return ctx.reply(
                        `Workspace: ${result.workspaceName}\n` +
                        'Вы не состоите в этом Workspace.',
                    );
                }

                return ctx.reply(
                    `Workspace: ${result.workspaceName}\n` +
                    `Роль: ${result.role}`,
                );
            } catch (error) {
                this.logger.error('Ошибка при обработке команды /whoami', error);
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });

        bot.command('start', async (ctx) => {
            if (ctx.chat.type !== 'private') {
                return ctx.reply('Создание рабочего пространства доступно только в личном чате с ботом.');
            }

            const telegramId = ctx.from?.id.toString();
            if (!telegramId) return;

            try {
                const result = await this.workspaceService.onboardFromTelegram({
                    telegramId,
                    firstName: ctx.from?.first_name ?? null,
                });

                if (!result.created) {
                    return ctx.reply('Рабочее пространство уже создано.');
                }

                return ctx.reply(`Рабочее пространство «${result.workspaceName}» создано. Вы назначены владельцем.`);
            } catch (error) {
                this.logger.error('Ошибка при обработке команды /start', error);
                await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });

        bot.command('connect', async (ctx) => {
            if (ctx.chat.type === 'private') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            if (ctx.chat.type === 'channel') {
                return;
            }

            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                return ctx.reply('Эта команда доступна только в группе.');
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
                        return ctx.reply('Только владелец Workspace может подключить группу.');
                    }
                    if (result.reason === 'MULTIPLE_WORKSPACES') {
                        return ctx.reply('У вас несколько Workspace. Подключение через группу пока невозможно.');
                    }
                    if (result.reason === 'ALREADY_CONNECTED') {
                        return ctx.reply('Эта группа уже подключена к Workspace.');
                    }

                    return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
                }

                this.logger.log(`Telegram-группа успешно привязана: chatId=${telegramChatId}`);
                return ctx.reply('Группа успешно подключена к Workspace.');
            } catch (error) {
                this.logger.error('Ошибка при обработке команды /connect', error);
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });
    }

    getBot(): Bot {
        if (!this.bot) {
            throw new Error('Telegram-бот не инициализирован (не задан TELEGRAM_BOT_TOKEN)');
        }

        return this.bot;
    }
}
