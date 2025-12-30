import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';
import { WorkspaceService } from '../workspace/workspace.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit {
    private readonly logger = new Logger(TelegramService.name);
    private bot?: Bot;

    constructor(
        private configService: ConfigService,
        private workspaceService: WorkspaceService,
        private userService: UserService,
        private prisma: PrismaService,
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        if (!token) {
            this.logger.error('Переменная окружения TELEGRAM_BOT_TOKEN не задана');
            return;
        }
        this.bot = new Bot(token);
    }

    async onModuleInit() {
        if (!this.bot) return;

        this.setupHandlers();

        this.logger.log('Обработчики Telegram-бота инициализированы для webhook');
    }

    private setupHandlers() {
        const bot = this.bot;
        if (!bot) return;

        bot.on('callback_query:data', async (ctx) => {
            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) {
                return ctx.answerCallbackQuery({ text: 'Неожиданная ошибка', show_alert: true });
            }

            const user = await this.userService.findByTelegramId(telegramId);
            if (!user) {
                return ctx.answerCallbackQuery({ text: 'Пользователь не зарегистрирован', show_alert: true });
            }

            const data = ctx.callbackQuery.data;

            if (data.startsWith('att:')) {
                return this.handleAttendanceCallback({ ctx, userId: user.id, data });
            }

            const parsed = this.parseParticipationCallbackData(data);
            if (!parsed) {
                if (data.startsWith('event:') && data.includes(':response:')) {
                    this.logger.warn(`[Telegram] Invalid participation callback payload: ${data}`);
                }
                return;
            }

            const { eventId, status } = parsed;

            try {
                const event = await this.prisma.event.findUnique({
                    where: { id: eventId },
                    select: { id: true, deletedAt: true },
                });

                if (!event || event.deletedAt) {
                    return ctx.answerCallbackQuery({ text: 'Событие недоступно', show_alert: true });
                }

                const participation = await this.prisma.participation.findUnique({
                    where: {
                        userId_eventId: {
                            userId: user.id,
                            eventId,
                        },
                    },
                    select: { id: true },
                });

                if (!participation) {
                    return ctx.answerCallbackQuery({ text: 'Вы не приглашены на это событие', show_alert: true });
                }

                await this.prisma.participation.update({
                    where: { id: participation.id },
                    data: {
                        responseStatus: status,
                        responseUpdatedAt: new Date(),
                    },
                });

                this.logger.log(`[Participation] User ${user.id} set ${status} for event ${eventId}`);
                const responseLine = this.getResponseLine(status);

                // В группах редактирование сообщения изменит его для всех участников,
                // что приведёт к перетиранию ответов. По ТЗ редактируем только для нажавшего,
                // поэтому делаем editMessageText только в личном чате.
                const chatType = (ctx.callbackQuery.message as any)?.chat?.type as string | undefined;
                if (chatType !== 'private') {
                    return ctx.answerCallbackQuery({ text: responseLine, show_alert: false });
                }

                await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });

                const originalText = (ctx.callbackQuery.message as any)?.text as string | undefined;
                if (!originalText) {
                    return;
                }

                const cleaned = originalText
                    .replace(/\n\nВаш ответ:.*$/s, '')
                    .replace(/\nВаш ответ:.*$/s, '');
                const newText = `${cleaned}\n\n${responseLine}`;

                try {
                    await ctx.editMessageText(newText, {
                        parse_mode: 'Markdown',
                        reply_markup: this.buildParticipationKeyboard(eventId),
                    });
                } catch (error) {
                    this.logger.warn(`[Telegram] Failed to edit event card message for event ${eventId}`, error as any);
                }
            } catch (error) {
                this.logger.error('Ошибка при обработке callback участия', error as any);
                return ctx.answerCallbackQuery({ text: 'Неожиданная ошибка', show_alert: true });
            }
        });

        bot.command('attendance', async (ctx) => {
            if (ctx.chat.type === 'private') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            if (ctx.chat.type === 'channel') {
                return;
            }

            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) {
                return ctx.reply('Не удалось определить пользователя. Попробуйте позже.');
            }

            const user = await this.userService.findByTelegramId(telegramId);
            if (!user) {
                return ctx.reply('Пользователь не зарегистрирован');
            }

            const telegramChatId = ctx.chat.id.toString();
            const tgGroup = await this.prisma.telegramGroup.findUnique({
                where: { telegramChatId },
                select: { workspaceId: true },
            });

            const workspaceId = tgGroup?.workspaceId;
            if (!workspaceId) {
                return ctx.reply('Эта группа не подключена ни к одному рабочему пространству.');
            }

            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    userId_workspaceId: {
                        userId: user.id,
                        workspaceId,
                    },
                },
                select: { role: true },
            });

            if (!membership || membership.role !== 'OWNER') {
                return ctx.reply('Только владелец рабочего пространства может отмечать посещаемость.');
            }

            const activeEvents = await this.prisma.event.findMany({
                where: {
                    workspaceId,
                    type: 'master',
                    status: 'scheduled',
                    deletedAt: null,
                },
                select: {
                    id: true,
                    title: true,
                    date: true,
                    timeStart: true,
                    timeEnd: true,
                },
                orderBy: [{ date: 'desc' }, { timeStart: 'desc' }],
                take: 5,
            });

            const now = new Date();
            const candidates = activeEvents.filter((e) => {
                const start = this.combineDateTime(e.date, e.timeStart);
                return start && start.getTime() <= now.getTime();
            });

            if (candidates.length === 0) {
                return ctx.reply('Нет доступных событий для отметки. Отметка доступна только после начала события.');
            }

            if (candidates.length === 1) {
                return this.showAttendancePanel({ ctx, eventId: candidates[0].id });
            }

            const keyboard = new InlineKeyboard();
            for (const e of candidates) {
                const shortEventId = this.encodeUuidToShort(e.id);
                const label = e.title.length > 28 ? `${e.title.slice(0, 28)}…` : e.title;
                keyboard.text(label, `att:sel:${shortEventId}`).row();
            }

            return ctx.reply('Выберите событие:', {
                reply_markup: keyboard,
            });
        });

        bot.command('create_event', async (ctx) => {
            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) {
                return ctx.reply('Пользователь не зарегистрирован');
            }

            const user = await this.userService.findByTelegramId(telegramId);
            if (!user) {
                return ctx.reply('Пользователь не зарегистрирован');
            }

            let workspaceId: string | null = null;

            if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
                const telegramChatId = ctx.chat.id.toString();
                const tgGroup = await this.prisma.telegramGroup.findUnique({
                    where: { telegramChatId },
                    select: { workspaceId: true },
                });

                workspaceId = tgGroup?.workspaceId ?? null;
            } else if (ctx.chat.type === 'private') {
                const memberships = await this.prisma.workspaceMember.findMany({
                    where: { userId: user.id },
                    select: { workspaceId: true },
                });

                if (memberships.length === 0) {
                    return ctx.reply('Нет доступных рабочих пространств');
                }

                if (memberships.length > 1) {
                    return ctx.reply('Пожалуйста, выберите рабочее пространство');
                }

                workspaceId = memberships[0].workspaceId;
            } else {
                return;
            }

            if (!workspaceId) {
                return ctx.reply('Рабочее пространство не найдено');
            }

            const workspaceExists = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { id: true },
            });

            if (!workspaceExists) {
                return ctx.reply('Рабочее пространство не найдено');
            }

            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    userId_workspaceId: {
                        userId: user.id,
                        workspaceId,
                    },
                },
                select: { role: true },
            });

            if (!membership) {
                return ctx.reply('Вы не состоите в этом рабочем пространстве');
            }

            if (membership.role !== 'OWNER') {
                this.logger.log(`[Telegram] Deny open WebApp (not OWNER) for user ${user.id}, workspace ${workspaceId}`);
                return ctx.reply('Только владелец рабочего пространства может создавать события');
            }

            const webappHost = this.configService.get<string>('WEBAPP_HOST');
            if (!webappHost) {
                return ctx.reply('Рабочее пространство не найдено');
            }

            const trimmedWebappHost = webappHost.trim().replace(/\/+$/, '');
            const webappBaseUrl =
                trimmedWebappHost.startsWith('http://') || trimmedWebappHost.startsWith('https://')
                    ? trimmedWebappHost
                    : `https://${trimmedWebappHost}`;

            const url = `${webappBaseUrl}/workspaces/${workspaceId}/events/create?userId=${user.id}&apiBaseUrl=${encodeURIComponent(webappBaseUrl)}`;
            const keyboard = new InlineKeyboard().webApp('Создать событие', url);

            // В группах Telegram может отклонять web_app inline-кнопки (BUTTON_TYPE_INVALID).
            // Чтобы не ломать сценарий, в группе отправляем кнопку в личные сообщения.
            if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
                const fromId = ctx.from?.id;
                if (!fromId) {
                    return ctx.reply('Не удалось определить пользователя. Попробуйте позже.');
                }

                try {
                    await bot.api.sendMessage(fromId, 'Откройте форму создания события:', {
                        reply_markup: keyboard,
                    });
                    this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
                    return ctx.reply('Я отправил кнопку для открытия Web App вам в личные сообщения.');
                } catch {
                    this.logger.log(`[Telegram] Failed to send WebApp button to DM for user ${user.id}, workspace ${workspaceId}`);
                    return ctx.reply('Не удалось отправить кнопку в личные сообщения. Откройте чат с ботом и попробуйте снова.');
                }
            }

            this.logger.log(`[Telegram] Open WebApp for user ${user.id}, workspace ${workspaceId}`);
            return ctx.reply('Откройте форму создания события:', {
                reply_markup: keyboard,
            });
        });

        bot.command('workspace', async (ctx) => {
            if (ctx.chat.type === 'private') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            if (ctx.chat.type === 'channel') {
                return;
            }

            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            const telegramChatId = ctx.chat.id.toString();
            this.logger.log(`Вызов команды /workspace: chatId=${telegramChatId}, type=${ctx.chat.type}`);

            try {
                const result = await this.workspaceService.getWorkspaceInfoForTelegramGroup(telegramChatId);
                if (!result.ok) {
                    this.logger.log(`Workspace-контекст не найден для /workspace: chatId=${telegramChatId}`);
                    return ctx.reply('Эта группа не подключена ни к одному рабочему пространству.');
                }

                const createdAt = new Date(result.workspace.createdAt).toLocaleDateString('ru-RU');

                return ctx.reply(
                    `Рабочее пространство: ${result.workspace.name}\n` +
                    `Создано: ${createdAt}\n` +
                    `Участников: ${result.workspace.membersCount}\n` +
                    `Подключённых групп: ${result.workspace.telegramGroupsCount}`,
                );
            } catch (error) {
                this.logger.error('Ошибка при обработке команды /workspace', error);
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });

        bot.command('whoami', async (ctx) => {
            if (ctx.chat.type === 'private') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            if (ctx.chat.type === 'channel') {
                return;
            }

            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            const telegramChatId = ctx.chat.id.toString();
            this.logger.log(`Вызов команды /whoami: chatId=${telegramChatId}, type=${ctx.chat.type}`);

            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) {
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }

            try {
                const result = await this.workspaceService.getWhoAmIForTelegramGroup({
                    telegramChatId,
                    telegramId,
                });

                if (!result.ok) {
                    if (result.reason === 'NO_CONTEXT') {
                        this.logger.log(`Workspace-контекст не найден для /whoami: chatId=${telegramChatId}`);
                        return ctx.reply('Эта группа не подключена ни к одному рабочему пространству.');
                    }

                    if (result.reason === 'USER_NOT_REGISTERED') {
                        return ctx.reply('Вы пока не зарегистрированы в системе.');
                    }

                    return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
                }

                if (!result.isMember) {
                    return ctx.reply(
                        `Рабочее пространство: ${result.workspaceName}\n` +
                        'Вы не состоите в этом рабочем пространстве.',
                    );
                }

                return ctx.reply(
                    `Рабочее пространство: ${result.workspaceName}\n` +
                    `Роль: ${result.role}`,
                );
            } catch (error) {
                this.logger.error('Ошибка при обработке команды /whoami', error);
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });

        bot.command('start', async (ctx) => {
            if (ctx.chat.type !== 'private') {
                return ctx.reply('Создание рабочего пространства доступно только в личном чате с ботом.');
            }

            const telegramId = ctx.from?.id.toString();
            if (!telegramId) return;

            try {
                const result = await this.workspaceService.onboardFromTelegram({
                    telegramId,
                    firstName: ctx.from?.first_name ?? null,
                });

                if (!result.created) {
                    return ctx.reply('Рабочее пространство уже создано.');
                }

                return ctx.reply(`Рабочее пространство «${result.workspaceName}» создано. Вы назначены владельцем.`);
            } catch (error) {
                this.logger.error('Ошибка при обработке команды /start', error);
                await ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });

        bot.command('connect', async (ctx) => {
            if (ctx.chat.type === 'private') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            if (ctx.chat.type === 'channel') {
                return;
            }

            if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
                return ctx.reply('Эта команда доступна только в группе.');
            }

            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) return;

            const telegramChatId = ctx.chat.id.toString();
            const title = ctx.chat.title ?? 'Группа';
            const type = ctx.chat.type;

            this.logger.log(`Попытка привязки Telegram-группы: chatId=${telegramChatId}, type=${type}`);

            try {
                const result = await this.workspaceService.connectTelegramGroup({
                    telegramId,
                    telegramChatId,
                    title,
                    type,
                });

                if (!result.ok) {
                    if (result.reason === 'NOT_OWNER') {
                        return ctx.reply('Только владелец рабочего пространства может подключить группу.');
                    }
                    if (result.reason === 'MULTIPLE_WORKSPACES') {
                        return ctx.reply('У вас несколько рабочих пространств. Подключение через группу пока невозможно.');
                    }
                    if (result.reason === 'ALREADY_CONNECTED') {
                        return ctx.reply('Эта группа уже подключена к рабочему пространству.');
                    }

                    return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
                }

                this.logger.log(`Telegram-группа успешно привязана: chatId=${telegramChatId}`);
                return ctx.reply('Группа успешно подключена к рабочему пространству.');
            } catch (error) {
                this.logger.error('Ошибка при обработке команды /connect', error);
                return ctx.reply('Не удалось выполнить операцию. Попробуйте позже.');
            }
        });
    }

    private parseParticipationCallbackData(data: string): { eventId: string; status: 'accepted' | 'declined' | 'tentative' } | null {
        const match = data.match(/^event:([^:]+):response:(accepted|declined|tentative)$/);
        if (!match) return null;
        return { eventId: match[1], status: match[2] as any };
    }

    private async handleAttendanceCallback(params: { ctx: any; userId: string; data: string }) {
        const { ctx, userId, data } = params;

        const parsedSelect = data.match(/^att:sel:([A-Za-z0-9_-]{22})$/);
        if (parsedSelect) {
            const eventId = this.decodeShortToUuid(parsedSelect[1]);
            if (!eventId) {
                return ctx.answerCallbackQuery({ text: 'Неожиданная ошибка', show_alert: true });
            }

            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            return this.showAttendancePanel({ ctx, eventId });
        }

        const parsedMark = data.match(/^att:mk:([A-Za-z0-9_-]{22}):([A-Za-z0-9_-]{22}):(p|l|a)$/);
        if (!parsedMark) {
            this.logger.warn(`[Telegram] Invalid attendance callback payload: ${data}`);
            return;
        }

        const eventId = this.decodeShortToUuid(parsedMark[1]);
        const targetUserId = this.decodeShortToUuid(parsedMark[2]);
        const statusCode = parsedMark[3];

        if (!eventId || !targetUserId) {
            return ctx.answerCallbackQuery({ text: 'Неожиданная ошибка', show_alert: true });
        }

        const status = statusCode === 'p' ? 'present' : statusCode === 'l' ? 'late' : 'absent';

        try {
            const event = await this.prisma.event.findUnique({
                where: { id: eventId },
                select: { id: true, workspaceId: true, date: true, timeStart: true, deletedAt: true },
            });

            if (!event || event.deletedAt) {
                return ctx.answerCallbackQuery({ text: 'Событие недоступно', show_alert: true });
            }

            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    userId_workspaceId: {
                        userId,
                        workspaceId: event.workspaceId,
                    },
                },
                select: { role: true },
            });

            if (!membership || membership.role !== 'OWNER') {
                return ctx.answerCallbackQuery({ text: 'Недостаточно прав', show_alert: true });
            }

            const startsAt = this.combineDateTime(event.date, event.timeStart);
            if (!startsAt || startsAt.getTime() > Date.now()) {
                return ctx.answerCallbackQuery({ text: 'Отметка доступна после начала события.', show_alert: true });
            }

            await this.prisma.attendance.upsert({
                where: {
                    eventId_userId: {
                        eventId,
                        userId: targetUserId,
                    },
                },
                create: {
                    eventId,
                    userId: targetUserId,
                    status,
                },
                update: {
                    status,
                    markedAt: new Date(),
                },
            });

            this.logger.log(`[Attendance] ${status} for user ${targetUserId} at event ${eventId}`);
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });

            return this.showAttendancePanel({ ctx, eventId });
        } catch (error) {
            this.logger.error('Ошибка при обработке attendance callback', error as any);
            return ctx.answerCallbackQuery({ text: 'Неожиданная ошибка', show_alert: true });
        }
    }

    private async showAttendancePanel(params: { ctx: any; eventId: string }) {
        const { ctx, eventId } = params;

        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                title: true,
                workspaceId: true,
                date: true,
                timeStart: true,
                deletedAt: true,
            },
        });

        if (!event || event.deletedAt) {
            return ctx.reply('Событие не найдено.');
        }

        const startsAt = this.combineDateTime(event.date, event.timeStart);
        if (!startsAt || startsAt.getTime() > Date.now()) {
            return ctx.reply('Отметка доступна только после начала события.');
        }

        const participations = await this.prisma.participation.findMany({
            where: {
                eventId: event.id,
                responseStatus: { in: ['accepted', 'tentative'] },
            },
            select: {
                userId: true,
                user: { select: { name: true, telegramId: true } },
            },
            orderBy: { userId: 'asc' },
        });

        const userIds = participations.map((p) => p.userId);
        const attendances = await this.prisma.attendance.findMany({
            where: {
                eventId: event.id,
                userId: { in: userIds },
            },
            select: { userId: true, status: true },
        });

        const statusByUserId = new Map<string, string>();
        for (const a of attendances) {
            statusByUserId.set(a.userId, a.status);
        }

        const date = event.date.toLocaleDateString('ru-RU');
        let text = `Посещаемость\n\nСобытие: ${event.title}\nДата: ${date}\nВремя начала: ${event.timeStart}\n\n`;

        if (participations.length === 0) {
            text += 'Нет участников, которых нужно отметить.';
        } else {
            for (const p of participations) {
                const name = p.user?.name || p.user?.telegramId || p.userId;
                const st = statusByUserId.get(p.userId);
                const statusText = st === 'present'
                    ? 'присутствует'
                    : st === 'late'
                        ? 'опоздал'
                        : st === 'absent'
                            ? 'отсутствует'
                            : 'не отмечен';
                text += `${name} — ${statusText}\n`;
            }
        }

        const keyboard = new InlineKeyboard();
        for (const p of participations) {
            const shortEventId = this.encodeUuidToShort(event.id);
            const shortUserId = this.encodeUuidToShort(p.userId);
            keyboard
                .text('Отметить: присутствует', `att:mk:${shortEventId}:${shortUserId}:p`)
                .text('Отметить: опоздал', `att:mk:${shortEventId}:${shortUserId}:l`)
                .text('Отметить: отсутствует', `att:mk:${shortEventId}:${shortUserId}:a`)
                .row();
        }

        try {
            return await ctx.editMessageText(text, { reply_markup: keyboard });
        } catch {
            return ctx.reply(text, { reply_markup: keyboard });
        }
    }

    private combineDateTime(date: Date, time: string): Date | null {
        const match = time.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
        const d = new Date(date);
        d.setHours(hours, minutes, 0, 0);
        return d;
    }

    private encodeUuidToShort(uuid: string): string {
        const hex = uuid.replace(/-/g, '');
        const buf = Buffer.from(hex, 'hex');
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    private decodeShortToUuid(short: string): string | null {
        const padded = short.replace(/-/g, '+').replace(/_/g, '/').padEnd(24, '=');
        const buf = Buffer.from(padded, 'base64');
        if (buf.length !== 16) return null;
        const hex = buf.toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    private buildParticipationKeyboard(eventId: string): InlineKeyboard {
        return new InlineKeyboard()
            .text('Буду участвовать', `event:${eventId}:response:accepted`)
            .text('Не буду участвовать', `event:${eventId}:response:declined`)
            .row()
            .text('Пока не уверен', `event:${eventId}:response:tentative`);
    }

    private getResponseLine(status: 'accepted' | 'declined' | 'tentative'): string {
        if (status === 'accepted') return 'Ваш ответ: буду участвовать';
        if (status === 'declined') return 'Ваш ответ: не буду участвовать';
        return 'Ваш ответ: пока не уверен';
    }

    getBot(): Bot {
        if (!this.bot) {
            throw new Error('Telegram-бот не инициализирован (не задан TELEGRAM_BOT_TOKEN)');
        }

        return this.bot;
    }
}
