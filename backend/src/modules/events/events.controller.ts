import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { InviteParticipantsDto } from './dto/invite-participants.dto';
import { RespondEventDto } from './dto/respond-event.dto';

@Controller('events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) { }

    @Post()
    async createEvent(
        @Headers('x-user-id') userId: string,
        @Body() dto: CreateEventDto,
    ) {
        if (!userId) {
            throw new UnauthorizedException('Отсутствует заголовок x-user-id');
        }

        return this.eventsService.createEvent({
            userId,
            dto,
        });
    }

    @Post(':eventId/invite')
    async inviteParticipants(
        @Param('eventId') eventId: string,
        @Headers('x-user-id') userId: string,
        @Body() dto: InviteParticipantsDto,
    ) {
        if (!userId) {
            throw new UnauthorizedException('Отсутствует заголовок x-user-id');
        }

        if (!dto || !dto.participantIds || dto.participantIds.length === 0) {
            throw new BadRequestException('Список участников не может быть пустым');
        }

        return this.eventsService.inviteParticipants({
            userId,
            eventId,
            participantIds: dto.participantIds,
        });
    }

    @Post(':eventId/respond')
    async respondToEvent(
        @Param('eventId') eventId: string,
        @Headers('x-user-id') userId: string,
        @Body() dto: RespondEventDto,
    ) {
        if (!userId) {
            throw new UnauthorizedException('Отсутствует заголовок x-user-id');
        }

        return this.eventsService.respondToEvent({
            userId,
            eventId,
            status: dto.status,
        });
    }

    @Post(':eventId/cancel')
    async cancelEvent(
        @Param('eventId') eventId: string,
        @Headers('x-user-id') userId: string,
    ) {
        if (!userId) {
            throw new UnauthorizedException('Отсутствует заголовок x-user-id');
        }

        return this.eventsService.cancelEvent({
            userId,
            eventId,
        });
    }

    @Get(':eventId')
    async getEventDetails(
        @Param('eventId') eventId: string,
        @Headers('x-user-id') userId: string,
    ) {
        if (!userId) {
            throw new UnauthorizedException('Отсутствует заголовок x-user-id');
        }

        return this.eventsService.getEventDetails({
            userId,
            eventId,
        });
    }
}
