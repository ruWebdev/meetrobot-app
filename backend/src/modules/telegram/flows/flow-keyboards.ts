import { InlineKeyboard } from 'grammy';

export function buildExitKeyboard(): InlineKeyboard {
    return new InlineKeyboard().text('⬅️ Выйти в главное меню', 'global:exit');
}
