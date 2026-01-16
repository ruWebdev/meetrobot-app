import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

    async findByTelegramId(telegramId: string) {
        return this.prisma.user.findUnique({
            where: { telegramId: telegramId.toString() },
        });
    }

    async createUser(telegramId: string, profile?: { firstName?: string | null; lastName?: string | null; username?: string | null }) {
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

    async findOrCreateUser(telegramId: string, profile?: { firstName?: string | null; lastName?: string | null; username?: string | null }) {
        const existing = await this.findByTelegramId(telegramId);
        if (existing) {
            if (profile) {
                const updateData: { firstName?: string; lastName?: string | null; username?: string | null } = {};
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

    async getUserWorkspaces(userId: string) {
        return this.prisma.workspaceMember.findMany({
            where: { userId },
            include: { workspace: true },
        });
    }

    async setActiveWorkspace(userId: string, workspaceId: string | null) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { activeWorkspaceId: workspaceId },
        });
    }
}

