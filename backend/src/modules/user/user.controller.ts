import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthContext } from '../auth/auth.context';
import { UserGuard } from '../auth/auth.guard';

@Controller('me')
export class UserController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly authContext: AuthContext,
    ) { }

    @Get()
    @UseGuards(UserGuard)
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

        let activeWorkspace: any = null;
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
}
