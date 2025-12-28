# AI AGENT TECHNICAL SPECIFICATION
## Step 1 — Project Bootstrap & Core Architecture

---

## 0. Role & Responsibility of the AI Agent

You are an **implementation AI agent**, not an architect and not a product manager.

Your responsibilities:
- Implement code strictly according to this specification
- Follow the defined tech stack and architectural rules
- Never introduce technologies, abstractions, or patterns not explicitly allowed
- Prefer clarity and maintainability over cleverness
- Produce deterministic, reproducible results

You must **not**:
- Change the tech stack
- Introduce Docker, containerization, or cloud services
- Add global admins or cross-workspace permissions
- Embed business logic in UI layers

---

## 1. Project Goal (MVP Scope)

Build a **Telegram-first, workspace-based system** that supports:
- Telegram Bot (private chats + groups)
- Telegram Web App (admin / extended UI)
- Backend-driven business logic
- Workspace-scoped roles and entities

This step covers **only project bootstrap and core foundation**, not business features.

---

## 2. Approved Tech Stack (STRICT)

### Backend
- Node.js (LTS)
- TypeScript
- NestJS
- PostgreSQL
- Prisma ORM
- Redis
- BullMQ
- grammY (Telegram Bot API)
- pm2

### Frontend
- React
- TypeScript
- Vite
- Telegram Web Apps API

### Infrastructure
- Ubuntu 22.04
- nginx
- `.env` for configuration
- **NO Docker**
- **NO Docker Compose**

Any deviation is forbidden.

---

## 3. High-Level Architecture Principles

1. **Backend is the single source of truth**
   - All business logic lives in backend services
   - Bot and Web App are orchestration / UI layers only

2. **Workspace-centric model**
   - All entities belong to a Workspace
   - No global admin
   - Permissions are always scoped per Workspace

3. **Modular NestJS architecture**
   - Each domain = isolated module
   - No god-modules
   - Clear dependency direction

4. **Telegram-first**
   - Bot works without Web App
   - Web App enhances, not replaces bot flows

---

## 4. Repository Structure (MANDATORY)

```
/backend
  /src
    /app
      app.module.ts
    /modules
      /core
      /workspace
      /user
      /auth
      /telegram
    /infra
      /prisma
      /redis
      /queue
    main.ts
  prisma
    schema.prisma
  .env.example
  tsconfig.json

/frontend
  /src
    /app
    /pages
    /shared
    main.tsx
  index.html
  vite.config.ts

/nginx
  backend.conf
  frontend.conf

/docs
  architecture.md
  decisions.md
```

---

## 5. Step 1 Scope — What to Implement

### 5.1 Backend Bootstrap

You must:

1. Initialize NestJS project in `/backend`
2. Configure:
   - TypeScript
   - Environment variables
   - Global validation pipe
3. Integrate Prisma:
   - PostgreSQL connection
   - Base schema
4. Integrate Redis + BullMQ (no jobs yet)
5. Prepare grammY integration (no commands yet)
6. pm2-ready startup script

No business logic at this stage.

---

### 5.2 Prisma Base Schema (Initial)

You must define **minimum viable schema**:

```prisma
Workspace
- id
- name
- createdAt

User
- id
- telegramId
- createdAt

WorkspaceMember
- id
- workspaceId
- userId
- role
```

Rules:
- No enums explosion
- No premature optimization
- UUIDs only

---

### 5.3 Core Modules (Empty but Wired)

Create empty, compilable NestJS modules:

- CoreModule
- WorkspaceModule
- UserModule
- AuthModule
- TelegramModule

Each module must:
- Have its own folder
- Export a Module class
- Be registered in AppModule

---

## 6. Telegram Integration Rules (Preparation Only)

- Webhooks only (no polling)
- No bot commands yet
- No message handlers yet
- Only infrastructure wiring

---

## 7. Forbidden Actions

The agent must NOT:

- Implement UI screens
- Add payment logic
- Add analytics
- Add role hierarchies beyond placeholder
- Add “future-proof” abstractions
- Add Docker or containers
- Skip documentation

---

## 8. Documentation Required

Create `/docs/architecture.md` containing:
- Module responsibility overview
- Data ownership rules
- Dependency direction

Create `/docs/decisions.md` containing:
- Why NestJS
- Why Prisma
- Why Telegram-first

---

## 9. Output Expectations

After Step 1:
- Project must compile
- Database migrations must run
- Bot process must start (even if idle)
- Codebase must be clean, readable, boring

---

## 10. How to Proceed After Completion

After finishing Step 1, the agent must STOP.

Do NOT continue to Step 2 unless explicitly instructed.

Agent must provide:
- Summary of completed items
- List of created files
- Known limitations

END OF SPEC
