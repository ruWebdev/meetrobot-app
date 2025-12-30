import { BadRequestException, Body, Controller, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

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

    @Patch(':eventId')
    async updateEvent(
        @Param('eventId') eventId: string,
        @Headers('x-user-id') userId: string,
        @Body() dto: UpdateEventDto,
    ) {
        if (!userId) {
            throw new UnauthorizedException('Отсутствует заголовок x-user-id');
        }

        if (!dto || Object.keys(dto).length === 0) {
            throw new BadRequestException('Payload не может быть пустым');
        }

        return this.eventsService.updateEvent({
            userId,
            eventId,
            dto,
        });
    }
}
