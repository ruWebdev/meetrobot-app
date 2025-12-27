# Agents.md

## Project overview

Telegram-first system for managing events, schedules, one-time bookings, and organizational workflows.

The entire user interaction MUST be performed via:

* Telegram Bot (private chats and group chats)
* Telegram Web App (SPA)

No standalone admin panels, desktop apps, or external browser workflows are allowed.

---

## Core principles

* Telegram is the primary UI and identity provider
* There is NO global admin
* Any user can create and own their own organizational structure (Workspace)
* Architecture must support:

  * individual professionals (e.g. hairdresser)
  * teams / collectives (e.g. orchestra)
  * companies / event organizers
* One backend codebase serves all use cases

---

## Technology stack (fixed)

### Backend

* Node.js (LTS)
* TypeScript
* NestJS (modular architecture)
* grammY (Telegram Bot API)
* PostgreSQL
* Prisma ORM
* Redis
* BullMQ (queues, delayed jobs)

### Frontend (Telegram Web App)

* React
* Vite
* TypeScript
* Telegram Web Apps API
* SPA architecture

### Infrastructure

* Ubuntu 22.04 (VDS)
* Nginx (reverse proxy)
* pm2 (process manager)
* Telegram webhooks ONLY (no long polling)

---

## Explicit exclusions

* Docker and Docker Compose are NOT used
* No containerization of any kind
* No long polling
* No external admin UI
* No role called "superadmin" or "system admin"

---

## Workspace model (critical)

### Definition

A Workspace represents an independent organizational unit.

Examples:

* Hairdresser + their clients
* Orchestra + musicians
* Company + employees
* Event organizer + participants

Each Workspace is fully isolated from others.

---

### Workspace creation

* Any Telegram user can create a Workspace
* Creator automatically becomes **Workspace Owner**
* No approval or system-level moderation exists

---

### Workspace roles (RBAC)

RBAC is scoped per Workspace.

Mandatory roles:

* OWNER

  * Full access
  * Can manage members, roles, settings
  * Can delete Workspace

* MANAGER

  * Can create and manage events
  * Can manage schedules
  * Can send notifications

* MEMBER

  * Can view events and schedules
  * Can respond to invitations

* GUEST

  * Limited access
  * Usually external participants

RBAC rules must be enforced on both:

* Telegram bot actions
* Web App API requests

---

## User model

* A User is identified by Telegram `user_id`
* A User can belong to multiple Workspaces
* A User can have different roles in different Workspaces

No separate authentication system is allowed.

---

## Telegram interaction model

### Private chat

Used for:

* Workspace creation
* Workspace switching
* Personal notifications
* Invitations
* Role-based actions

---

### Group chat integration (mandatory)

The bot MUST support being added to Telegram groups.

Use cases:

* Orchestra group
* Team chat
* Event group

Rules:

* Group chat is optionally linked to a Workspace
* Group chat can be linked to ONE Workspace only
* Group messages can trigger:

  * reminders
  * attendance checks
  * announcements

Bot MUST:

* Detect group context
* Respect Workspace RBAC
* Never expose private data in groups

---

## Event & scheduling model

System must support:

* One-time events (concerts, meetings)
* Repeating events (rehearsals, classes)
* One-time bookings (appointments)

Common properties:

* time
* place (optional)
* participants
* confirmation / decline

Attendance tracking is REQUIRED.

---

## Notifications & jobs

* All reminders and delayed actions are handled via BullMQ
* Redis is mandatory
* Jobs include:

  * event reminders
  * follow-ups
  * attendance deadlines

No cron-only logic allowed.

---

## Backend architecture rules

* NestJS modules must be domain-driven

* Clear separation:

  * bot layer
  * api layer (for Web App)
  * domain logic
  * persistence

* Business logic MUST NOT live inside bot handlers

---

## Frontend (Web App) rules

* Web App is context-aware (Workspace-aware)
* No routing outside SPA
* Authentication is based on Telegram init data
* UI must respect RBAC

---

## Deployment rules (strict)

* Deployment is performed directly on VDS
* No Docker usage
* Backend and bot run via pm2
* Prisma migrations run on host
* Environment variables via `.env`
* Nginx serves:

  * Web App static files
  * Backend API via reverse proxy

---

## AI agent behavior constraints

* Agent MUST follow this document strictly
* Agent MUST NOT introduce new technologies
* Agent MUST NOT ask architectural questions already defined here
* Agent MUST implement MVP-first, no overengineering
* If something is ambiguous, choose the simplest solution

---

## MVP priority rule

If functionality is not required for:

* Workspace creation
* Event creation
* Scheduling
* Notifications

…it MUST be postponed.

---

## End of document
