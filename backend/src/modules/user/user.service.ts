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

    async createUser(telegramId: string) {
        return this.prisma.user.create({
            data: {
                telegramId: telegramId.toString(),
            },
        });
    }

    async findOrCreateUser(telegramId: string) {
        const user = await this.findByTelegramId(telegramId);
        if (user) return user;
        return this.createUser(telegramId);
    }

    async getUserWorkspaces(userId: string) {
        return this.prisma.workspaceMember.findMany({
            where: { userId },
            include: { workspace: true },
        });
    }
}

