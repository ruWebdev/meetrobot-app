"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    botToken: process.env.BOT_TOKEN || '',
    webhookDomain: process.env.WEBHOOK_DOMAIN || '',
    webhookPath: process.env.WEBHOOK_PATH || '/telegram/webhook',
});
