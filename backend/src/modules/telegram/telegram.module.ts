import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RedisModule } from '../../infra/redis/redis.module';
import { UserSessionService } from './user-session.service';
import { BotFlowDispatcher } from './bot-flow-dispatcher.service';
import { EventSeriesFlow } from './flows/event-series.flow';
import { SingleEventFlow } from './flows/single-event.flow';
import { ServiceBookingFlow } from './flows/service-booking.flow';

@Module({
    imports: [UserModule, WorkspaceModule, RedisModule],
    controllers: [TelegramController],
    providers: [
        TelegramService,
        UserSessionService,
        BotFlowDispatcher,
        EventSeriesFlow,
        SingleEventFlow,
        ServiceBookingFlow,
    ],
    exports: [TelegramService],
})
export class TelegramModule { }
