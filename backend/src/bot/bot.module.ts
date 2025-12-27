import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { UserModule } from '../modules/user';
import { WorkspaceModule } from '../modules/workspace';
import { WorkspaceIntegrationModule } from '../modules/workspaceIntegration';
import { EventModule } from '../modules/event';
import { BookingModule } from '../modules/booking';
import { RolesModule } from '../modules/roles';

@Module({
    imports: [
        UserModule,
        WorkspaceModule,
        WorkspaceIntegrationModule,
        EventModule,
        BookingModule,
        RolesModule,
    ],
    providers: [BotService],
    exports: [BotService],
})
export class BotModule { }
