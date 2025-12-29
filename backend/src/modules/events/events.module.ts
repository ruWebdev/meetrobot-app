import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
    imports: [WorkspaceModule, TelegramModule],
    controllers: [EventsController],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule { }
