import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthContext } from './auth.context';

@Injectable()
export class UserGuard implements CanActivate {
    constructor(
        private readonly prisma: PrismaService,
        private readonly authContext: AuthContext,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const userId = request.header('x-user-id');

        if (!userId) {
            throw new UnauthorizedException('Отсутствует заголовок x-user-id');
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException('Пользователь не найден');
        }

        this.authContext.userId = user.id;
        this.authContext.workspaceId = user.activeWorkspaceId ?? undefined;

        return true;
    }
}

@Injectable()
export class ActiveWorkspaceGuard implements CanActivate {
    constructor(
        private readonly prisma: PrismaService,
        private readonly authContext: AuthContext,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const userId = this.authContext.userId ?? request.header('x-user-id');

        if (!userId) {
            throw new UnauthorizedException('Отсутствует пользователь');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                activeWorkspace: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('Пользователь не найден');
        }

        if (!user.activeWorkspaceId || !user.activeWorkspace) {
            throw new ForbiddenException('Активное рабочее пространство не выбрано');
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
            throw new ForbiddenException('Пользователь не состоит в активном рабочем пространстве');
        }

        this.authContext.userId = user.id;
        this.authContext.workspaceId = user.activeWorkspaceId;
        this.authContext.role = membership.role;

        return true;
    }
}
