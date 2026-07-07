import { ColorManager } from './color-manager.js';
import { drawPlayer } from './render.js';
import { CLASSES } from './config.js';
// --- ИСПРАВЛЕНИЕ ОШИБКИ: Объявляем контекст здесь ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 1. Инициализация PeerJS (сюда вставьте ваш сетевой код)
// const peer = new Peer(...);

// 2. Глобальные игровые переменные
let gameState = "MENU";
let p1 = null, p2 = null;

// 3. Функция инициализации боя (связываем логику и цвета)
function initBattle(selectP1, selectP2) {
    p1 = { ...CLASSES[selectP1], x: 100, y: 160, customColor: ColorManager.getColor('p1') };
    p2 = { ...CLASSES[selectP2], x: 700, y: 340, customColor: ColorManager.getColor('p2') };
    gameState = "BATTLE";
}

// 4. Управление
window.addEventListener("keydown", (e) => {
    if (gameState === "SELECT") {
        if (e.code === "KeyQ") ColorManager.nextColor('p1');
    }
});

// 5. Игровой цикл
function gameLoop() {
    // Вставьте сюда ваш старый код из функции update()
    
    // Отрисовка
    ctx.clearRect(0, 0, 820, 520);
    if (gameState === "BATTLE") {
        drawPlayer(ctx, p1, 'p1');
        drawPlayer(ctx, p2, 'p2');
        // Отрисовка остального контента (босс, пули)
    }
    requestAnimationFrame(gameLoop);
}

// Запуск
document.getElementById('start-btn').onclick = () => {
    document.getElementById('main-menu').style.display = 'none';
    gameLoop();
};