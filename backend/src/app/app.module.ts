import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { RedisModule } from '../infra/redis/redis.module';
import { QueueModule } from '../infra/queue/queue.module';
import { CoreModule } from '../modules/core/core.module';
import { UserModule } from '../modules/user/user.module';
import { WorkspaceModule } from '../modules/workspace/workspace.module';
import { AuthModule } from '../modules/auth/auth.module';
import { TelegramModule } from '../modules/telegram/telegram.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        PrismaModule,
        RedisModule,
        QueueModule,
        CoreModule,
        UserModule,
        WorkspaceModule,
        AuthModule,
        TelegramModule,
    ],
})
export class AppModule { }
