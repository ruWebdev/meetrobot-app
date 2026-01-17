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
exports.WorkspaceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let WorkspaceService = class WorkspaceService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveWorkspaceByTelegramChatId(telegramChatId) {
        const chatId = telegramChatId.toString();
        const tgGroup = await this.prisma.telegramGroup.findUnique({
            where: { telegramChatId: chatId },
            select: { workspaceId: true },
        });
        if (!tgGroup)
            return null;
        return this.prisma.workspace.findUnique({
            where: { id: tgGroup.workspaceId },
            select: {
                id: true,
                title: true,
                createdAt: true,
                _count: {
                    select: {
                        members: true,
                        telegramGroups: true,
                    },
                },
            },
        });
    }
    async getWorkspaceInfoForTelegramGroup(telegramChatId) {
        const workspace = await this.resolveWorkspaceByTelegramChatId(telegramChatId);
        if (!workspace) {
            return { ok: false, reason: 'NO_CONTEXT' };
        }
        return {
            ok: true,
            workspace: {
                id: workspace.id,
                name: workspace.title,
                createdAt: workspace.createdAt,
                membersCount: workspace._count.members,
                telegramGroupsCount: workspace._count.telegramGroups,
            },
        };
    }
    async getWhoAmIForTelegramGroup(params) {
        const telegramChatId = params.telegramChatId.toString();
        const telegramId = params.telegramId.toString();
        const workspace = await this.resolveWorkspaceByTelegramChatId(telegramChatId);
        if (!workspace) {
            return { ok: false, reason: 'NO_CONTEXT' };
        }
        const user = await this.prisma.user.findUnique({
            where: { telegramId },
            select: { id: true },
        });
        if (!user) {
            return { ok: false, reason: 'USER_NOT_REGISTERED' };
        }
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId: workspace.id,
                },
            },
            select: { role: true },
        });
        if (!membership) {
            return {
                ok: true,
                registered: true,
                isMember: false,
                workspaceName: workspace.title,
            };
        }
        return {
            ok: true,
            registered: true,
            isMember: true,
            role: membership.role,
            workspaceName: workspace.title,
        };
    }
    async onboardFromTelegram(params) {
        const telegramId = params.telegramId.toString();
        const firstName = params.firstName ?? null;
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.upsert({
                where: { telegramId },
                update: {},
                create: { telegramId },
            });
            const existingMembership = await tx.workspaceMember.findFirst({
                where: { userId: user.id },
            });
            if (existingMembership) {
                return { created: false, userId: user.id };
            }
            const workspaceTitle = firstName ? `Рабочее пространство ${firstName}` : 'Моё рабочее пространство';
            const workspace = await tx.workspace.create({
                data: {
                    title: workspaceTitle,
                    createdByUserId: user.id,
                },
            });
            await tx.workspaceMember.create({
                data: {
                    workspaceId: workspace.id,
                    userId: user.id,
                    role: 'OWNER',
                },
            });
            return { created: true, userId: user.id, workspaceId: workspace.id, workspaceName: workspaceTitle };
        });
    }
    async connectTelegramGroup(params) {
        const telegramId = params.telegramId.toString();
        const telegramChatId = params.telegramChatId.toString();
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { telegramId },
            });
            if (!user) {
                return { ok: false, reason: 'USER_NOT_FOUND' };
            }
            const memberships = await tx.workspaceMember.findMany({
                where: { userId: user.id },
            });
            if (memberships.length !== 1) {
                return { ok: false, reason: 'MULTIPLE_WORKSPACES' };
            }
            const membership = memberships[0];
            if (membership.role !== 'OWNER') {
                return { ok: false, reason: 'NOT_OWNER' };
            }
            const existingGroup = await tx.telegramGroup.findUnique({
                where: { telegramChatId },
            });
            if (existingGroup) {
                return { ok: false, reason: 'ALREADY_CONNECTED' };
            }
            const created = await tx.telegramGroup.create({
                data: {
                    telegramChatId,
                    title: params.title,
                    type: params.type,
                    workspaceId: membership.workspaceId,
                },
            });
            return { ok: true, telegramGroupId: created.id, workspaceId: created.workspaceId };
        });
    }
    async createWorkspace(ownerId, title) {
        return this.prisma.$transaction(async (tx) => {
            const workspace = await tx.workspace.create({
                data: {
                    title,
                    createdByUserId: ownerId,
                },
            });
            await tx.workspaceMember.create({
                data: {
                    workspaceId: workspace.id,
                    userId: ownerId,
                    role: 'OWNER',
                },
            });
            await tx.user.update({
                where: { id: ownerId },
                data: { activeWorkspaceId: workspace.id },
            });
            return workspace;
        });
    }
    async findUserOwnedWorkspace(ownerId) {
        return this.prisma.workspace.findFirst({
            where: { createdByUserId: ownerId },
        });
    }
    async getUserMemberships(userId) {
        return this.prisma.workspaceMember.findMany({
            where: { userId },
            include: { workspace: true },
            orderBy: { createdAt: 'asc' },
        });
    }
    async ensureUserMembershipInWorkspace(params) {
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: params.userId,
                    workspaceId: params.workspaceId,
                },
            },
            include: { workspace: true },
        });
        return membership;
    }
    async updateWorkspaceTitle(params) {
        return this.prisma.workspace.update({
            where: { id: params.workspaceId },
            data: { title: params.title },
        });
    }
};
exports.WorkspaceService = WorkspaceService;
exports.WorkspaceService = WorkspaceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkspaceService);
