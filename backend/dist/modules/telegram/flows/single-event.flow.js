"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleEventFlow = void 0;
const common_1 = require("@nestjs/common");
const flow_keyboards_1 = require("./flow-keyboards");
let SingleEventFlow = class SingleEventFlow {
    async onEnter(ctx) {
        const text = 'Разовое мероприятие\n\n' +
            'Раздел предназначен для работы с отдельными мероприятиями без программы.';
        await ctx.reply(text, { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
    }
    async onUpdate(ctx) {
        await ctx.reply('Раздел в разработке.', { reply_markup: (0, flow_keyboards_1.buildExitKeyboard)() });
    }
    async onExit(ctx) {
        return;
    }
};
exports.SingleEventFlow = SingleEventFlow;
exports.SingleEventFlow = SingleEventFlow = __decorate([
    (0, common_1.Injectable)()
], SingleEventFlow);
