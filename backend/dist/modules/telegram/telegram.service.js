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
const user_service_1 = require("../user/user.service");
const workspace_service_1 = require("../workspace/workspace.service");
let TelegramService = TelegramService_1 = class TelegramService {
    configService;
    userService;
    workspaceService;
    logger = new common_1.Logger(TelegramService_1.name);
    bot;
    constructor(configService, userService, workspaceService) {
        this.configService = configService;
        this.userService = userService;
        this.workspaceService = workspaceService;
        const token = this.configService.get('TELEGRAM_BOT_TOKEN');
        if (!token) {
            this.logger.error('TELEGRAM_BOT_TOKEN is not defined');
            return;
        }
        this.bot = new grammy_1.Bot(token);
    }
    async onModuleInit() {
        if (!this.bot)
            return;
        this.setupHandlers();
        this.logger.log('Telegram bot handlers initialized for webhooks');
    }
    setupHandlers() {
        const bot = this.bot;
        if (!bot)
            return;
        bot.command('start', async (ctx) => {
            if (ctx.chat.type !== 'private') {
                return ctx.reply('Workspace creation is only available in private chat.');
            }
            const telegramId = ctx.from?.id.toString();
            if (!telegramId)
                return;
            try {
                const user = await this.userService.findOrCreateUser(telegramId);
                const ownedWorkspace = await this.workspaceService.findUserOwnedWorkspace(user.id);
                if (ownedWorkspace) {
                    return ctx.reply('You already have a workspace.');
                }
                const workspaceName = `${ctx.from?.first_name || 'My'}'s Workspace`;
                await this.workspaceService.createWorkspace(user.id, workspaceName);
                await ctx.reply(`Workspace "${workspaceName}" created! You are now the OWNER.`);
            }
            catch (error) {
                this.logger.error('Error in /start command', error);
                await ctx.reply('Something went wrong. Please try again later.');
            }
        });
    }
    getBot() {
        if (!this.bot) {
            throw new Error('Telegram bot is not initialized (missing TELEGRAM_BOT_TOKEN)');
        }
        return this.bot;
    }
};
exports.TelegramService = TelegramService;
exports.TelegramService = TelegramService = TelegramService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        user_service_1.UserService,
        workspace_service_1.WorkspaceService])
], TelegramService);
