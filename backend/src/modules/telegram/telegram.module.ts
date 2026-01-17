import { forwardRef, Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RedisModule } from '../../infra/redis/redis.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { UserSessionService } from './user-session.service';
import { BotFlowDispatcher } from './bot-flow-dispatcher.service';
import { EventsModule } from '../events/events.module';

@Module({
    imports: [UserModule, WorkspaceModule, PrismaModule, RedisModule, forwardRef(() => EventsModule)],
    controllers: [TelegramController],
    providers: [
        TelegramService,
        UserSessionService,
        BotFlowDispatcher,
    ],
    exports: [TelegramService],
})
export class TelegramModule { }
