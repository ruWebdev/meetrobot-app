import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { BotFlowDispatcher } from './bot-flow-dispatcher.service';

@Injectable()
export class TelegramService implements OnModuleInit {
    private readonly logger = new Logger(TelegramService.name);
    private bot?: Bot;

    constructor(
        private configService: ConfigService,
        private readonly dispatcher: BotFlowDispatcher,
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

        bot.use(async (ctx, next) => {
            await this.dispatcher.onUpdate(ctx);
            await next();
        });
    }

    getBot(): Bot {
        if (!this.bot) {
            throw new Error('Telegram-бот не инициализирован (не задан TELEGRAM_BOT_TOKEN)');
        }

        return this.bot;
    }
}
