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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const auth_context_1 = require("../auth/auth.context");
const auth_guard_1 = require("../auth/auth.guard");
const workspace_service_1 = require("./workspace.service");
const user_service_1 = require("../user/user.service");
class CreateWorkspaceDto {
    title;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkspaceDto.prototype, "title", void 0);
class UpdateWorkspaceDto {
    title;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateWorkspaceDto.prototype, "title", void 0);
let WorkspaceController = class WorkspaceController {
    authContext;
    workspaceService;
    userService;
    constructor(authContext, workspaceService, userService) {
        this.authContext = authContext;
        this.workspaceService = workspaceService;
        this.userService = userService;
    }
    async listMyWorkspaces() {
        const userId = this.authContext.userId;
        if (!userId) {
            throw new Error('AuthContext.userId не установлен');
        }
        const memberships = await this.workspaceService.getUserMemberships(userId);
        return memberships.map((m) => ({
            id: m.workspace.id,
            title: m.workspace.title,
            createdAt: m.workspace.createdAt,
            role: m.role,
        }));
    }
    async createWorkspace(body) {
        const userId = this.authContext.userId;
        if (!userId) {
            throw new Error('AuthContext.userId не установлен');
        }
        const title = (body.title ?? '').trim();
        if (!title) {
            throw new common_1.BadRequestException('Название рабочего пространства не может быть пустым');
        }
        const workspace = await this.workspaceService.createWorkspace(userId, title);
        return {
            id: workspace.id,
            title: workspace.title,
            role: 'OWNER',
        };
    }
    async selectWorkspace(workspaceId) {
        const userId = this.authContext.userId;
        if (!userId) {
            throw new Error('AuthContext.userId не установлен');
        }
        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId,
        });
        if (!membership) {
            throw new common_1.ForbiddenException('Пользователь не состоит в этом рабочем пространстве');
        }
        await this.userService.setActiveWorkspace(userId, workspaceId);
        return {
            id: membership.workspace.id,
            title: membership.workspace.title,
            createdAt: membership.workspace.createdAt,
            role: membership.role,
        };
    }
    async updateWorkspace(workspaceId, body) {
        const userId = this.authContext.userId;
        if (!userId) {
            throw new Error('AuthContext.userId не установлен');
        }
        const title = (body.title ?? '').trim();
        if (!title) {
            throw new common_1.ForbiddenException('Название рабочего пространства не может быть пустым');
        }
        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId,
        });
        if (!membership) {
            throw new common_1.ForbiddenException('Пользователь не состоит в этом рабочем пространстве');
        }
        if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Недостаточно прав для изменения рабочего пространства');
        }
        const updated = await this.workspaceService.updateWorkspaceTitle({
            workspaceId,
            title,
        });
        return {
            id: updated.id,
            title: updated.title,
            createdAt: updated.createdAt,
            role: membership.role,
        };
    }
    // Пример эндпоинта, который требует активного Workspace (для будущих этапов)
    async getCurrentWorkspace() {
        const workspaceId = this.authContext.workspaceId;
        const role = this.authContext.role;
        const userId = this.authContext.userId;
        if (!workspaceId || !userId) {
            throw new common_1.ForbiddenException('Активное рабочее пространство не выбрано');
        }
        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId,
        });
        if (!membership) {
            throw new common_1.ForbiddenException('Пользователь не состоит в активном рабочем пространстве');
        }
        return {
            id: membership.workspace.id,
            title: membership.workspace.title,
            createdAt: membership.workspace.createdAt,
            role,
        };
    }
};
exports.WorkspaceController = WorkspaceController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(auth_guard_1.UserGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "listMyWorkspaces", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.UserGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateWorkspaceDto]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "createWorkspace", null);
__decorate([
    (0, common_1.Post)(':id/select'),
    (0, common_1.UseGuards)(auth_guard_1.UserGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "selectWorkspace", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(auth_guard_1.UserGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateWorkspaceDto]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "updateWorkspace", null);
__decorate([
    (0, common_1.Get)('current'),
    (0, common_1.UseGuards)(auth_guard_1.ActiveWorkspaceGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "getCurrentWorkspace", null);
exports.WorkspaceController = WorkspaceController = __decorate([
    (0, common_1.Controller)('workspaces'),
    __metadata("design:paramtypes", [auth_context_1.AuthContext,
        workspace_service_1.WorkspaceService,
        user_service_1.UserService])
], WorkspaceController);
