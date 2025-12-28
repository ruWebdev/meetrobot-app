# Meetrobot Monorepo (Telegram-first)

## Structure
- `backend/` — NestJS API + grammY bot + BullMQ + Prisma
- `frontend/` — Telegram Web App (React + Vite)
- `infra/` — nginx and environment templates for VDS deploy (pm2, no Docker)
- `tests/` — placeholders for backend/bot/frontend tests

## Principles
- Telegram-first UX (private + group chats)
- Workspace-centric, roles scoped per Workspace (OWNER, MANAGER, MEMBER, GUEST)
- No Docker, deploy via pm2 + nginx + Telegram webhooks

## Setup (scaffold only)
This repository currently contains scaffolding and contracts for the MVP. Implement business logic inside service layers of modules; bot handlers should call services only.

1. Install dependencies per workspace:
   ```bash
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```
2. Copy env examples and adjust values.
3. Run prisma migrate/generate when models are finalized.
4. Serve backend via pm2; frontend via nginx static hosting; Telegram webhooks via nginx reverse proxy.

## Deployment with PM2 (VDS)
For production deployment on a VDS, use PM2 to manage the backend process:

1. Build both parts:
   ```bash
   npm run backend:build
   npm run frontend:build
   ```
2. Start the backend using the provided ecosystem config:
   ```bash
   pm2 start ecosystem.config.js
   ```
3. Useful PM2 commands:
   ```bash
   pm2 status          # Check running processes
   pm2 logs            # View real-time logs
   pm2 restart all     # Restart processes
   pm2 stop all        # Stop processes
   ```

