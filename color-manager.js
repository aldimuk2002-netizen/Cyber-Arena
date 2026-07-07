// color-manager.js
// Логика выбора кастомного цвета персонажа.
// Индекс -1 означает "цвет по умолчанию" (цвет класса из config.js).
// Индексы 0..COLOR_PALETTE.length-1 указывают на конкретный цвет из палитры.

import { COLOR_PALETTE, COLOR_LABEL_DEFAULT } from './config.js';

/**
 * Создаёт начальное состояние выбора цветов для обоих игроков.
 * @returns {{p1: number, p2: number}}
 */
export function createColorSelection() {
    return { p1: -1, p2: -1 };
}

/**
 * Переключает индекс цвета игрока на dir (+1 или -1) по кругу,
 * включая позицию "-1" (цвет по умолчанию) в цикле перебора.
 * @param {{p1:number,p2:number}} selection
 * @param {'p1'|'p2'} player
 * @param {number} dir
 */
export function cycleColor(selection, player, dir) {
    const total = COLOR_PALETTE.length + 1; // +1 за состояние "по умолчанию"
    // Сдвигаем диапазон [-1, N-1] в [0, N] для удобства модульной арифметики
    let shifted = selection[player] + 1;
    shifted = (shifted + dir + total) % total;
    selection[player] = shifted - 1;
}

/**
 * Возвращает итоговый цвет игрока с учётом кастомного выбора.
 * @param {{p1:number,p2:number}} selection
 * @param {'p1'|'p2'} player
 * @param {string} defaultColor цвет выбранного класса
 * @returns {string}
 */
export function getResolvedColor(selection, player, defaultColor) {
    const idx = selection[player];
    if (idx === null || idx === undefined || idx < 0) return defaultColor;
    return COLOR_PALETTE[idx % COLOR_PALETTE.length];
}

/**
 * Человекочитаемая подпись для текущего выбора (для DOM/HUD).
 * @param {{p1:number,p2:number}} selection
 * @param {'p1'|'p2'} player
 * @returns {string}
 */
export function getColorLabel(selection, player) {
    const idx = selection[player];
    if (idx === null || idx === undefined || idx < 0) return COLOR_LABEL_DEFAULT;
    return `Цвет #${idx + 1}`;
}
