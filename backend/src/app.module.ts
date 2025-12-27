import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from '../config/app.config';
import dbConfig from '../config/db.config';
import redisConfig from '../config/redis.config';
import telegramConfig from '../config/telegram.config';
import { UserModule } from './modules/user/user.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { WorkspaceIntegrationModule } from './modules/workspaceIntegration/workspaceIntegration.module';
import { EventModule } from './modules/event/event.module';
import { ServiceModule } from './modules/service/service.module';
import { BookingModule } from './modules/booking/booking.module';
import { NotificationModule } from './modules/notification/notification.module';
import { RolesModule } from './modules/roles/roles.module';
import { BotModule } from './bot/bot.module';
import { QueuesModule } from './queues/queues.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig, dbConfig, redisConfig, telegramConfig],
        }),
        UserModule,
        WorkspaceModule,
        WorkspaceIntegrationModule,
        EventModule,
        ServiceModule,
        BookingModule,
        NotificationModule,
        RolesModule,
        BotModule,
        QueuesModule,
    ],
})
export class AppModule { }
