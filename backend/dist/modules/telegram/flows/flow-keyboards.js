"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExitKeyboard = buildExitKeyboard;
const grammy_1 = require("grammy");
function buildExitKeyboard() {
    return new grammy_1.InlineKeyboard().text('⬅️ Выйти в главное меню', 'global:exit');
}
