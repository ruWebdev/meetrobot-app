import { Module } from '@nestjs/common';
import { WorkspaceIntegrationController } from './workspaceIntegration.controller';
import { WorkspaceIntegrationService } from './workspaceIntegration.service';

@Module({
    controllers: [WorkspaceIntegrationController],
    providers: [WorkspaceIntegrationService],
    exports: [WorkspaceIntegrationService],
})
export class WorkspaceIntegrationModule { }
