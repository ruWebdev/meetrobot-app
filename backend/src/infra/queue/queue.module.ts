import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventReminderScheduler } from './event-reminder.scheduler';
import { EventRemindersProcessor } from './event-reminders.processor';
import { TelegramModule } from '../../modules/telegram/telegram.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        forwardRef(() => TelegramModule),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
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
        BullModule.registerQueue({
            name: 'event-reminders',
        }),
    ],
    providers: [EventReminderScheduler, EventRemindersProcessor],
    exports: [EventReminderScheduler],
})
export class QueueModule { }
