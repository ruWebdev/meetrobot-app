import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
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
            throw new BadRequestException('Отсутствует заголовок x-user-id');
        }

        return this.eventsService.createEvent({
            userId,
            dto,
        });
    }
}
