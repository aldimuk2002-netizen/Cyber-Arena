// main.js
// Точка входа: инициализация DOM, игровой цикл, обработка ввода,
// сетевой код (PeerJS + ручной RTCPeerConnection) и вся игровая логика
// (атаки, столкновения, ИИ босса).

import { CLASSES, HATS, HAT_LABELS, DEFAULT_KEYS, COLOR_KEYS, ICE_SERVERS_CONFIG, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
import { createColorSelection, cycleColor, getResolvedColor, getColorLabel } from './color-manager.js';
import { render } from './render.js';

// ---------- DOM-ссылки ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const mainMenu = document.getElementById("main-menu");
const modeSelection = document.getElementById("mode-selection");
const networkPanel = document.getElementById("network-panel");
const settingsPanel = document.getElementById("settings-panel");
const hud = document.getElementById("hud");
const bossHud = document.getElementById("boss-hud");

const gameOverOverlay = document.getElementById("game-over-overlay");
const gameOverTitle = document.getElementById("game-over-title");
const gameOverMainControls = document.getElementById("game-over-main-controls");
const gameOverCharacterChoice = document.getElementById("game-over-character-choice");
const hatSelectorsOverlay = document.getElementById("hat-selectors-overlay");
const colorSelectorsOverlay = document.getElementById("color-selectors-overlay");

// ---------- Игровое состояние ----------
let hatIndexP1 = 0;
let hatIndexP2 = 0;
let colorSelection = createColorSelection(); // { p1: -1, p2: -1 }

let configKeys = {
    p1: { ...DEFAULT_KEYS.p1 },
    p2: { ...DEFAULT_KEYS.p2 }
};

let awaitingKeyFor = null;
let gameState = "MENU";
let gameMode = "PVP";
let selectP1 = 0, selectP2 = 1;
let readyP1 = false, readyP2 = false;
let p1 = {}, p2 = {}, boss = {}, bullets = [], puddles = [], particles = [];
let winner = "";

let peer = null, conn = null, netRole = 'local';
let rawPeerConn = null, rawDataChannel = null;
let clientInputs = { up: false, down: false, left: false, right: false, attack: false };
const keys = {};

// ---------- Ввод с клавиатуры ----------
window.addEventListener("keydown", (e) => {
    if (awaitingKeyFor) {
        e.preventDefault();
        configKeys[awaitingKeyFor.player][awaitingKeyFor.action] = e.code;
        updateSettingsButtonsLabels();
        awaitingKeyFor = null;
        updateControlsBarText();
        return;
    }

    if (e.code === "Escape") { exitToMenu(); return; }
    keys[e.code] = true;

    if (gameState === "SELECT") {
        if (netRole !== 'client') {
            if (e.code === configKeys.p1.left && !readyP1) selectP1 = (selectP1 - 1 + CLASSES.length) % CLASSES.length;
            if (e.code === configKeys.p1.right && !readyP1) selectP1 = (selectP1 + 1) % CLASSES.length;
            if (e.code === COLOR_KEYS.p1.prev && !readyP1) { cycleColor(colorSelection, 'p1', -1); updateColorSelectorsUI(); }
            if (e.code === COLOR_KEYS.p1.next && !readyP1) { cycleColor(colorSelection, 'p1', 1); updateColorSelectorsUI(); }
            if (e.code === configKeys.p1.attack) readyP1 = true;
        }

        if (netRole === 'local') {
            if (e.code === configKeys.p2.left && !readyP2) selectP2 = (selectP2 - 1 + CLASSES.length) % CLASSES.length;
            if (e.code === configKeys.p2.right && !readyP2) selectP2 = (selectP2 + 1) % CLASSES.length;
            if (e.code === COLOR_KEYS.p2.prev && !readyP2) { cycleColor(colorSelection, 'p2', -1); updateColorSelectorsUI(); }
            if (e.code === COLOR_KEYS.p2.next && !readyP2) { cycleColor(colorSelection, 'p2', 1); updateColorSelectorsUI(); }
            if (e.code === configKeys.p2.attack) readyP2 = true;
        } else if (netRole === 'client') {
            if ((e.code === configKeys.p1.left || e.code === configKeys.p2.left) && !readyP2) { selectP2 = (selectP2 - 1 + CLASSES.length) % CLASSES.length; syncClientMenu(); }
            if ((e.code === configKeys.p1.right || e.code === configKeys.p2.right) && !readyP2) { selectP2 = (selectP2 + 1) % CLASSES.length; syncClientMenu(); }
            if ((e.code === COLOR_KEYS.p1.prev || e.code === COLOR_KEYS.p2.prev) && !readyP2) { cycleColor(colorSelection, 'p2', -1); updateColorSelectorsUI(); syncClientMenu(); }
            if ((e.code === COLOR_KEYS.p1.next || e.code === COLOR_KEYS.p2.next) && !readyP2) { cycleColor(colorSelection, 'p2', 1); updateColorSelectorsUI(); syncClientMenu(); }
            if (e.code === configKeys.p1.attack || e.code === configKeys.p2.attack) { readyP2 = true; syncClientMenu(); }
        }

        if (netRole !== 'client' && readyP1 && readyP2) initBattle();
    }

    if (netRole === 'client') sendClientInputs();

    let activeControlCodes = [
        configKeys.p1.up, configKeys.p1.down, configKeys.p1.left, configKeys.p1.right, configKeys.p1.attack,
        configKeys.p2.up, configKeys.p2.down, configKeys.p2.left, configKeys.p2.right, configKeys.p2.attack
    ];
    if (activeControlCodes.includes(e.code)) e.preventDefault();
});

window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
    if (netRole === 'client') sendClientInputs();
});

// ---------- Меню настроек ----------
function showSettingsPanel() { modeSelection.style.display = "none"; settingsPanel.style.display = "flex"; updateSettingsButtonsLabels(); }
function hideSettingsPanel() { awaitingKeyFor = null; settingsPanel.style.display = "none"; modeSelection.style.display = "flex"; }

function assignKey(player, action) {
    awaitingKeyFor = { player, action };
    updateSettingsButtonsLabels();
    const btn = document.getElementById(`btn-${player}-${action}`);
    btn.textContent = "Нажмите клавишу...";
    btn.classList.add("waiting");
}

function updateSettingsButtonsLabels() {
    const players = ['p1', 'p2'];
    const actions = ['up', 'down', 'left', 'right', 'attack'];
    players.forEach(p => {
        actions.forEach(a => {
            const btn = document.getElementById(`btn-${p}-${a}`);
            btn.textContent = configKeys[p][a].replace("Key", "").replace("Arrow", "🡡 ");
            btn.classList.remove("waiting");
        });
    });
}

function updateControlsBarText() {
    let p1Txt = `P1: ${configKeys.p1.up}/${configKeys.p1.left}/${configKeys.p1.down}/${configKeys.p1.right}`.replace(/Key/g, "");
    let p2Txt = `P2: ${configKeys.p2.up}/${configKeys.p2.left}/${configKeys.p2.down}/${configKeys.p2.right}`.replace(/Key/g, "").replace(/Arrow/g, "🡡");
    document.getElementById("control-badge").textContent = `${p1Txt} + ${configKeys.p1.attack.replace("Space", "Пробел")} | ${p2Txt} + ${configKeys.p2.attack.replace("Enter", "Ввод")}`;
}

// ---------- Сетевой обмен данными ----------
function sendClientInputs() {
    let payload = {
        type: 'inputs',
        up: !!(keys[configKeys.p1.up] || keys[configKeys.p2.up]),
        down: !!(keys[configKeys.p1.down] || keys[configKeys.p2.down]),
        left: !!(keys[configKeys.p1.left] || keys[configKeys.p2.left]),
        right: !!(keys[configKeys.p1.right] || keys[configKeys.p2.right]),
        attack: !!(keys[configKeys.p1.attack] || keys[configKeys.p2.attack])
    };
    if (conn && conn.open) conn.send(payload);
    if (rawDataChannel && rawDataChannel.readyState === "open") rawDataChannel.send(JSON.stringify(payload));
}

function syncClientMenu() {
    let payload = { type: 'menu', selectP2: selectP2, readyP2: readyP2, hatIndexP2: hatIndexP2, colorIndexP2: colorSelection.p2 };
    if (conn && conn.open) conn.send(payload);
    if (rawDataChannel && rawDataChannel.readyState === "open") rawDataChannel.send(JSON.stringify(payload));
}

function showNetworkPanel() { modeSelection.style.display = "none"; networkPanel.style.display = "flex"; resetNetworkUIs(); }
function hideNetworkPanel() { disconnectNetwork(); networkPanel.style.display = "none"; modeSelection.style.display = "flex"; }

function resetNetworkUIs() {
    document.getElementById("standard-ui").style.display = "flex";
    document.getElementById("manual-ui").style.display = "none";
    document.getElementById("manual-io-section").style.display = "none";
}
function switchManualUI() {
    document.getElementById("standard-ui").style.display = "none";
    document.getElementById("manual-ui").style.display = "flex";
}

function startLocalGame(mode) {
    gameMode = mode; netRole = 'local';
    document.getElementById("net-status-badge").textContent = "Режим: Локальный";
    updateControlsBarText();
    mainMenu.style.display = "none"; gameState = "SELECT";
    updateHatSelectorsUI();
    updateColorSelectorsUI();
}

function exitToMenu() {
    gameState = "MENU"; readyP1 = false; readyP2 = false;
    bullets = []; puddles = []; particles = []; hud.style.opacity = "0"; bossHud.style.display = "none";
    gameOverOverlay.style.display = "none"; hatSelectorsOverlay.style.display = "none"; colorSelectorsOverlay.style.display = "none";
    mainMenu.style.display = "flex"; hideNetworkPanel();
}

function disconnectNetwork() {
    if (peer) { peer.destroy(); peer = null; }
    if (rawDataChannel) { rawDataChannel.close(); rawDataChannel = null; }
    if (rawPeerConn) { rawPeerConn.close(); rawPeerConn = null; }
    conn = null; netRole = 'local';
    document.getElementById("net-status-badge").textContent = "Режим: Локальный";
}

function hostRoom() {
    disconnectNetwork();
    document.getElementById("net-status-text").textContent = "Генерация комнаты...";
    peer = new Peer(ICE_SERVERS_CONFIG);

    peer.on('open', (id) => {
        netRole = 'host'; gameMode = 'BOSS';
        document.getElementById("net-status-badge").textContent = "Режим: Онлайн (ХОСТ)";
        document.getElementById("net-status-text").innerHTML = `ID комнаты: <b style="color:#ff7700;font-size:16px;user-select:all;">${id}</b>`;
    });

    peer.on('connection', (connection) => {
        conn = connection;
        conn.on('data', (data) => {
            if (data.type === 'inputs') clientInputs = data;
            if (data.type === 'menu') { selectP2 = data.selectP2; readyP2 = data.readyP2; hatIndexP2 = data.hatIndexP2 || 0; colorSelection.p2 = (data.colorIndexP2 !== undefined) ? data.colorIndexP2 : -1; updateHatSelectorsUI(); updateColorSelectorsUI(); }
            if (data.type === 'click_action') handleClientActionClick(data.action, data.param);
        });
        conn.on('close', () => { alert("Игрок отключился."); exitToMenu(); });
        setTimeout(() => { mainMenu.style.display = "none"; gameState = "SELECT"; updateHatSelectorsUI(); updateColorSelectorsUI(); }, 300);
    });
}

function joinRoom() {
    let targetId = document.getElementById("net-id-input").value.trim();
    if (!targetId) return;
    disconnectNetwork();
    peer = new Peer(ICE_SERVERS_CONFIG);
    peer.on('open', () => {
        netRole = 'client';
        conn = peer.connect(targetId, { reliable: true });
        conn.on('open', () => {
            document.getElementById("net-status-badge").textContent = "Режим: Онлайн (КЛИЕНТ)";
            mainMenu.style.display = "none"; gameState = "SELECT"; updateHatSelectorsUI(); updateColorSelectorsUI();
        });
        conn.on('data', handleServerSyncData);
        conn.on('close', () => { alert("Потеря соединения."); exitToMenu(); });
    });
}

function clickPlayAgain() {
    if (netRole === 'client') { sendClientAction('play_again'); return; }
    gameOverMainControls.style.display = "none";
    gameOverCharacterChoice.style.display = "flex";
}

function clickReturnToMenu() {
    if (netRole === 'client') { sendClientAction('return_to_menu'); return; }
    exitToMenu();
}

function chooseCharacterReset(shouldChangeChars) {
    if (netRole === 'client') { sendClientAction('char_choice', shouldChangeChars); return; }
    if (shouldChangeChars) {
        readyP1 = false; readyP2 = false;
        gameState = "SELECT";
        gameOverOverlay.style.display = "none";
        updateHatSelectorsUI();
        updateColorSelectorsUI();
    } else {
        initBattle();
    }
}

function sendClientAction(action, param = null) {
    let payload = { type: 'click_action', action: action, param: param };
    if (conn && conn.open) conn.send(payload);
    if (rawDataChannel && rawDataChannel.readyState === "open") rawDataChannel.send(JSON.stringify(payload));
}

function handleClientActionClick(action, param) {
    if (action === 'play_again') clickPlayAgain();
    if (action === 'return_to_menu') clickReturnToMenu();
    if (action === 'char_choice') chooseCharacterReset(param);
}

function handleServerSyncData(data) {
    if (data.type === 'sync') {
        p1 = data.p1; p2 = data.p2; boss = data.boss; bullets = data.bullets; puddles = data.puddles; particles = data.particles || [];
        gameState = data.gameState; gameMode = data.gameMode; winner = data.winner;
        readyP1 = data.readyP1; selectP1 = data.selectP1; hatIndexP1 = data.hatIndexP1 || 0;
        colorSelection.p1 = (data.colorIndexP1 !== undefined) ? data.colorIndexP1 : -1;
        if (gameState !== 'SELECT') { readyP2 = data.readyP2; selectP2 = data.selectP2; }
        hud.style.opacity = (gameState === "BATTLE") ? "1" : "0";
        bossHud.style.display = (gameState === "BATTLE" && gameMode === "BOSS") ? "flex" : "none";

        updateHatSelectorsUI();
        updateColorSelectorsUI();

        if (gameState === "OVER") {
            gameOverTitle.textContent = winner;
            gameOverOverlay.style.display = "flex";
            if (data.overlaySubState === "choice") {
                gameOverMainControls.style.display = "none";
                gameOverCharacterChoice.style.display = "flex";
            } else {
                gameOverMainControls.style.display = "flex";
                gameOverCharacterChoice.style.display = "none";
            }
        } else {
            gameOverOverlay.style.display = "none";
        }
    }
}

function manualHostStart() {
    disconnectNetwork(); netRole = 'host'; gameMode = 'BOSS';
    document.getElementById("manual-step-text").innerHTML = "ШАГ 2 (ХОСТ): Отправьте код Гостю, затем ждите от него ответный код.";
    document.getElementById("manual-io-section").style.display = "flex";
    document.getElementById("manual-connect-btn").textContent = "Активировать ответный код";

    rawPeerConn = new RTCPeerConnection(ICE_SERVERS_CONFIG);
    rawDataChannel = rawPeerConn.createDataChannel("gameChannel");
    setupRawChannelEvents();

    rawPeerConn.onicecandidate = (e) => {
        if (!e.candidate) {
            document.getElementById("manual-output").value = btoa(JSON.stringify(rawPeerConn.localDescription));
        }
    };
    rawPeerConn.createOffer().then(offer => rawPeerConn.setLocalDescription(offer));
}

function manualClientStart() {
    disconnectNetwork(); netRole = 'client';
    document.getElementById("manual-step-text").innerHTML = "ШАГ 2 (ГОСТЬ): Вставьте код Хоста, нажмите 'Подключиться', скопируйте нижний код и верните его Хосту.";
    document.getElementById("manual-io-section").style.display = "flex";
    document.getElementById("manual-connect-btn").textContent = "Сгенерировать ответный код";

    rawPeerConn = new RTCPeerConnection(ICE_SERVERS_CONFIG);
    rawPeerConn.ondatachannel = (e) => {
        rawDataChannel = e.channel;
        setupRawChannelEvents();
    };
    rawPeerConn.onicecandidate = (e) => {
        if (!e.candidate) {
            document.getElementById("manual-output").value = btoa(JSON.stringify(rawPeerConn.localDescription));
        }
    };
}

function manualConnectTrigger() {
    let inputStr = document.getElementById("manual-input").value.trim();
    if (!inputStr) return alert("Поле ввода пустое!");
    try {
        let parsedDesc = JSON.parse(atob(inputStr));
        if (netRole === 'client' && !rawPeerConn.currentRemoteDescription) {
            rawPeerConn.setRemoteDescription(new RTCSessionDescription(parsedDesc))
                .then(() => rawPeerConn.createAnswer())
                .then(answer => rawPeerConn.setLocalDescription(answer));
            document.getElementById("manual-step-text").innerHTML = "ШАГ 3 (ГОСТЬ): Скопируйте верхний код и отправьте его Хосту!";
        } else if (netRole === 'host') {
            rawPeerConn.setRemoteDescription(new RTCSessionDescription(parsedDesc));
        }
    } catch (err) { alert("Ошибка разбора кода."); }
}

function setupRawChannelEvents() {
    rawDataChannel.onopen = () => {
        document.getElementById("net-status-badge").textContent = netRole === 'host' ? "Режим: Ручной (ХОСТ)" : "Режим: Ручной (КЛИЕНТ)";
        mainMenu.style.display = "none"; gameState = "SELECT"; updateHatSelectorsUI(); updateColorSelectorsUI();
    };
    rawDataChannel.onmessage = (e) => {
        let data = JSON.parse(e.data);
        if (netRole === 'host') {
            if (data.type === 'inputs') clientInputs = data;
            if (data.type === 'menu') { selectP2 = data.selectP2; readyP2 = data.readyP2; hatIndexP2 = data.hatIndexP2 || 0; colorSelection.p2 = (data.colorIndexP2 !== undefined) ? data.colorIndexP2 : -1; updateHatSelectorsUI(); updateColorSelectorsUI(); }
            if (data.type === 'click_action') handleClientActionClick(data.action, data.param);
        } else {
            handleServerSyncData(data);
        }
    };
    rawDataChannel.onclose = () => { alert("Соединенние разорвано."); exitToMenu(); };
}

// ---------- Шляпы ----------
function changeHatIndex(player, dir) {
    if (gameState !== "SELECT") return;
    if (player === 'p1' && netRole === 'client') return;
    if (player === 'p2' && netRole === 'host') return;

    if (player === 'p1') {
        if (readyP1) return;
        hatIndexP1 = (hatIndexP1 + dir + HATS.length) % HATS.length;
    } else {
        if (readyP2) return;
        hatIndexP2 = (hatIndexP2 + dir + HATS.length) % HATS.length;
        if (netRole === 'client') syncClientMenu();
    }
    updateHatSelectorsUI();
}

function updateHatSelectorsUI() {
    if (gameState === "SELECT") {
        hatSelectorsOverlay.style.display = "flex";
        document.getElementById("hat-label-p1").textContent = "Шляпа: " + HAT_LABELS[HATS[hatIndexP1]];
        document.getElementById("hat-label-p2").textContent = "Шляпа: " + HAT_LABELS[HATS[hatIndexP2]];

        document.getElementById("hat-box-p1").style.opacity = (netRole === 'client') ? "0.3" : "1";
        document.getElementById("hat-box-p2").style.opacity = (netRole === 'host') ? "0.3" : "1";
    } else {
        hatSelectorsOverlay.style.display = "none";
    }
}

// ---------- Кастомные цвета (новая функциональность) ----------
function changeColorIndex(player, dir) {
    if (gameState !== "SELECT") return;
    if (player === 'p1' && netRole === 'client') return;
    if (player === 'p2' && netRole === 'host') return;

    if (player === 'p1') {
        if (readyP1) return;
        cycleColor(colorSelection, 'p1', dir);
    } else {
        if (readyP2) return;
        cycleColor(colorSelection, 'p2', dir);
        if (netRole === 'client') syncClientMenu();
    }
    updateColorSelectorsUI();
}

function updateColorSelectorsUI() {
    if (gameState === "SELECT") {
        colorSelectorsOverlay.style.display = "flex";

        const colorP1 = getResolvedColor(colorSelection, 'p1', CLASSES[selectP1].color);
        const colorP2 = getResolvedColor(colorSelection, 'p2', CLASSES[selectP2].color);

        document.getElementById("color-label-p1").textContent = getColorLabel(colorSelection, 'p1');
        document.getElementById("color-label-p2").textContent = getColorLabel(colorSelection, 'p2');
        document.getElementById("color-swatch-p1").style.backgroundColor = colorP1;
        document.getElementById("color-swatch-p2").style.backgroundColor = colorP2;

        document.getElementById("color-box-p1").style.opacity = (netRole === 'client') ? "0.3" : "1";
        document.getElementById("color-box-p2").style.opacity = (netRole === 'host') ? "0.3" : "1";
    } else {
        colorSelectorsOverlay.style.display = "none";
    }
}

// ---------- Инициализация боя ----------
function initBattle() {
    for (let key in keys) { keys[key] = false; }
    clientInputs = { up: false, down: false, left: false, right: false, attack: false };

    let p1Hat = HATS[hatIndexP1];
    let p2Hat = HATS[hatIndexP2];

    p1 = { ...CLASSES[selectP1], x: 100, y: 160, size: 28, hp: CLASSES[selectP1].maxHp, dirX: 1, dirY: 0, curCd: 0, slashTime: 0, slashAngle: 0, isP1: true, shotCount: 0, dead: false, stunTime: 0, poisonTime: 0, hat: p1Hat };
    p2 = { ...CLASSES[selectP2], x: 100, y: 340, size: 28, hp: CLASSES[selectP2].maxHp, dirX: 1, dirY: 0, curCd: 0, slashTime: 0, slashAngle: 0, isP1: false, shotCount: 0, dead: false, stunTime: 0, poisonTime: 0, hat: p2Hat };

    // Применяем кастомные цвета игроков (если выбраны), сохраняя их визуальный стиль на бой.
    p1.color = getResolvedColor(colorSelection, 'p1', CLASSES[selectP1].color);
    p2.color = getResolvedColor(colorSelection, 'p2', CLASSES[selectP2].color);

    if (gameMode === "BOSS") {
        p1.x = 240; p1.y = 360;
        p2.x = 540; p2.y = 360; p2.dirX = -1;
        boss = {
            x: 370, y: 120, w: 75, h: 75, hp: 1500, maxHp: 1500,
            shootCd: 0, specialCd: 120, dead: false, anim: 0,
            stunTime: 0, poisonTime: 0, targetX: 410, targetY: 150, speed: 2.8, changeWpCd: 0,
            segments: [{ x: 370, y: 120 }, { x: 370, y: 120 }, { x: 370, y: 120 }, { x: 370, y: 120 }]
        };
        bossHud.style.display = "flex";
    } else {
        p1.x = 80; p1.y = 240; p2.x = 700; p2.y = 240; p2.dirX = -1;
        bossHud.style.display = "none";
    }

    bullets = []; puddles = []; particles = []; winner = "";
    gameOverOverlay.style.display = "none";
    gameOverMainControls.style.display = "flex";
    gameOverCharacterChoice.style.display = "none";
    hatSelectorsOverlay.style.display = "none";
    colorSelectorsOverlay.style.display = "none";
    gameState = "BATTLE"; hud.style.opacity = "1";
}

function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
            size: Math.random() * 4 + 2, color: color, life: Math.random() * 20 + 10
        });
    }
}

function spawnPuddle(x, y, isFromP1, color) {
    puddles.push({ x: x, y: y, r: 15, maxR: 45, life: 180, color: color, isFromP1: isFromP1 });
}

function spawnFlameWave(x, y, vx, vy) {
    bullets.push({ x: x, y: y, vx: vx, vy: vy, size: 14, damage: 6, color: "#ff3333", isBossBullet: true, isFlame: true });
}

function attack(at, df) {
    if (at.curCd > 0) return;
    at.curCd = at.cooldown;
    let centerX = at.x + at.size / 2; let centerY = at.y + at.size / 2;

    if (at.type === "bullet") {
        bullets.push({ x: centerX, y: centerY, vx: at.dirX * at.bulletSpeed, vy: at.dirY * at.bulletSpeed, size: at.bulletSize, damage: at.damage, color: at.color, isFromP1: at.isP1, trail: [] });
    }
    else if (at.type === "magic") {
        at.shotCount++; let isHomingShot = (at.shotCount % 3 === 0);
        bullets.push({
            x: centerX, y: centerY,
            vx: isHomingShot ? at.dirX * 9.5 : at.dirX * at.bulletSpeed, vy: isHomingShot ? at.dirY * 9.5 : at.dirY * at.bulletSpeed,
            size: isHomingShot ? at.bulletSize * 1.5 : at.bulletSize, damage: isHomingShot ? Math.round(at.damage * 0.75) : at.damage,
            color: isHomingShot ? "#a252ff" : at.color, isFromP1: at.isP1, isMagic: true, isHoming: isHomingShot, trail: []
        });
    }
    else if (at.type === "poison_scout") {
        at.shotCount++; let isStunShot = (at.shotCount % 5 === 0);
        bullets.push({
            x: centerX, y: centerY, vx: at.dirX * at.bulletSpeed, vy: at.dirY * at.bulletSpeed,
            size: isStunShot ? at.bulletSize * 2.2 : at.bulletSize, damage: isStunShot ? 0 : at.damage,
            color: isStunShot ? "#ff7700" : at.color, isFromP1: at.isP1, isPoisonLaser: !isStunShot, isPumpkinStun: isStunShot, trail: []
        });
    }
    else if (at.type === "stun_scout") {
        at.shotCount++; let isStunShot = (at.shotCount % 5 === 0);
        bullets.push({
            x: centerX, y: centerY, vx: at.dirX * at.bulletSpeed, vy: at.dirY * at.bulletSpeed,
            size: isStunShot ? at.bulletSize * 1.5 : at.bulletSize, damage: at.damage, color: isStunShot ? "#d100ff" : at.color,
            isFromP1: at.isP1, isStunLaser: isStunShot, trail: []
        });
    }
    else if (at.type === "auto_aim") {
        let targetX = canvas.width / 2, targetY = canvas.height / 2;
        if (gameMode === "BOSS") { targetX = boss.x + boss.w / 2; targetY = boss.y + boss.h / 2; }
        else { targetX = df.x + df.size / 2; targetY = df.y + df.size / 2; }
        let angle = Math.atan2(targetY - centerY, targetX - centerX);
        bullets.push({ x: centerX, y: centerY, vx: Math.cos(angle) * at.bulletSpeed, vy: Math.sin(angle) * at.bulletSpeed, size: at.bulletSize, damage: at.damage, color: at.color, isFromP1: at.isP1, trail: [] });
    }
    // УСИЛЕННЫЙ ВЫСТРЕЛ ДРОБОВИКА (7 дробин вместо 5)
    else if (at.type === "shotgun") {
        let baseAngle = Math.atan2(at.dirY, at.dirX);
        for (let i = -3; i <= 3; i++) {
            let angle = baseAngle + (i * 0.12);
            bullets.push({ x: centerX, y: centerY, vx: Math.cos(angle) * at.bulletSpeed, vy: Math.sin(angle) * at.bulletSpeed, size: at.bulletSize, damage: at.damage, color: at.color, isFromP1: at.isP1, trail: [] });
        }
    }
    else if (at.type === "melee") {
        at.slashTime = 14; at.slashAngle = Math.atan2(at.dirY, at.dirX);
        let targetX = (gameMode === "BOSS") ? boss.x + boss.w / 2 : df.x + df.size / 2;
        let targetY = (gameMode === "BOSS") ? boss.y + boss.h / 2 : df.y + df.size / 2;
        let dist = Math.hypot(targetX - centerX, targetY - centerY);
        if (dist < at.range + 15) {
            let angleToTarget = Math.atan2(targetY - centerY, targetX - centerX);
            let angleDiff = angleToTarget - at.slashAngle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2; while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            if (Math.abs(angleDiff) <= 1.5) {
                if (gameMode === "BOSS") { boss.hp -= at.damage; createParticles(targetX, targetY, at.color, 15); }
                else if (!df.dead) { df.hp -= at.damage; createParticles(targetX, targetY, at.color, 15); }
            }
        }
    }
    else if (at.type === "dash_trail") {
        let dashDist = at.range; let stepX = at.dirX * 5; let stepY = at.dirY * 5;
        for (let k = 0; k < dashDist / 5; k++) {
            at.x += stepX; at.y += stepY;
            if (at.x < 15) at.x = 15; if (at.x > canvas.width - at.size - 15) at.x = canvas.width - at.size - 15;
            if (at.y < 15) at.y = 15; if (at.y > canvas.height - at.size - 15) at.height = canvas.height - at.size - 15;
            if (k % 3 === 0) { puddles.push({ x: at.x + at.size / 2, y: at.y + at.size / 2, r: 8, maxR: 28, life: 120, color: at.color, isFromP1: at.isP1 }); }
        }
        createParticles(at.x + at.size / 2, at.y + at.size / 2, "#ffffff", 15);
    }
}

function handleMeleeDeflect(p) {
    if (p.type !== "melee" || p.slashTime <= 0) return;
    let centerX = p.x + p.size / 2; let centerY = p.y + p.size / 2;

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; let isEnemyBullet = gameMode === "BOSS" ? b.isBossBullet : (b.isFromP1 !== p.isP1);
        if (isEnemyBullet) {
            let dist = Math.hypot(b.x - centerX, b.y - centerY);
            if (dist <= p.range + 20) {
                let angleToBullet = Math.atan2(b.y - centerY, b.x - centerX);
                let angleDiff = angleToBullet - p.slashAngle;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2; while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                if (Math.abs(angleDiff) <= 1.5) {
                    b.isBossBullet = false; b.isFromP1 = p.isP1; b.color = p.color; b.vx = -b.vx * 1.3; b.vy = -b.vy * 1.3;
                    createParticles(b.x, b.y, "#ffffff", 4); createParticles(b.x, b.y, p.color, 4);
                }
            }
        }
    }
}

function update() {
    if (netRole === 'client') return;

    if (gameState === "BATTLE") {
        let p1MoveX = 0, p1MoveY = 0;
        if (!p1.dead && p1.stunTime <= 0) {
            if (keys[configKeys.p1.up]) { p1MoveY = -1; p1.dirY = -1; }
            if (keys[configKeys.p1.down]) { p1MoveY = 1; p1.dirY = 1; }
            if (keys[configKeys.p1.left]) { p1MoveX = -1; p1.dirX = -1; }
            if (keys[configKeys.p1.right]) { p1MoveX = 1; p1.dirX = 1; }
            if (p1MoveX !== 0 && p1MoveY !== 0) { p1.dirX = p1MoveX; p1.dirY = p1MoveY; }
            else if (p1MoveX !== 0) p1.dirY = 0; else if (p1MoveY !== 0) p1.dirX = 0;

            p1.x += p1MoveX * p1.speed; p1.y += p1MoveY * p1.speed;
            if (p1.x < 15) p1.x = 15; if (p1.x > canvas.width - p1.size - 15) p1.x = canvas.width - p1.size - 15;
            if (p1.y < 15) p1.y = 15; if (p1.y > canvas.height - p1.size - 15) p1.y = canvas.height - p1.size - 15;
            if (keys[configKeys.p1.attack]) attack(p1, p2);
        }

        let p2MoveX = 0, p2MoveY = 0;
        if (!p2.dead && p2.stunTime <= 0) {
            let u = false, d = false, l = false, r = false, atk = false;
            if (netRole === 'host') {
                u = clientInputs.up; d = clientInputs.down; l = clientInputs.left; r = clientInputs.right; atk = clientInputs.attack;
            } else if (netRole === 'local') {
                u = keys[configKeys.p2.up]; d = keys[configKeys.p2.down]; l = keys[configKeys.p2.left]; r = keys[configKeys.p2.right]; atk = keys[configKeys.p2.attack];
            }

            if (u) { p2MoveY = -1; p2.dirY = -1; }
            if (d) { p2MoveY = 1; p2.dirY = 1; }
            if (l) { p2MoveX = -1; p2.dirX = -1; }
            if (r) { p2MoveX = 1; p2.dirX = 1; }
            if (p2MoveX !== 0 && p2MoveY !== 0) { p2.dirX = p2MoveX; p2.dirY = p2MoveY; }
            else if (p2MoveX !== 0) p2.dirY = 0; else if (p2MoveY !== 0) p2.dirX = 0;

            p2.x += p2MoveX * p2.speed; p2.y += p2MoveY * p2.speed;
            if (p2.x < 15) p2.x = 15; if (p2.x > canvas.width - p2.size - 15) p2.x = canvas.width - p2.size - 15;
            if (p2.y < 15) p2.y = 15; if (p2.y > canvas.height - p2.size - 15) p2.y = canvas.height - p2.size - 15;
            if (atk) attack(p2, p1);
        }

        if (p1.slashTime > 0) handleMeleeDeflect(p1);
        if (p2.slashTime > 0) handleMeleeDeflect(p2);

        if (p1.curCd > 0) p1.curCd--; if (p2.curCd > 0) p2.curCd--;
        if (p1.slashTime > 0) p1.slashTime--; if (p2.slashTime > 0) p2.slashTime--;
        if (p1.stunTime > 0) p1.stunTime--; if (p2.stunTime > 0) p2.stunTime--;

        if (p1.poisonTime > 0) { p1.poisonTime--; if (p1.poisonTime % 30 === 0) { p1.hp -= 2; createParticles(p1.x + p1.size / 2, p1.y + p1.size / 2, "#2ecc71", 3); } }
        if (p2.poisonTime > 0) { p2.poisonTime--; if (p2.poisonTime % 30 === 0) { p2.hp -= 2; createParticles(p2.x + p2.size / 2, p2.y + p2.size / 2, "#2ecc71", 3); } }

        if (gameMode === "BOSS" && !boss.dead) {
            if (boss.stunTime > 0) { boss.stunTime--; } else {
                boss.anim += 0.05;
                if (boss.changeWpCd <= 0 || Math.hypot((boss.x + boss.w / 2) - boss.targetX, (boss.y + boss.h / 2) - boss.targetY) < 30) {
                    boss.targetX = Math.random() * (canvas.width - 250) + 125; boss.targetY = Math.random() * (canvas.height - 220) + 110;
                    boss.changeWpCd = 160;
                }
                boss.changeWpCd--;

                let angleToTarget = Math.atan2(boss.targetY - (boss.y + boss.h / 2), boss.targetX - (boss.x + boss.w / 2));
                boss.x += Math.cos(angleToTarget) * boss.speed; boss.y += Math.sin(angleToTarget) * boss.speed;

                let bCenterX = boss.x + boss.w / 2; let bCenterY = boss.y + boss.h / 2;

                if (boss.segments && boss.segments.length > 0) {
                    let lastX = bCenterX, lastY = bCenterY;
                    for (let s = 0; s < boss.segments.length; s++) {
                        let seg = boss.segments[s];
                        let dx = lastX - seg.x;
                        let dy = lastY - seg.y;
                        let dist = Math.hypot(dx, dy);
                        if (dist > 18) {
                            seg.x += (dx / dist) * (dist - 18);
                            seg.y += (dy / dist) * (dist - 18);
                        }
                        lastX = seg.x; lastY = seg.y;
                    }
                }

                if (boss.shootCd > 0) boss.shootCd--;
                else {
                    boss.shootCd = 40; let target = (!p1.dead && (Math.random() > 0.5 || p2.dead)) ? p1 : p2;
                    if (!target.dead) {
                        let angle = Math.atan2((target.y + target.size / 2) - bCenterY, (target.x + target.size / 2) - bCenterX);
                        bullets.push({ x: bCenterX, y: bCenterY, vx: Math.cos(angle) * 7.5, vy: Math.sin(angle) * 7.5, size: 8, damage: 14, color: "#ff3333", isBossBullet: true });
                    }
                }

                if (boss.specialCd > 0) boss.specialCd--;
                else {
                    boss.specialCd = 140; let baseAngle = angleToTarget; let spreads = [-0.4, -0.2, 0, 0.2, 0.4];
                    for (let spread of spreads) { spawnFlameWave(bCenterX, bCenterY, Math.cos(baseAngle + spread) * 6, Math.sin(baseAngle + spread) * 6); }
                }
            }

            if (boss.poisonTime > 0) { boss.poisonTime--; if (boss.poisonTime % 30 === 0) { boss.hp -= 5; createParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, "#2ecc71", 4); } }
            if (boss.hp <= 0) { boss.hp = 0; boss.dead = true; winner = "ГЕРОИ ОДЕРЖАЛИ ПОБЕДУ!"; gameState = "OVER"; triggerGameOverPanel(winner); }
        }

        for (let i = puddles.length - 1; i >= 0; i--) {
            let pd = puddles[i]; if (pd.r < pd.maxR) pd.r += 0.6; pd.life--;
            if (pd.life % 20 === 0) {
                if (gameMode === "PVP") {
                    if (pd.isFromP1 && Math.hypot((p2.x + p2.size / 2) - pd.x, (p2.y + p2.size / 2) - pd.y) < pd.r && !p2.dead) p2.hp -= 3;
                    if (!pd.isFromP1 && Math.hypot((p1.x + p1.size / 2) - pd.x, (p1.y + p1.size / 2) - pd.y) < pd.r && !p1.dead) p1.hp -= 3;
                } else {
                    if (Math.hypot((p1.x + p1.size / 2) - pd.x, (p1.y + p1.size / 2) - pd.y) < pd.r && !p1.dead) p1.hp -= 2;
                    if (Math.hypot((p2.x + p2.size / 2) - pd.x, (p2.y + p2.size / 2) - pd.y) < pd.r && !p2.dead) p2.hp -= 2;
                    if (Math.hypot((boss.x + boss.w / 2) - pd.x, (boss.y + boss.h / 2) - pd.y) < pd.r + boss.w / 2 && !boss.dead) boss.hp -= 4;
                }
            }
            if (pd.life <= 0) puddles.splice(i, 1);
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i]; b.x += b.vx; b.y += b.vy;
            if (b.trail) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 5) b.trail.shift(); }

            if (b.isMagic && b.isHoming) {
                let target = b.isFromP1 ? p2 : p1; if (gameMode === "BOSS") target = boss;
                let tx = gameMode === "BOSS" ? target.x + boss.w / 2 : target.x + target.size / 2;
                let ty = gameMode === "BOSS" ? target.y + boss.h / 2 : target.y + target.size / 2;
                let targetAngle = Math.atan2(ty - b.y, tx - b.x); let currentAngle = Math.atan2(b.vy, b.vx);
                let angleDiff = targetAngle - currentAngle;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2; while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                let maxTurn = 0.05; if (Math.abs(angleDiff) > maxTurn) currentAngle += Math.sign(angleDiff) * maxTurn; else currentAngle = targetAngle;
                b.vx = Math.cos(currentAngle) * 9.5; b.vy = Math.sin(currentAngle) * 9.5;
            }

            if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
                if (b.isMagic || b.isPoisonLaser) spawnPuddle(Math.max(10, Math.min(canvas.width - 10, b.x)), Math.max(10, Math.min(canvas.height - 10, b.y)), b.isFromP1, b.color);
                bullets.splice(i, 1); continue;
            }

            if (gameMode === "PVP") {
                let target = b.isFromP1 ? p2 : p1;
                if (!target.dead && Math.hypot(b.x - (target.x + target.size / 2), b.y - (target.y + target.size / 2)) < target.size / 2 + 4) {
                    target.hp -= b.damage; createParticles(b.x, b.y, b.color, 6);
                    if (b.isMagic || b.isPoisonLaser) spawnPuddle(target.x + target.size / 2, target.y + target.size / 2, b.isFromP1, b.color);
                    if (b.isPoisonLaser) target.poisonTime = 150; if (b.isStunLaser) target.stunTime = 60; if (b.isPumpkinStun) target.stunTime = 90;
                    bullets.splice(i, 1); continue;
                }
            } else {
                if (b.isBossBullet) {
                    if (!p1.dead && Math.hypot(b.x - (p1.x + p1.size / 2), b.y - (p1.y + p1.size / 2)) < p1.size / 2 + 4) { p1.hp -= b.damage; createParticles(b.x, b.y, b.color, 6); bullets.splice(i, 1); continue; }
                    if (!p2.dead && Math.hypot(b.x - (p2.x + p2.size / 2), b.y - (p2.y + p2.size / 2)) < p2.size / 2 + 4) { p2.hp -= b.damage; createParticles(b.x, b.y, b.color, 6); bullets.splice(i, 1); continue; }
                } else {
                    if (!boss.dead && b.x > boss.x && b.x < boss.x + boss.w && b.y > boss.y && b.y < boss.y + boss.h) {
                        boss.hp -= b.damage; createParticles(b.x, b.y, b.color, 6);
                        if (b.isMagic || b.isPoisonLaser) spawnPuddle(b.x, b.y, b.isFromP1, b.color);
                        if (b.isPoisonLaser) boss.poisonTime = 150; if (b.isStunLaser) boss.stunTime = 60; if (b.isPumpkinStun) boss.stunTime = 90;
                        bullets.splice(i, 1); continue;
                    }
                }
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            let pt = particles[i]; pt.x += pt.vx; pt.y += pt.vy; pt.life--; if (pt.life <= 0) particles.splice(i, 1);
        }

        if (p1.hp <= 0) { p1.hp = 0; p1.dead = true; }
        if (p2.hp <= 0) { p2.hp = 0; p2.dead = true; }

        if (gameMode === "PVP") {
            if (p1.dead && p2.dead) { winner = "НИЧЬЯ!"; gameState = "OVER"; triggerGameOverPanel(winner); }
            else if (p1.dead) { winner = `${p2.name} ОДЕРЖАЛ ПОБЕДУ!`; gameState = "OVER"; triggerGameOverPanel(winner); }
            else if (p2.dead) { winner = `${p1.name} ОДЕРЖАЛ ПОБЕДУ!`; gameState = "OVER"; triggerGameOverPanel(winner); }
        } else {
            if (p1.dead && p2.dead) { winner = "ЛЕВИАФАН УНИЧТОЖИЛ ГЕРОЕВ!"; gameState = "OVER"; triggerGameOverPanel(winner); }
        }
    }

    if (netRole === 'host') {
        let currentSubState = (gameOverCharacterChoice.style.display === "flex") ? "choice" : "main";
        let packet = {
            type: 'sync', gameState: gameState, gameMode: gameMode, winner: winner,
            readyP1: readyP1, selectP1: selectP1, readyP2: readyP2, selectP2: selectP2,
            hatIndexP1: hatIndexP1, hatIndexP2: hatIndexP2,
            colorIndexP1: colorSelection.p1, colorIndexP2: colorSelection.p2,
            p1: p1, p2: p2, boss: boss, bullets: bullets, puddles: puddles, particles: particles,
            overlaySubState: currentSubState
        };
        if (conn && conn.open) conn.send(packet);
        if (rawDataChannel && rawDataChannel.readyState === "open") rawDataChannel.send(JSON.stringify(packet));
    }
}

function triggerGameOverPanel(msg) {
    gameOverTitle.textContent = msg;
    gameOverMainControls.style.display = "flex";
    gameOverCharacterChoice.style.display = "none";
    gameOverOverlay.style.display = "flex";
    hatSelectorsOverlay.style.display = "none";
    colorSelectorsOverlay.style.display = "none";
}

function gameLoop() {
    update();
    render(ctx, canvas, {
        gameState, gameMode, selectP1, selectP2, readyP1, readyP2,
        netRole, configKeys, p1, p2, boss, bullets, puddles, particles
    });
    requestAnimationFrame(gameLoop);
}

// ---------- Привязка кнопок интерфейса (замена inline onclick) ----------
function bindUI() {
    document.getElementById("btn-mode-pvp").addEventListener("click", () => startLocalGame('PVP'));
    document.getElementById("btn-mode-boss").addEventListener("click", () => startLocalGame('BOSS'));
    document.getElementById("btn-mode-network").addEventListener("click", showNetworkPanel);
    document.getElementById("btn-mode-settings").addEventListener("click", showSettingsPanel);

    ['p1', 'p2'].forEach(p => {
        ['up', 'down', 'left', 'right', 'attack'].forEach(a => {
            document.getElementById(`btn-${p}-${a}`).addEventListener("click", () => assignKey(p, a));
        });
    });
    document.getElementById("btn-settings-done").addEventListener("click", hideSettingsPanel);

    document.getElementById("btn-host-room").addEventListener("click", hostRoom);
    document.getElementById("btn-join-room").addEventListener("click", joinRoom);
    document.getElementById("btn-manual-switch").addEventListener("click", switchManualUI);
    document.getElementById("btn-network-back").addEventListener("click", hideNetworkPanel);

    document.getElementById("btn-manual-host").addEventListener("click", manualHostStart);
    document.getElementById("btn-manual-client").addEventListener("click", manualClientStart);
    document.getElementById("manual-connect-btn").addEventListener("click", manualConnectTrigger);
    document.getElementById("manual-output").addEventListener("click", function () { this.select(); });

    document.getElementById("hat-p1-prev").addEventListener("click", () => changeHatIndex('p1', -1));
    document.getElementById("hat-p1-next").addEventListener("click", () => changeHatIndex('p1', 1));
    document.getElementById("hat-p2-prev").addEventListener("click", () => changeHatIndex('p2', -1));
    document.getElementById("hat-p2-next").addEventListener("click", () => changeHatIndex('p2', 1));

    document.getElementById("color-p1-prev").addEventListener("click", () => changeColorIndex('p1', -1));
    document.getElementById("color-p1-next").addEventListener("click", () => changeColorIndex('p1', 1));
    document.getElementById("color-p2-prev").addEventListener("click", () => changeColorIndex('p2', -1));
    document.getElementById("color-p2-next").addEventListener("click", () => changeColorIndex('p2', 1));

    document.getElementById("btn-replay-trigger").addEventListener("click", clickPlayAgain);
    document.getElementById("btn-menu-trigger").addEventListener("click", clickReturnToMenu);
    document.getElementById("btn-char-yes").addEventListener("click", () => chooseCharacterReset(true));
    document.getElementById("btn-char-no").addEventListener("click", () => chooseCharacterReset(false));
}

// ---------- Старт ----------
bindUI();
updateControlsBarText();
requestAnimationFrame(gameLoop);
