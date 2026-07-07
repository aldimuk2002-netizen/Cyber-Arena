import { ColorManager } from './color-manager.js';

/**
 * Модуль отрисовки персонажа
 * @param {Object} ctx - Контекст canvas
 * @param {Object} p - Объект игрока (p1 или p2)
 * @param {String} playerKey - Ключ игрока ('p1' или 'p2')
 */
export function drawPlayer(ctx, p, playerKey) {
    if (p.dead) return;

    // Берем цвет из менеджера, если у игрока нет своего зафиксированного
    const activeColor = p.customColor || ColorManager.getColor(playerKey);

    ctx.save();
    
    // Эффект свечения
    ctx.shadowBlur = 15;
    ctx.shadowColor = activeColor;
    
    // Тело игрока
    ctx.fillStyle = "rgba(10, 6, 22, 0.95)";
    ctx.strokeStyle = p.stunTime > 0 ? "#7f8c8d" : activeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.size, p.size);
    ctx.fill();
    ctx.stroke();

    // Градиент внутри
    let centerX = p.x + p.size / 2;
    let centerY = p.y + p.size / 2;
    let gradient = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, p.size / 2);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.5, activeColor);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - p.size/4, centerY - p.size/4, p.size/2, p.size/2);
    
    ctx.restore();
}