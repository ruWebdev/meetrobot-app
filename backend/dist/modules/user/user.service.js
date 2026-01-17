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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let UserService = class UserService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByTelegramId(telegramId) {
        return this.prisma.user.findUnique({
            where: { telegramId: telegramId.toString() },
        });
    }
    async createUser(telegramId, profile) {
        const firstName = profile?.firstName ?? '';
        const lastName = profile?.lastName ?? null;
        const username = profile?.username ?? null;
        return this.prisma.user.create({
            data: {
                telegramId: telegramId.toString(),
                firstName,
                lastName,
                username,
            },
        });
    }
    async findOrCreateUser(telegramId, profile) {
        const existing = await this.findByTelegramId(telegramId);
        if (existing) {
            if (profile) {
                const updateData = {};
                if (profile.firstName && profile.firstName !== existing.firstName) {
                    updateData.firstName = profile.firstName;
                }
                if (profile.lastName !== undefined && profile.lastName !== existing.lastName) {
                    updateData.lastName = profile.lastName;
                }
                if (profile.username !== undefined && profile.username !== existing.username) {
                    updateData.username = profile.username;
                }
                if (Object.keys(updateData).length > 0) {
                    return this.prisma.user.update({
                        where: { id: existing.id },
                        data: updateData,
                    });
                }
            }
            return existing;
        }
        return this.createUser(telegramId, profile);
    }
    async getUserWorkspaces(userId) {
        return this.prisma.workspaceMember.findMany({
            where: { userId },
            include: { workspace: true },
        });
    }
    async setActiveWorkspace(userId, workspaceId) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { activeWorkspaceId: workspaceId },
        });
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserService);
