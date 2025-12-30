import { Injectable } from '@nestjs/common';
import { FlowHandler } from './flow-handler';
import { buildExitKeyboard } from './flow-keyboards';

@Injectable()
export class ServiceBookingFlow implements FlowHandler {
    async onEnter(ctx: any): Promise<void> {
        const text =
            'Запись на услугу\n\n' +
            'Раздел предназначен для записи на услуги по свободным слотам.';

        await ctx.reply(text, { reply_markup: buildExitKeyboard() });
    }

    async onUpdate(ctx: any): Promise<void> {
        await ctx.reply('Раздел в разработке.', { reply_markup: buildExitKeyboard() });
    }

    async onExit(ctx: any): Promise<void> {
        return;
    }
}
