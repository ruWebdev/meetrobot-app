import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthContext } from '../auth/auth.context';
import { ActiveWorkspaceGuard, UserGuard } from '../auth/auth.guard';
import { WorkspaceService } from './workspace.service';
import { UserService } from '../user/user.service';

class CreateWorkspaceDto {
    @IsString()
    @IsNotEmpty()
    title!: string;
}

class UpdateWorkspaceDto {
    @IsString()
    @IsNotEmpty()
    title!: string;
}

@Controller('workspaces')
export class WorkspaceController {
    constructor(
        private readonly authContext: AuthContext,
        private readonly workspaceService: WorkspaceService,
        private readonly userService: UserService,
    ) { }

    @Get()
    @UseGuards(UserGuard)
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

    @Post()
    @UseGuards(UserGuard)
    async createWorkspace(@Body() body: CreateWorkspaceDto) {
        const userId = this.authContext.userId;
        if (!userId) {
            throw new Error('AuthContext.userId не установлен');
        }

        const title = (body.title ?? '').trim();
        if (!title) {
            throw new BadRequestException('Название рабочего пространства не может быть пустым');
        }

        const workspace = await this.workspaceService.createWorkspace(userId, title);

        return {
            id: workspace.id,
            title: workspace.title,
            role: 'OWNER',
        };
    }

    @Post(':id/select')
    @UseGuards(UserGuard)
    async selectWorkspace(@Param('id') workspaceId: string) {
        const userId = this.authContext.userId;
        if (!userId) {
            throw new Error('AuthContext.userId не установлен');
        }

        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId,
        });

        if (!membership) {
            throw new ForbiddenException('Пользователь не состоит в этом рабочем пространстве');
        }

        await this.userService.setActiveWorkspace(userId, workspaceId);

        return {
            id: membership.workspace.id,
            title: membership.workspace.title,
            createdAt: membership.workspace.createdAt,
            role: membership.role,
        };
    }

    @Patch(':id')
    @UseGuards(UserGuard)
    async updateWorkspace(@Param('id') workspaceId: string, @Body() body: UpdateWorkspaceDto) {
        const userId = this.authContext.userId;
        if (!userId) {
            throw new Error('AuthContext.userId не установлен');
        }

        const title = (body.title ?? '').trim();
        if (!title) {
            throw new ForbiddenException('Название рабочего пространства не может быть пустым');
        }

        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId,
        });

        if (!membership) {
            throw new ForbiddenException('Пользователь не состоит в этом рабочем пространстве');
        }

        if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
            throw new ForbiddenException('Недостаточно прав для изменения рабочего пространства');
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
    @Get('current')
    @UseGuards(ActiveWorkspaceGuard)
    async getCurrentWorkspace() {
        const workspaceId = this.authContext.workspaceId;
        const role = this.authContext.role;
        const userId = this.authContext.userId;

        if (!workspaceId || !userId) {
            throw new ForbiddenException('Активное рабочее пространство не выбрано');
        }

        const membership = await this.workspaceService.ensureUserMembershipInWorkspace({
            userId,
            workspaceId,
        });

        if (!membership) {
            throw new ForbiddenException('Пользователь не состоит в активном рабочем пространстве');
        }

        return {
            id: membership.workspace.id,
            title: membership.workspace.title,
            createdAt: membership.workspace.createdAt,
            role,
        };
    }
}
