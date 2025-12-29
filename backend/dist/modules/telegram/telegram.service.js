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
let TelegramService = TelegramService_1 = class TelegramService {
    configService;
    workspaceService;
    logger = new common_1.Logger(TelegramService_1.name);
    bot;
    constructor(configService, workspaceService) {
        this.configService = configService;
        this.workspaceService = workspaceService;
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
        workspace_service_1.WorkspaceService])
], TelegramService);
