import { Body, Controller, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateWorkspaceEventDto } from './dto/create-workspace-event.dto';

@Controller('workspace/:workspaceId/event')
export class WorkspaceEventsController {
    constructor(private readonly eventsService: EventsService) { }

    @Post()
    async createWorkspaceEvent(
        @Param('workspaceId') workspaceId: string,
        @Headers('x-user-id') userId: string,
        @Body() dto: CreateWorkspaceEventDto,
    ) {
        if (!userId) {
            throw new UnauthorizedException('Отсутствует заголовок x-user-id');
        }

        return this.eventsService.createWorkspaceEvent({
            userId,
            workspaceId,
            dto,
        });
    }
}
