import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

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
}
