"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const telegram_service_1 = require("../telegram/telegram.service");
let EventsService = class EventsService {
    prisma;
    telegramService;
    constructor(prisma, telegramService) {
        this.prisma = prisma;
        this.telegramService = telegramService;
    }
    async createEvent(params) {
        const { userId, dto } = params;
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, telegramId: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('Пользователь не найден');
        }
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: dto.workspaceId },
            select: { id: true },
        });
        if (!workspace) {
            throw new common_1.NotFoundException('Workspace не найден');
        }
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId: dto.workspaceId,
                },
            },
            select: { role: true },
        });
        if (!membership || membership.role !== 'OWNER') {
            throw new common_1.ForbiddenException('Только владелец Workspace может создать событие');
        }
        const created = await this.prisma.$transaction(async (tx) => {
            const masterEvent = await tx.event.create({
                data: {
                    workspaceId: dto.workspaceId,
                    parentEventId: null,
                    type: 'master',
                    title: dto.title,
                    description: dto.description ?? null,
                    date: new Date(dto.date),
                    timeStart: dto.timeStart,
                    timeEnd: dto.timeEnd,
                    location: dto.location,
                    status: 'scheduled',
                    createdById: user.id,
                },
            });
            const subEventsPayload = dto.subEvents ?? [];
            const subEvents = await Promise.all(subEventsPayload.map((se) => tx.event.create({
                data: {
                    workspaceId: dto.workspaceId,
                    parentEventId: masterEvent.id,
                    type: 'sub',
                    title: se.title,
                    description: null,
                    date: new Date(se.date),
                    timeStart: se.timeStart,
                    timeEnd: se.timeEnd,
                    location: se.location,
                    status: 'scheduled',
                    createdById: user.id,
                },
            })));
            const members = await tx.workspaceMember.findMany({
                where: { workspaceId: dto.workspaceId },
                select: { userId: true, user: { select: { telegramId: true } } },
            });
            const allEvents = [masterEvent, ...subEvents];
            for (const ev of allEvents) {
                await Promise.all(members.map((m) => tx.participation.create({
                    data: {
                        eventId: ev.id,
                        userId: m.userId,
                        responseStatus: 'pending',
                        responseUpdatedAt: null,
                    },
                })));
            }
            return { masterEvent, subEvents, members };
        });
        await this.deliverEventCardBestEffort({
            workspaceId: dto.workspaceId,
            masterEvent: created.masterEvent,
            members: created.members,
        });
        return {
            masterEvent: created.masterEvent,
            subEvents: created.subEvents,
        };
    }
    async deliverEventCardBestEffort(params) {
        const bot = this.telegramService.getBot();
        const text = `Событие создано:\n` +
            `Название: ${params.masterEvent.title}\n` +
            (params.masterEvent.description ? `Описание: ${params.masterEvent.description}\n` : '') +
            `Дата: ${params.masterEvent.date.toLocaleDateString('ru-RU')}\n` +
            `Время: ${params.masterEvent.timeStart}–${params.masterEvent.timeEnd}\n` +
            `Место: ${params.masterEvent.location}`;
        const tgGroup = await this.prisma.telegramGroup.findFirst({
            where: { workspaceId: params.workspaceId },
            select: { telegramChatId: true },
        });
        if (tgGroup) {
            try {
                await bot.api.sendMessage(tgGroup.telegramChatId, text);
            }
            catch {
                // best-effort
            }
            return;
        }
        await Promise.all(params.members.map(async (m) => {
            const telegramId = m.user?.telegramId;
            if (!telegramId)
                return;
            try {
                await bot.api.sendMessage(telegramId, text);
            }
            catch {
                // best-effort
            }
        }));
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        telegram_service_1.TelegramService])
], EventsService);
