import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { UserService } from '../user/user.service';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class TelegramService implements OnModuleInit {
    private readonly logger = new Logger(TelegramService.name);
    private bot?: Bot;

    constructor(
        private configService: ConfigService,
        private userService: UserService,
        private workspaceService: WorkspaceService,
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        if (!token) {
            this.logger.error('TELEGRAM_BOT_TOKEN is not defined');
            return;
        }
        this.bot = new Bot(token);
    }

    async onModuleInit() {
        if (!this.bot) return;

        this.setupHandlers();

        this.logger.log('Telegram bot handlers initialized for webhooks');
    }

    private setupHandlers() {
        const bot = this.bot;
        if (!bot) return;

        bot.command('start', async (ctx) => {
            if (ctx.chat.type !== 'private') {
                return ctx.reply('Workspace creation is only available in private chat.');
            }

            const telegramId = ctx.from?.id.toString();
            if (!telegramId) return;

            try {
                const user = await this.userService.findOrCreateUser(telegramId);
                const ownedWorkspace = await this.workspaceService.findUserOwnedWorkspace(user.id);

                if (ownedWorkspace) {
                    return ctx.reply('You already have a workspace.');
                }

                const workspaceName = `${ctx.from?.first_name || 'My'}'s Workspace`;
                await this.workspaceService.createWorkspace(user.id, workspaceName);

                await ctx.reply(`Workspace "${workspaceName}" created! You are now the OWNER.`);
            } catch (error) {
                this.logger.error('Error in /start command', error);
                await ctx.reply('Something went wrong. Please try again later.');
            }
        });
    }

    getBot(): Bot {
        if (!this.bot) {
            throw new Error('Telegram bot is not initialized (missing TELEGRAM_BOT_TOKEN)');
        }

        return this.bot;
    }
}
