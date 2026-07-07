// render.js
// Вся визуальная логика: сетка арены, экран выбора класса, отрисовка игроков
// (с учётом кастомных цветов), босса, пуль/луж/частиц и обновление HUD-баров.

import { CLASSES } from './config.js';

/**
 * Рисует шляпу персонажа поверх его "головы".
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} p игрок (p1/p2)
 * @param {number} centerX
 * @param {number} centerY
 */
function drawHat(ctx, p, centerX, centerY) {
    if (!p.hat || p.hat === "none") return;

    ctx.save();
    if (p.hat === "banana") {
        ctx.fillStyle = "#ffeb3b"; ctx.strokeStyle = "#f57f17"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(centerX, p.y + 2, 8, Math.PI, 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#8d6e63"; ctx.fillRect(centerX - 1.5, p.y - 4, 3, 6);
        ctx.fillStyle = "#ffeb3b";
        ctx.beginPath(); ctx.moveTo(centerX - 6, p.y + 2);
        ctx.quadraticCurveTo(centerX - 14, p.y + 1, centerX - 12, p.y + 12);
        ctx.quadraticCurveTo(centerX - 9, p.y + 4, centerX - 2, p.y + 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(centerX + 6, p.y + 2);
        ctx.quadraticCurveTo(centerX + 14, p.y + 1, centerX + 12, p.y + 12);
        ctx.quadraticCurveTo(centerX + 9, p.y + 4, centerX + 2, p.y + 2); ctx.fill(); ctx.stroke();
    }
    else if (p.hat === "party") {
        let hatH = 18; ctx.fillStyle = "#e91e63"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(centerX - 8, p.y); ctx.lineTo(centerX, p.y - hatH); ctx.lineTo(centerX + 8, p.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(centerX - 4, p.y - 5); ctx.lineTo(centerX + 4, p.y - 9); ctx.moveTo(centerX - 2, p.y - 12); ctx.lineTo(centerX + 2, p.y - 14); ctx.stroke();
        ctx.fillStyle = "#ffeb3b"; ctx.beginPath(); ctx.arc(centerX, p.y - hatH, 3, 0, Math.PI * 2); ctx.fill();
    }
    else if (p.hat === "halo") {
        ctx.shadowBlur = 10; ctx.shadowColor = "#00ffff"; ctx.strokeStyle = "rgba(0, 240, 255, 0.9)"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(centerX, p.y - 6, 10, 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    else if (p.hat === "tophat") {
        ctx.fillStyle = "#111115"; ctx.strokeStyle = "#333344"; ctx.lineWidth = 1.5;
        ctx.fillRect(centerX - 13, p.y - 2, 26, 3); ctx.strokeRect(centerX - 13, p.y - 2, 26, 3);
        ctx.fillRect(centerX - 8, p.y - 16, 16, 14); ctx.strokeRect(centerX - 8, p.y - 16, 16, 14);
        ctx.fillStyle = "#ff0055"; ctx.fillRect(centerX - 8, p.y - 5, 16, 3);
    }
    else if (p.hat === "cowboy") {
        ctx.fillStyle = "#a1662f"; ctx.strokeStyle = "#5c330e"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(centerX - 16, p.y - 1); ctx.quadraticCurveTo(centerX, p.y + 3, centerX + 16, p.y - 1); ctx.quadraticCurveTo(centerX, p.y - 1, centerX - 16, p.y - 1); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(centerX - 8, p.y - 1); ctx.lineTo(centerX - 7, p.y - 10); ctx.quadraticCurveTo(centerX, p.y - 7, centerX + 7, p.y - 10); ctx.lineTo(centerX + 8, p.y - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}

/**
 * Рисует игрока. Цвет берётся из p.color, который к этому моменту
 * уже содержит либо цвет класса, либо кастомный цвет, выбранный в меню
 * (см. initBattle() в main.js и color-manager.js).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} p
 */
function drawPlayer(ctx, p) {
    if (p.dead) return;
    ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = p.color;
    ctx.fillStyle = "rgba(10, 6, 22, 0.95)"; ctx.strokeStyle = p.stunTime > 0 ? "#7f8c8d" : p.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.rect(p.x, p.y, p.size, p.size); ctx.fill(); ctx.stroke();

    let centerX = p.x + p.size / 2; let centerY = p.y + p.size / 2; let innerSize = p.size / 1.8;
    let gradient = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, p.size / 2);
    gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(0.5, p.color); gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.rect(centerX - innerSize / 2, centerY - innerSize / 2, innerSize, innerSize); ctx.fill();

    if (p.poisonTime > 0) { ctx.strokeStyle = "#2ecc71"; ctx.lineWidth = 2; ctx.strokeRect(p.x - 4, p.y - 4, p.size + 8, p.size + 8); }
    ctx.restore();

    drawHat(ctx, p, centerX, centerY);

    ctx.save(); ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(centerX + p.dirX * 38, centerY + p.dirY * 38); ctx.stroke(); ctx.restore();

    if (p.slashTime > 0) {
        ctx.save(); let progress = (14 - p.slashTime) / 14;
        let startArc = p.slashAngle - 1.3 + (progress * 0.4); let endArc = p.slashAngle - 1.3 + (progress * 2.5);
        ctx.save(); ctx.globalAlpha = (1 - progress) * 0.35;
        let sectorGradient = ctx.createRadialGradient(centerX, centerY, p.size / 2, centerX, centerY, p.range);
        sectorGradient.addColorStop(0, "rgba(255, 255, 255, 0.7)"); sectorGradient.addColorStop(0.3, "rgba(182, 36, 255, 0.5)"); sectorGradient.addColorStop(0.8, "rgba(100, 0, 200, 0.2)"); sectorGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = sectorGradient; ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, p.range, startArc, endArc); ctx.closePath(); ctx.fill(); ctx.restore();

        ctx.shadowBlur = 22; ctx.shadowColor = p.color;
        for (let w = 0; w < 6; w++) {
            ctx.strokeStyle = p.color; ctx.lineWidth = 6 - w; ctx.globalAlpha = (1 - progress) * (1 - w / 6);
            ctx.beginPath(); ctx.arc(centerX, centerY, p.range - w, startArc, endArc); ctx.stroke();
        }
        let tipX = centerX + Math.cos(endArc) * p.range; let tipY = centerY + Math.sin(endArc) * p.range;
        ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 1 - progress; ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    ctx.save(); ctx.textAlign = "center";
    if (p.stunTime > 0) { ctx.fillStyle = "#ffcc00"; ctx.font = "bold 10px monospace"; ctx.fillText("СТАН", centerX, p.y - 24); }
    else if (p.poisonTime > 0) { ctx.fillStyle = "#2ecc71"; ctx.font = "bold 10px monospace"; ctx.fillText("ЯД", centerX, p.y - 24); }
    ctx.fillStyle = "#665588"; ctx.font = "9px monospace"; ctx.fillText(`CD:${p.curCd}`, centerX, p.y - 12);

    if (p.type === "magic" || p.type === "poison_scout" || p.type === "stun_scout") {
        let maxCount = p.type === "magic" ? 3 : 5; let statusCount = p.shotCount % maxCount;
        ctx.fillStyle = p.type === "magic" ? "#a252ff" : p.type === "poison_scout" ? "#ff7700" : "#d100ff";
        ctx.fillText(`★`.repeat(statusCount) + `☆`.repeat(maxCount - statusCount), centerX, p.y + p.size + 14);
    }
    ctx.restore();
}

/**
 * Главная функция отрисовки кадра.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {object} world снимок игрового состояния из main.js
 */
export function render(ctx, canvas, world) {
    const {
        gameState, gameMode,
        selectP1, selectP2, readyP1, readyP2,
        netRole, configKeys,
        p1, p2, boss, bullets, puddles, particles
    } = world;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#160f29"; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    if (gameState === "SELECT") {
        ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
        ctx.fillStyle = "#ff0077"; ctx.font = "20px monospace"; ctx.textAlign = "center";
        ctx.fillText("ВЫБОР КИБЕРНЕТИЧЕСКОГО КЛАССА", canvas.width / 2, 50);

        let boxW = 230, boxH = 130, gapX = 30, gapY = 20, startX = 40, startY = 100;
        for (let i = 0; i < CLASSES.length; i++) {
            let row = Math.floor(i / 3); let col = i % 3;
            let bx = startX + col * (boxW + gapX); let by = startY + row * (boxH + gapY);
            let isSelP1 = (selectP1 === i); let isSelP2 = (selectP2 === i);

            ctx.fillStyle = "#06030d"; ctx.fillRect(bx, by, boxW, boxH);
            ctx.strokeStyle = isSelP1 && isSelP2 ? "#ffff00" : isSelP1 ? "#00f0ff" : isSelP2 ? "#ff0077" : "#22123b";
            ctx.lineWidth = isSelP1 || isSelP2 ? 3 : 1; ctx.strokeRect(bx, by, boxW, boxH);

            ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = CLASSES[i].color;
            ctx.strokeStyle = CLASSES[i].color; ctx.lineWidth = 2; ctx.strokeRect(bx + 15, by + 15, 20, 20);
            ctx.fillStyle = CLASSES[i].color; ctx.fillRect(bx + 20, by + 20, 10, 10); ctx.restore();

            ctx.fillStyle = CLASSES[i].color; ctx.font = "bold 13px monospace"; ctx.textAlign = "left";
            ctx.fillText(CLASSES[i].name, bx + 44, by + 29);
            ctx.fillStyle = "#999"; ctx.font = "11px monospace";
            let words = CLASSES[i].desc.split(" "); let line = "", py = by + 54;
            for (let w = 0; w < words.length; w++) {
                line += words[w] + " "; if (line.length > 26 || w === words.length - 1) { ctx.fillText(line, bx + 10, py); line = ""; py += 15; }
            }
            if (isSelP1) { ctx.fillStyle = "#00f0ff"; ctx.font = "bold 10px monospace"; ctx.fillText(`P1: [${configKeys.p1.attack.replace("Space", "ПРОБЕЛ")}]`, bx + 10, by + boxH - 10); }
            if (isSelP2) { ctx.fillStyle = "#ff0077"; ctx.font = "bold 10px monospace"; ctx.textAlign = "right"; ctx.fillText(netRole === 'local' ? `P2: [${configKeys.p2.attack.replace("Enter", "ENTER")}]` : "ГОСТЬ ГОТОВ", bx + boxW - 10, by + boxH - 10); }
        }
        ctx.fillStyle = "#fff"; ctx.font = "12px monospace"; ctx.textAlign = "center";
        ctx.fillText(`Игрок 1 готов: ${readyP1 ? "ДА" : "НЕТ"}`, canvas.width / 4, 475);
        ctx.fillText(`Игрок 2 готов: ${readyP2 ? "ДА" : "НЕТ"}`, (canvas.width / 4) * 3, 475);
    }

    if (gameState === "BATTLE" || gameState === "OVER") {
        for (let pd of puddles) {
            ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = pd.color; ctx.beginPath(); ctx.arc(pd.x, pd.y, pd.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.4; ctx.strokeStyle = pd.color; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }

        drawPlayer(ctx, p1);
        if (gameMode === "PVP" || !p2.dead) drawPlayer(ctx, p2);

        if (gameMode === "BOSS" && !boss.dead) {
            ctx.save(); let bCenterX = boss.x + boss.w / 2; let bCenterY = boss.y + boss.h / 2;
            if (boss.segments) {
                for (let s = 0; s < boss.segments.length; s++) {
                    let seg = boss.segments[s]; let size = 26 - (s * 4);
                    ctx.shadowBlur = 10; ctx.shadowColor = "#ff2222"; ctx.fillStyle = "rgba(20, 5, 5, 0.85)"; ctx.strokeStyle = "#ff3333"; ctx.lineWidth = 2;
                    ctx.save(); ctx.translate(seg.x, seg.y); ctx.rotate(boss.anim * 0.3 + s); ctx.fillRect(-size / 2, -size / 2, size, size); ctx.strokeRect(-size / 2, -size / 2, size, size); ctx.restore();
                }
            }

            ctx.shadowBlur = 20; ctx.shadowColor = "#ff3333"; ctx.fillStyle = "rgba(255, 30, 30, 0.3)"; ctx.strokeStyle = "#ff3333"; ctx.lineWidth = 3;
            let swing = Math.sin(boss.anim * 2.5) * 25;
            ctx.beginPath(); ctx.moveTo(bCenterX - 20, bCenterY); ctx.lineTo(bCenterX - 90, bCenterY - 40 + swing); ctx.lineTo(bCenterX - 130, bCenterY - 10 + swing); ctx.lineTo(bCenterX - 70, bCenterY + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bCenterX + 20, bCenterY); ctx.lineTo(bCenterX + 90, bCenterY - 40 + swing); ctx.lineTo(bCenterX + 130, bCenterY - 10 + swing); ctx.lineTo(bCenterX + 70, bCenterY + 30); ctx.closePath(); ctx.fill(); ctx.stroke();

            ctx.shadowBlur = 25; ctx.shadowColor = "#ff0033"; ctx.fillStyle = boss.stunTime > 0 ? "#505050" : "#140306"; ctx.strokeStyle = boss.stunTime > 0 ? "#7f8c8d" : "#ff0033"; ctx.lineWidth = 4;
            ctx.save(); ctx.translate(bCenterX, bCenterY); ctx.rotate(boss.anim * 0.1); ctx.beginPath(); ctx.moveTo(0, -boss.h / 2); ctx.lineTo(boss.w / 2, 0); ctx.lineTo(0, boss.h / 2); ctx.lineTo(-boss.w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();

            let coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, boss.w / 3); coreGrad.addColorStop(0, "#ffffff"); coreGrad.addColorStop(0.4, "#ff0055"); coreGrad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = coreGrad; ctx.beginPath(); ctx.arc(0, 0, boss.w / 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();

            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bCenterX - 15, bCenterY - boss.h / 2 + 5); ctx.lineTo(bCenterX, bCenterY - boss.h / 2 - 20); ctx.lineTo(bCenterX + 15, bCenterY - boss.h / 2 + 5); ctx.stroke();
            if (boss.poisonTime > 0) { ctx.strokeStyle = "#2ecc71"; ctx.lineWidth = 3; ctx.strokeRect(boss.x - 6, boss.y - 6, boss.w + 12, boss.h + 12); }
            ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.fillText(boss.stunTime > 0 ? "В СТАНЕ" : "LEVIATHAN.AI", bCenterX, bCenterY + boss.h / 2 + 18); ctx.restore();
        }

        for (let b of bullets) {
            ctx.save();
            if (b.isPumpkinStun) {
                ctx.shadowBlur = 15; ctx.shadowColor = "#ff7700"; ctx.fillStyle = "#ff7700"; ctx.beginPath(); ctx.ellipse(b.x, b.y, b.size * 1.2, b.size, 0, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.shadowBlur = 10; ctx.shadowColor = b.color; ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        for (let pt of particles) {
            ctx.save(); ctx.fillStyle = pt.color; ctx.globalAlpha = pt.life / 30; ctx.fillRect(pt.x, pt.y, pt.size, pt.size); ctx.restore();
        }

        document.getElementById("hp1").style.width = `${(p1.hp / CLASSES[selectP1].maxHp) * 100}%`;
        document.getElementById("hp-text1").textContent = `${p1.hp} / ${CLASSES[selectP1].maxHp} HP`;
        document.getElementById("hp2").style.width = `${(p2.hp / CLASSES[selectP2].maxHp) * 100}%`;
        document.getElementById("hp-text2").textContent = `${p2.hp} / ${CLASSES[selectP2].maxHp} HP`;
        if (gameMode === "BOSS") {
            document.getElementById("boss-hp").style.width = `${(boss.hp / boss.maxHp) * 100}%`;
            document.getElementById("boss-hp-text").textContent = `${boss.hp} / ${boss.maxHp} HP`;
        }
    }
}
