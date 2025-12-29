import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class TelegramService implements OnModuleInit {
    private readonly logger = new Logger(TelegramService.name);
    private bot?: Bot;

    constructor(
        private configService: ConfigService,
        private workspaceService: WorkspaceService,
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
    }

    getBot(): Bot {
        if (!this.bot) {
            throw new Error('Telegram-бот не инициализирован (не задан TELEGRAM_BOT_TOKEN)');
        }

        return this.bot;
    }
}
