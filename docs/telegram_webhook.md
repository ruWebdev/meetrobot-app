# Telegram Webhook Setup Guide

To connect your bot via webhooks, follow these steps:

## 1. Requirements
- A VDS with a public IP or a local tunnel (like ngrok) for testing.
- SSL/TLS certificate (Telegram requires HTTPS for webhooks).
- Domain pointing to your server.

## 2. Server Configuration (Nginx)
The project includes a base Nginx configuration in `/nginx/backend.conf`.
1. Copy the config to `/etc/nginx/sites-available/`.
2. Update the `server_name` with your domain.
3. Enable the site: `ln -s /etc/nginx/sites-available/backend.conf /etc/nginx/sites-enabled/`.
4. Test and restart Nginx: `nginx -t && systemctl restart nginx`.

## 3. Environment Variables
Ensure your `.env` in `/backend` has the correct `TELEGRAM_BOT_TOKEN`.

## 4. Set the Webhook URL
You need to tell Telegram where to send updates. Run the following command (replace placeholders):

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
     -H "Content-Type: application/json" \
     -d '{"url": "https://<YOUR_DOMAIN>/telegram/webhook"}'
```

## 5. Verification
- Check bot status: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo`
- Check server logs via PM2: `pm2 logs meetrobot-backend`

## 6. Local Testing (Ngrok)
If testing locally:
1. Start ngrok: `ngrok http 3000`
2. Use the ngrok HTTPS URL to set the webhook:
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<NGROK_ID>.ngrok-free.app/telegram/webhook`
