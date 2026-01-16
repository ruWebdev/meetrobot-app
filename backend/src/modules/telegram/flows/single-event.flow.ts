import { Injectable } from '@nestjs/common';
import { FlowHandler } from './flow-handler';
import { buildExitKeyboard } from './flow-keyboards';

@Injectable()
export class SingleEventFlow implements FlowHandler {
    async onEnter(ctx: any): Promise<void> {
        const text =
            'Разовое мероприятие\n\n' +
            'Раздел предназначен для работы с отдельными мероприятиями без программы.';

        await ctx.reply(text, { reply_markup: buildExitKeyboard() });
    }

    async onUpdate(ctx: any): Promise<void> {
        await ctx.reply('Раздел в разработке.', { reply_markup: buildExitKeyboard() });
    }

    async onExit(ctx: any): Promise<void> {
        return;
    }
}
