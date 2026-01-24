"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const event_reminder_scheduler_1 = require("./event-reminder.scheduler");
const event_reminders_processor_1 = require("./event-reminders.processor");
const telegram_module_1 = require("../../modules/telegram/telegram.module");
const prisma_module_1 = require("../prisma/prisma.module");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            prisma_module_1.PrismaModule,
            (0, common_1.forwardRef)(() => telegram_module_1.TelegramModule),
            bullmq_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const redisUrl = config.get('REDIS_URL') ?? 'redis://localhost:6379';
                    const url = new URL(redisUrl);
                    const dbRaw = url.pathname && url.pathname !== '/' ? url.pathname.replace('/', '') : '';
                    const dbParsed = dbRaw ? Number(dbRaw) : undefined;
                    const db = typeof dbParsed === 'number' && !Number.isNaN(dbParsed) ? dbParsed : undefined;
                    return {
                        connection: {
                            host: url.hostname,
                            port: url.port ? Number(url.port) : 6379,
                            username: url.username || undefined,
                            password: url.password || undefined,
                            db,
                        },
                    };
                },
            }),
            bullmq_1.BullModule.registerQueue({
                name: 'event-reminders',
            }),
        ],
        providers: [event_reminder_scheduler_1.EventReminderScheduler, event_reminders_processor_1.EventRemindersProcessor],
        exports: [event_reminder_scheduler_1.EventReminderScheduler],
    })
], QueueModule);
