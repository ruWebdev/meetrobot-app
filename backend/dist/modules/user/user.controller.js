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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const auth_context_1 = require("../auth/auth.context");
const auth_guard_1 = require("../auth/auth.guard");
let UserController = class UserController {
    prisma;
    authContext;
    constructor(prisma, authContext) {
        this.prisma = prisma;
        this.authContext = authContext;
    }
    async getMe() {
        const userId = this.authContext.userId;
        if (!userId) {
            // UserGuard должен был установить userId
            throw new Error('AuthContext.userId не установлен');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                activeWorkspace: true,
            },
        });
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        let activeWorkspace = null;
        if (user.activeWorkspaceId && user.activeWorkspace) {
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    userId_workspaceId: {
                        userId: user.id,
                        workspaceId: user.activeWorkspaceId,
                    },
                },
            });
            if (membership) {
                activeWorkspace = {
                    id: user.activeWorkspace.id,
                    title: user.activeWorkspace.title,
                    createdAt: user.activeWorkspace.createdAt,
                    role: membership.role,
                };
            }
        }
        const memberships = await this.prisma.workspaceMember.findMany({
            where: { userId: user.id },
            include: { workspace: true },
            orderBy: { createdAt: 'asc' },
        });
        return {
            id: user.id,
            telegramId: user.telegramId,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            createdAt: user.createdAt,
            activeWorkspace,
            workspaces: memberships.map((m) => ({
                id: m.workspace.id,
                title: m.workspace.title,
                createdAt: m.workspace.createdAt,
                role: m.role,
            })),
        };
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(auth_guard_1.UserGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getMe", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('me'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_context_1.AuthContext])
], UserController);
