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
var TelegramService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const grammy_1 = require("grammy");
const workspace_service_1 = require("../workspace/workspace.service");
const user_service_1 = require("../user/user.service");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let TelegramService = TelegramService_1 = class TelegramService {
    configService;
    workspaceService;
    userService;
    prisma;
    logger = new common_1.Logger(TelegramService_1.name);
    bot;
    constructor(configService, workspaceService, userService, prisma) {
        this.configService = configService;
        this.workspaceService = workspaceService;
        this.userService = userService;
        this.prisma = prisma;
        const token = this.configService.get('TELEGRAM_BOT_TOKEN');
        if (!token) {
            this.logger.error('Переменная окружения TELEGRAM_BOT_TOKEN не задана');
            return;
        }
        this.bot = new grammy_1.Bot(token);
    }
    async onModuleInit() {
        if (!this.bot)
            return;
        this.setupHandlers();
        this.logger.log('Обработчики Telegram-бота инициализированы для webhook');
    }
    setupHandlers() {
        const bot = this.bot;
        if (!bot)
            return;
        bot.command('create_event', async (ctx) => {
            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) {
                return ctx.reply('Пользователь не зарегистрирован');
            }
            const user = await this.userService.findByTelegramId(telegramId);
            if (!user) {
                return ctx.reply('Пользователь не зарегистрирован');
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
                });
                if (memberships.length === 0) {
                    return ctx.reply('Нет доступных рабочих пространств');
                }
                if (memberships.length > 1) {
                    return ctx.reply('Пожалуйста, выберите рабочее пространство');
                }
                workspaceId = memberships[0].workspaceId;
            }
            else {
                return;
            }
            if (!workspaceId) {
                return ctx.reply('Рабочее пространство не найдено');
            }
            const workspaceExists = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { id: true },
            });
            if (!workspaceExists) {
                return ctx.reply('Рабочее пространство не найдено');
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
                return ctx.reply('Вы не состоите в этом рабочем пространстве');
            }
            if (membership.role !== 'OWNER') {
                this.logger.log(`[Telegram] Deny open WebApp (not OWNER) for user ${user.id}, workspace ${workspaceId}`);
                return ctx.reply('Только владелец рабочего пространства может создавать события');
            }
            const webappHost = this.configService.get('WEBAPP_HOST');
            if (!webappHost) {
                return ctx.reply('Рабочее пространство не найдено');
            }
            const trimmedWebappHost = webappHost.trim().replace(/\/+$/, '');
            const webappBaseUrl = trimmedWebappHost.startsWith('http://') || trimmedWebappHost.startsWith('https://')
                ? trimmedWebappHost
                : `https://${trimmedWebappHost}`;
            const url = `${webappBaseUrl}/workspaces/${workspaceId}/events/create?userId=${user.id}`;
            const keyboard = new grammy_1.InlineKeyboard().webApp('Создать событие', url);
            // В группах Telegram может отклонять web_app inline-кнопки (BUTTON_TYPE_INVALID).
            // Чтобы не ломать сценарий, в группе отправляем кнопку в личные сообщения.
            if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
                const fromId = ctx.from?.id;
                if (!fromId) {
                    return ctx.reply('Не удалось определить пользователя. Попробуйте позже.');
                }
                try {
                    await bot.api.sendMessage(fromId, 'Откройте форму создания события:', {
                        reply_markup: keyboard,
                    });
                    this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
                    return ctx.reply('Я отправил кнопку для открытия Web App вам в личные сообщения.');
                }
                catch {
                    this.logger.log(`[Telegram] Failed to send WebApp button to DM for user ${user.id}, workspace ${workspaceId}`);
                    return ctx.reply('Не удалось отправить кнопку в личные сообщения. Откройте чат с ботом и попробуйте снова.');
                }
            }
            this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
            return ctx.reply('Откройте форму создания события:', {
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
                    return ctx.reply('Эта группа не подключена ни к одному рабочему пространству.');
                }
                const createdAt = new Date(result.workspace.createdAt).toLocaleDateString('ru-RU');
                return ctx.reply(`Рабочее пространство: ${result.workspace.name}\n` +
                    `Создано: ${createdAt}\n` +
                    `Участников: ${result.workspace.membersCount}\n` +
                    `Подключённых групп: ${result.workspace.telegramGroupsCount}`);
            }
            catch (error) {
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
                        return ctx.reply('Эта группа не подключена ни к одному рабочему пространству.');
                    }
                    if (result.reason === 'USER_NOT_REGISTERED') {
                        return ctx.reply('Вы пока не зарегистрированы в системе.');
                    }
                    return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
                }
                if (!result.isMember) {
                    return ctx.reply(`Рабочее пространство: ${result.workspaceName}\n` +
                        'Вы не состоите в этом рабочем пространстве.');
                }
                return ctx.reply(`Рабочее пространство: ${result.workspaceName}\n` +
                    `Роль: ${result.role}`);
            }
            catch (error) {
                this.logger.error('Ошибка при обработке команды /whoami', error);
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });
        bot.command('start', async (ctx) => {
            if (ctx.chat.type !== 'private') {
                return ctx.reply('Создание рабочего пространства доступно только в личном чате с ботом.');
            }
            const telegramId = ctx.from?.id.toString();
            if (!telegramId)
                return;
            try {
                const result = await this.workspaceService.onboardFromTelegram({
                    telegramId,
                    firstName: ctx.from?.first_name ?? null,
                });
                if (!result.created) {
                    return ctx.reply('Рабочее пространство уже создано.');
                }
                return ctx.reply(`Рабочее пространство «${result.workspaceName}» создано. Вы назначены владельцем.`);
            }
            catch (error) {
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
                        return ctx.reply('Только владелец рабочего пространства может подключить группу.');
                    }
                    if (result.reason === 'MULTIPLE_WORKSPACES') {
                        return ctx.reply('У вас несколько рабочих пространств. Подключение через группу пока невозможно.');
                    }
                    if (result.reason === 'ALREADY_CONNECTED') {
                        return ctx.reply('Эта группа уже подключена к рабочему пространству.');
                    }
                    return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
                }
                this.logger.log(`Telegram-группа успешно привязана: chatId=${telegramChatId}`);
                return ctx.reply('Группа успешно подключена к рабочему пространству.');
            }
            catch (error) {
                this.logger.error('Ошибка при обработке команды /connect', error);
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });
    }
    getBot() {
        if (!this.bot) {
            throw new Error('Telegram-бот не инициализирован (не задан TELEGRAM_BOT_TOKEN)');
        }
        return this.bot;
    }
};
exports.TelegramService = TelegramService;
exports.TelegramService = TelegramService = TelegramService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        workspace_service_1.WorkspaceService,
        user_service_1.UserService,
        prisma_service_1.PrismaService])
], TelegramService);
