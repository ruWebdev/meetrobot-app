import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
    imports: [UserModule, WorkspaceModule],
    controllers: [TelegramController],
    providers: [TelegramService],
    exports: [TelegramService],
})
export class TelegramModule { }
