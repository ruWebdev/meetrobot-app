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

    async connectTelegramGroup(params: {
        telegramId: string;
        telegramChatId: string;
        title: string;
        type: 'group' | 'supergroup';
    }) {
        const telegramId = params.telegramId.toString();
        const telegramChatId = params.telegramChatId.toString();

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const user = await tx.user.findUnique({
                where: { telegramId },
            });

            if (!user) {
                return { ok: false as const, reason: 'USER_NOT_FOUND' as const };
            }

            const memberships = await tx.workspaceMember.findMany({
                where: { userId: user.id },
            });

            if (memberships.length !== 1) {
                return { ok: false as const, reason: 'MULTIPLE_WORKSPACES' as const };
            }

            const membership = memberships[0];
            if (membership.role !== 'OWNER') {
                return { ok: false as const, reason: 'NOT_OWNER' as const };
            }

            const existingGroup = await tx.telegramGroup.findUnique({
                where: { telegramChatId },
            });

            if (existingGroup) {
                return { ok: false as const, reason: 'ALREADY_CONNECTED' as const };
            }

            const created = await tx.telegramGroup.create({
                data: {
                    telegramChatId,
                    title: params.title,
                    type: params.type,
                    workspaceId: membership.workspaceId,
                },
            });

            return { ok: true as const, telegramGroupId: created.id, workspaceId: created.workspaceId };
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
