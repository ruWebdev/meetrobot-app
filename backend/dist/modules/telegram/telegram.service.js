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
const bot_flow_dispatcher_service_1 = require("./bot-flow-dispatcher.service");
let TelegramService = TelegramService_1 = class TelegramService {
    configService;
    dispatcher;
    logger = new common_1.Logger(TelegramService_1.name);
    bot;
    constructor(configService, dispatcher) {
        this.configService = configService;
        this.dispatcher = dispatcher;
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
        bot.use(async (ctx, next) => {
            await this.dispatcher.onUpdate(ctx);
            await next();
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
        bot_flow_dispatcher_service_1.BotFlowDispatcher])
], TelegramService);
