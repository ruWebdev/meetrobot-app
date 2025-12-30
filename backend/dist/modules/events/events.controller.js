"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsController = void 0;
const common_1 = require("@nestjs/common");
const events_service_1 = require("./events.service");
const create_event_dto_1 = require("./dto/create-event.dto");
const update_event_dto_1 = require("./dto/update-event.dto");
let EventsController = class EventsController {
    eventsService;
    constructor(eventsService) {
        this.eventsService = eventsService;
    }
    async getEvent(eventId, userId) {
        if (!userId) {
            throw new common_1.UnauthorizedException('Отсутствует заголовок x-user-id');
        }
        return this.eventsService.getEventForEdit({
            userId,
            eventId,
        });
    }
    async createEvent(userId, dto) {
        if (!userId) {
            throw new common_1.UnauthorizedException('Отсутствует заголовок x-user-id');
        }
        return this.eventsService.createEvent({
            userId,
            dto,
        });
    }
    async updateEvent(eventId, userId, dto) {
        if (!userId) {
            throw new common_1.UnauthorizedException('Отсутствует заголовок x-user-id');
        }
        if (!dto || Object.keys(dto).length === 0) {
            throw new common_1.BadRequestException('Payload не может быть пустым');
        }
        return this.eventsService.updateEvent({
            userId,
            eventId,
            dto,
        });
    }
    async deleteEvent(eventId, userId) {
        if (!userId) {
            throw new common_1.UnauthorizedException('Отсутствует заголовок x-user-id');
        }
        return this.eventsService.deleteEvent({
            userId,
            eventId,
        });
    }
};
exports.EventsController = EventsController;
__decorate([
    (0, common_1.Get)(':eventId'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "getEvent", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Headers)('x-user-id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_event_dto_1.CreateEventDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "createEvent", null);
__decorate([
    (0, common_1.Patch)(':eventId'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_event_dto_1.UpdateEventDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "updateEvent", null);
__decorate([
    (0, common_1.Delete)(':eventId'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Headers)('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "deleteEvent", null);
exports.EventsController = EventsController = __decorate([
    (0, common_1.Controller)('events'),
    __metadata("design:paramtypes", [events_service_1.EventsService])
], EventsController);
