import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: REDIS_CLIENT,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
                return new Redis(redisUrl, {
                    maxRetriesPerRequest: null,
                    enableReadyCheck: true,
                });
            },
        },
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule { }
