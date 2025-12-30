import { Injectable } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { WorkspaceService } from '../workspace/workspace.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FlowType } from './flow-type';
import { UserSessionService } from './user-session.service';
import { FlowHandler } from './flows/flow-handler';
import { EventSeriesFlow } from './flows/event-series.flow';
import { SingleEventFlow } from './flows/single-event.flow';
import { ServiceBookingFlow } from './flows/service-booking.flow';

@Injectable()
export class BotFlowDispatcher {
    constructor(
        private readonly userService: UserService,
        private readonly workspaceService: WorkspaceService,
        private readonly prisma: PrismaService,
        private readonly userSessionService: UserSessionService,
        private readonly eventSeriesFlow: EventSeriesFlow,
        private readonly singleEventFlow: SingleEventFlow,
        private readonly serviceBookingFlow: ServiceBookingFlow,
    ) { }

    async onUpdate(ctx: any): Promise<void> {
        const telegramUserId = ctx.from?.id?.toString?.();
        const telegramChatId = ctx.chat?.id?.toString?.();

        if (!telegramUserId || !telegramChatId) {
            return;
        }

        await this.userService.findOrCreateUser(telegramUserId);

        const workspaceId = await this.resolveWorkspaceId({ ctx, telegramUserId, telegramChatId });
        if (!workspaceId) {
            await this.safeReply(ctx, 'Рабочее пространство не найдено.');
            return;
        }

        const session = await this.userSessionService.getOrCreate({ telegramUserId, telegramChatId, workspaceId });

        const handledGlobal = await this.tryHandleGlobal({ ctx, session });
        if (handledGlobal) {
            return;
        }

        if (session.activeFlowType) {
            const flow = this.getFlow(session.activeFlowType);
            await flow.onUpdate(ctx);
            return;
        }

        const isStart = this.isCommand(ctx, 'start');
        const isHelp = this.isCommand(ctx, 'help');

        if (isHelp) {
            await this.showHelp(ctx);
            return;
        }

        if (isStart) {
            await this.showWelcome(ctx);
            return;
        }

        if (this.isAnyUserMessage(ctx) || this.isCallbackQuery(ctx)) {
            await this.showWelcome(ctx);
        }
    }

    private getFlow(flowType: FlowType): FlowHandler {
        if (flowType === FlowType.EVENT_SERIES) return this.eventSeriesFlow;
        if (flowType === FlowType.SINGLE_EVENT) return this.singleEventFlow;
        return this.serviceBookingFlow;
    }

    private async tryHandleGlobal(params: { ctx: any; session: { telegramUserId: string; telegramChatId: string; workspaceId: string; activeFlowType: FlowType | null } }): Promise<boolean> {
        const { ctx, session } = params;

        if (this.isCommand(ctx, 'help')) {
            await this.showHelp(ctx);
            return true;
        }

        const callbackData = ctx.callbackQuery?.data as string | undefined;
        if (!callbackData) {
            return false;
        }

        if (callbackData === 'global:help') {
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.showHelp(ctx);
            return true;
        }

        if (callbackData === 'global:exit') {
            if (session.activeFlowType) {
                const flow = this.getFlow(session.activeFlowType);
                await flow.onExit(ctx);
            }

            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.userSessionService.reset({
                telegramUserId: session.telegramUserId,
                telegramChatId: session.telegramChatId,
                workspaceId: session.workspaceId,
            });
            await this.showWelcome(ctx);
            return true;
        }

        if (callbackData === `menu:${FlowType.EVENT_SERIES}`) {
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.userSessionService.updateActiveFlow({
                telegramUserId: session.telegramUserId,
                telegramChatId: session.telegramChatId,
                workspaceId: session.workspaceId,
                activeFlowType: FlowType.EVENT_SERIES,
                activeEntityId: null,
            });
            await this.eventSeriesFlow.onEnter(ctx);
            return true;
        }

        if (callbackData === `menu:${FlowType.SINGLE_EVENT}`) {
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.userSessionService.updateActiveFlow({
                telegramUserId: session.telegramUserId,
                telegramChatId: session.telegramChatId,
                workspaceId: session.workspaceId,
                activeFlowType: FlowType.SINGLE_EVENT,
                activeEntityId: null,
            });
            await this.singleEventFlow.onEnter(ctx);
            return true;
        }

        if (callbackData === `menu:${FlowType.SERVICE_BOOKING}`) {
            await ctx.answerCallbackQuery({ text: 'Готово', show_alert: false });
            await this.userSessionService.updateActiveFlow({
                telegramUserId: session.telegramUserId,
                telegramChatId: session.telegramChatId,
                workspaceId: session.workspaceId,
                activeFlowType: FlowType.SERVICE_BOOKING,
                activeEntityId: null,
            });
            await this.serviceBookingFlow.onEnter(ctx);
            return true;
        }

        return false;
    }

    private async showWelcome(ctx: any): Promise<void> {
        const text =
            'Здравствуйте!\n\n' +
            'Я помогу вам управлять мероприятиями или записываться на услуги.\n\n' +
            'Выберите, с чем вы хотите работать:';

        const keyboard = new InlineKeyboard()
            .text('🎭 Мероприятия с программой', `menu:${FlowType.EVENT_SERIES}`)
            .row()
            .text('📅 Разовое мероприятие', `menu:${FlowType.SINGLE_EVENT}`)
            .row()
            .text('💅 Запись на услугу', `menu:${FlowType.SERVICE_BOOKING}`)
            .row()
            .text('ℹ️ Помощь', 'global:help');

        await this.safeReply(ctx, text, keyboard);
    }

    private async showHelp(ctx: any): Promise<void> {
        const text =
            'Справка\n\n' +
            'Этот бот позволяет:\n' +
            '— управлять мероприятиями с несколькими событиями\n' +
            '— создавать и вести разовые мероприятия\n' +
            '— записываться на услуги по свободным слотам\n\n' +
            'Навигация:\n' +
            '— используйте кнопки под сообщениями\n' +
            '— для смены режима всегда выходите в главное меню\n\n' +
            'Если вы не уверены, с чего начать — выберите подходящий раздел в главном меню.';

        await this.safeReply(ctx, text);
    }

    private async safeReply(ctx: any, text: string, keyboard?: InlineKeyboard): Promise<void> {
        try {
            await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
        } catch {
            try {
                await ctx.api.sendMessage(ctx.chat.id, text, keyboard ? { reply_markup: keyboard } : undefined);
            } catch {
                return;
            }
        }
    }

    private isCallbackQuery(ctx: any): boolean {
        return Boolean(ctx.callbackQuery?.data);
    }

    private isAnyUserMessage(ctx: any): boolean {
        return Boolean(ctx.message);
    }

    private isCommand(ctx: any, command: string): boolean {
        const text = ctx.message?.text as string | undefined;
        if (!text) return false;

        if (text === `/${command}`) return true;
        if (text.startsWith(`/${command}@`)) return true;

        return false;
    }

    private async resolveWorkspaceId(params: { ctx: any; telegramUserId: string; telegramChatId: string }): Promise<string | null> {
        const { ctx, telegramUserId, telegramChatId } = params;

        if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
            const tgGroup = await this.prisma.telegramGroup.findUnique({
                where: { telegramChatId },
                select: { workspaceId: true },
            });
            return tgGroup?.workspaceId ?? null;
        }

        if (ctx.chat?.type !== 'private') {
            return null;
        }

        const user = await this.userService.findByTelegramId(telegramUserId);
        if (!user) {
            return null;
        }

        const memberships = await this.prisma.workspaceMember.findMany({
            where: { userId: user.id },
            select: { workspaceId: true },
            orderBy: { createdAt: 'asc' },
        });

        if (memberships.length === 0) {
            const result = await this.workspaceService.onboardFromTelegram({
                telegramId: telegramUserId,
                firstName: ctx.from?.first_name ?? null,
            });

            const createdWorkspaceId = (result as any).workspaceId as string | undefined;
            if (createdWorkspaceId) {
                return createdWorkspaceId;
            }

            const membershipAfter = await this.prisma.workspaceMember.findFirst({
                where: { userId: user.id },
                select: { workspaceId: true },
                orderBy: { createdAt: 'asc' },
            });
            return membershipAfter?.workspaceId ?? null;
        }

        return memberships[0].workspaceId;
    }
}
