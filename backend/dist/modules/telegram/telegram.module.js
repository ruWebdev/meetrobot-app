"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramModule = void 0;
const common_1 = require("@nestjs/common");
const telegram_service_1 = require("./telegram.service");
const telegram_controller_1 = require("./telegram.controller");
const user_module_1 = require("../user/user.module");
const workspace_module_1 = require("../workspace/workspace.module");
const redis_module_1 = require("../../infra/redis/redis.module");
const prisma_module_1 = require("../../infra/prisma/prisma.module");
const user_session_service_1 = require("./user-session.service");
const bot_flow_dispatcher_service_1 = require("./bot-flow-dispatcher.service");
const events_module_1 = require("../events/events.module");
const telegram_notification_service_1 = require("./telegram-notification.service");
let TelegramModule = class TelegramModule {
};
exports.TelegramModule = TelegramModule;
exports.TelegramModule = TelegramModule = __decorate([
    (0, common_1.Module)({
        imports: [user_module_1.UserModule, workspace_module_1.WorkspaceModule, prisma_module_1.PrismaModule, redis_module_1.RedisModule, (0, common_1.forwardRef)(() => events_module_1.EventsModule)],
        controllers: [telegram_controller_1.TelegramController],
        providers: [
            telegram_service_1.TelegramService,
            telegram_notification_service_1.TelegramNotificationService,
            user_session_service_1.UserSessionService,
            bot_flow_dispatcher_service_1.BotFlowDispatcher,
        ],
        exports: [telegram_service_1.TelegramService, telegram_notification_service_1.TelegramNotificationService],
    })
], TelegramModule);
