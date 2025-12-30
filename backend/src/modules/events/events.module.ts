import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TelegramNotificationService } from '../../telegram/telegram-notification.service';

@Module({
    imports: [WorkspaceModule, TelegramModule],
    controllers: [EventsController],
    providers: [EventsService, TelegramNotificationService],
    exports: [EventsService],
})
export class EventsModule { }
