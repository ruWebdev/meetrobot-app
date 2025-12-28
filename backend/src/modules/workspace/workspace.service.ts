import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkspaceService {
    constructor(private prisma: PrismaService) { }

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
