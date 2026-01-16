# Step 2 Summary — Workspace Onboarding via Telegram

## Implemented Logic
- **User Discovery**: Automated `User` entity creation upon `/start` command using Telegram `user_id`.
- **Workspace Creation**: Automatic creation of a default Workspace for new users in private chats.
- **Transactional Integrity**: Workspace and Owner-Membership are created within a single Prisma transaction.
- **Idempotency**: The system checks for existing owned workspaces to prevent duplicates.
- **Mandatory Structure**: Refactored backend to follow the strict directory structure defined in `AGENTS.md`.

## Database Schema Diff (Prisma)
- Replaced `cuid()` with `uuid()` for all IDs.
- Added `ownerId` to `Workspace` model.
- Simplified `WorkspaceMember.role` to a `String` (defaults to `MEMBER`).
- Removed premature models and enums to focus on MVP Step 2.

## Known Limitations
- **Webhook Infrastructure**: Integration is prepared but currently runs via polling for development simplicity until VDS/Nginx setup is finalized.
- **No Manual Naming**: Workspace name is currently hardcoded as `{FirstName}'s Workspace`.

---

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
**Note:** Always run the build command **on the server** after pulling new code before restarting PM2.

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
4. Persistence (survive reboots):
   ```bash
   pm2 save            # Save current process list
   pm2 startup         # Follow instructions to setup startup script
   ```


