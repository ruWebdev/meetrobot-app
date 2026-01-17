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
exports.ActiveWorkspaceGuard = exports.UserGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const auth_context_1 = require("./auth.context");
let UserGuard = class UserGuard {
    prisma;
    authContext;
    constructor(prisma, authContext) {
        this.prisma = prisma;
        this.authContext = authContext;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const userId = request.header('x-user-id');
        if (!userId) {
            throw new common_1.UnauthorizedException('Отсутствует заголовок x-user-id');
        }
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.UnauthorizedException('Пользователь не найден');
        }
        this.authContext.userId = user.id;
        this.authContext.workspaceId = user.activeWorkspaceId ?? undefined;
        return true;
    }
};
exports.UserGuard = UserGuard;
exports.UserGuard = UserGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_context_1.AuthContext])
], UserGuard);
let ActiveWorkspaceGuard = class ActiveWorkspaceGuard {
    prisma;
    authContext;
    constructor(prisma, authContext) {
        this.prisma = prisma;
        this.authContext = authContext;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const userId = this.authContext.userId ?? request.header('x-user-id');
        if (!userId) {
            throw new common_1.UnauthorizedException('Отсутствует пользователь');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                activeWorkspace: true,
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Пользователь не найден');
        }
        if (!user.activeWorkspaceId || !user.activeWorkspace) {
            throw new common_1.ForbiddenException('Активное рабочее пространство не выбрано');
        }
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId: user.activeWorkspaceId,
                },
            },
        });
        if (!membership) {
            throw new common_1.ForbiddenException('Пользователь не состоит в активном рабочем пространстве');
        }
        this.authContext.userId = user.id;
        this.authContext.workspaceId = user.activeWorkspaceId;
        this.authContext.role = membership.role;
        return true;
    }
};
exports.ActiveWorkspaceGuard = ActiveWorkspaceGuard;
exports.ActiveWorkspaceGuard = ActiveWorkspaceGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_context_1.AuthContext])
], ActiveWorkspaceGuard);
