import { Controller, Post, Get, Req, Res } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { webhookCallback } from 'grammy';

@Controller('telegram')
export class TelegramController {
    constructor(private readonly telegramService: TelegramService) { }

    @Post('webhook')
    async handleWebhook(@Req() req: any, @Res() res: any) {
        const bot = this.telegramService.getBot();
        return webhookCallback(bot, 'express')(req, res);
    }

    @Get('webhook')
    async healthCheck() {
        return { status: 'ok', message: 'Telegram Webhook is active (POST only)' };
    }
}
