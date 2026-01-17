import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { WorkspaceEventsController } from './workspace-events.controller';
import { EventsService } from './events.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { QueueModule } from '../../infra/queue/queue.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
    imports: [WorkspaceModule, QueueModule, TelegramModule],
    controllers: [EventsController, WorkspaceEventsController],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule { }
