import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkspaceService {
    constructor(private prisma: PrismaService) { }

    async onboardFromTelegram(params: { telegramId: string; firstName?: string | null }) {
        const telegramId = params.telegramId.toString();
        const firstName = params.firstName ?? null;

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const user = await tx.user.upsert({
                where: { telegramId },
                update: {},
                create: { telegramId },
            });

            const existingMembership = await tx.workspaceMember.findFirst({
                where: { userId: user.id },
            });

            if (existingMembership) {
                return { created: false as const, userId: user.id };
            }

            const workspaceName = firstName ? `Рабочее пространство ${firstName}` : 'Моё рабочее пространство';

            const workspace = await tx.workspace.create({
                data: {
                    name: workspaceName,
                    ownerId: user.id,
                },
            });

            await tx.workspaceMember.create({
                data: {
                    workspaceId: workspace.id,
                    userId: user.id,
                    role: 'OWNER',
                },
            });

            return { created: true as const, userId: user.id, workspaceId: workspace.id, workspaceName };
        });
    }

    async createWorkspace(ownerId: string, name: string) {
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const workspace = await tx.workspace.create({
                data: {
                    name,
                    ownerId,
                },
            });

            await tx.workspaceMember.create({
                data: {
                    workspaceId: workspace.id,
                    userId: ownerId,
                    role: 'OWNER',
                },
            });

            return workspace;
        });
    }

    async findUserOwnedWorkspace(ownerId: string) {
        return this.prisma.workspace.findFirst({
            where: { ownerId },
        });
    }
}
