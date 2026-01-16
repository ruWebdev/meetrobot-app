# Architecture

## Module Responsibility Overview
- **AppModule**: Main entry point, wires all core and feature modules.
- **TelegramModule**: Handles Telegram Bot API interactions (grammY), command routing, and webhooks.
- **UserModule**: Manages user persistence and identity mapping (Telegram ID).
- **WorkspaceModule**: Manages organizational units, creation, and member roles.
- **AuthModule**: Handles request-scoped authorization context.
- **CoreModule**: Shared logic and cross-module helpers.
- **Infra (Prisma/Redis/Queue)**: Low-level infrastructure services.

## Data Ownership Rules
- All entities (Events, Services, Bookings) MUST belong to a `Workspace`.
- A `User` can own one `Workspace` (as OWNER) and be a member of multiple.
- Permissions are strictly scoped to the `Workspace` ID in the context.

## Dependency Direction
- Feature modules depend on `CoreModule` and `Infra` modules.
- `AppModule` depends on all modules.
- Circular dependencies are forbidden.
