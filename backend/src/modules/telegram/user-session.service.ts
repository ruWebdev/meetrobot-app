import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import type Redis from 'ioredis';
import { UserSession } from './user-session';

@Injectable()
export class UserSessionService {
    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) { }

    private buildKey(params: { telegramUserId: string; telegramChatId: string }): string {
        return `user_session:${params.telegramUserId}:${params.telegramChatId}`;
    }

    async getOrCreate(params: { telegramUserId: string; telegramChatId: string; workspaceId: string }): Promise<UserSession> {
        const key = this.buildKey(params);
        const raw = await this.redis.get(key);
        if (raw) {
            const parsed = JSON.parse(raw) as Omit<UserSession, 'updatedAt'> & { updatedAt: string };
            return {
                ...parsed,
                updatedAt: new Date(parsed.updatedAt),
            };
        }

        const session: UserSession = {
            telegramUserId: params.telegramUserId,
            telegramChatId: params.telegramChatId,
            workspaceId: params.workspaceId,
            activeFlowType: null,
            activeEntityId: null,
            updatedAt: new Date(),
        };

        await this.save(session);
        return session;
    }

    async save(session: UserSession): Promise<void> {
        const key = this.buildKey({ telegramUserId: session.telegramUserId, telegramChatId: session.telegramChatId });
        const payload = {
            ...session,
            updatedAt: session.updatedAt.toISOString(),
        };
        await this.redis.set(key, JSON.stringify(payload));
    }

    async reset(params: { telegramUserId: string; telegramChatId: string; workspaceId: string }): Promise<UserSession> {
        const session: UserSession = {
            telegramUserId: params.telegramUserId,
            telegramChatId: params.telegramChatId,
            workspaceId: params.workspaceId,
            activeFlowType: null,
            activeEntityId: null,
            updatedAt: new Date(),
        };
        await this.save(session);
        return session;
    }

    async updateActiveFlow(params: {
        telegramUserId: string;
        telegramChatId: string;
        workspaceId: string;
        activeFlowType: UserSession['activeFlowType'];
        activeEntityId: string | null;
    }): Promise<UserSession> {
        const session = await this.getOrCreate({
            telegramUserId: params.telegramUserId,
            telegramChatId: params.telegramChatId,
            workspaceId: params.workspaceId,
        });

        session.activeFlowType = params.activeFlowType;
        session.activeEntityId = params.activeEntityId;
        session.updatedAt = new Date();

        await this.save(session);
        return session;
    }
}
