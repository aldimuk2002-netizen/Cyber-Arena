// config.js
// Статические настройки игры: размеры холста, классы персонажей, шляпы,
// палитра кастомных цветов, клавиши по умолчанию и настройки WebRTC.

export const CANVAS_WIDTH = 820;
export const CANVAS_HEIGHT = 520;

// ДРОБОВИК УСИЛЕН: cooldown с 38 до 28, damage с 8 до 11
export const CLASSES = [
    { name: "Штурмовик", color: "#00f0ff", maxHp: 120, speed: 3.9, cooldown: 18, type: "bullet", bulletSpeed: 9, bulletSize: 6, damage: 12, desc: "Баланс скорострельности" },
    { name: "Чародей", color: "#ff00ea", maxHp: 100, speed: 3.6, cooldown: 30, type: "magic", bulletSpeed: 7, bulletSize: 8, damage: 13, desc: "Каждый 3-й снаряд — сверхбыстрый шар." },
    { name: "Меченосец", color: "#b624ff", maxHp: 140, speed: 4.4, cooldown: 22, type: "melee", damage: 25, range: 90, desc: "Взмах светового меча! ОТРАЖАЕТ вражеские снаряды обратно!" },
    { name: "Белый Кибер-Ниндзя", color: "#ffffff", maxHp: 110, speed: 4.9, cooldown: 32, type: "dash_trail", damage: 22, range: 125, desc: "Мгновенный рывок. Оставляет след." },
    { name: "Призрак Времени", color: "#ffff00", maxHp: 110, speed: 4.6, cooldown: 8, type: "auto_aim", bulletSpeed: 11, bulletSize: 5, damage: 4, desc: "Лазерный автоприцел." },
    { name: "Пулемётчик", color: "#ff7b00", maxHp: 150, speed: 3.1, cooldown: 5, type: "bullet", bulletSpeed: 10, bulletSize: 5, damage: 3, desc: "Шквал слабого огня" },
    { name: "Дробовик", color: "#00ffcc", maxHp: 110, speed: 4.1, cooldown: 28, type: "shotgun", bulletSpeed: 11, bulletSize: 5, damage: 11, desc: "Выстрел мощным веером из 7 дробин" },
    { name: "Токсичный Скаут", color: "#2ecc71", maxHp: 90, speed: 5.4, cooldown: 20, type: "poison_scout", bulletSpeed: 15, bulletSize: 4, damage: 10, desc: "Каждая 5-я атака — оранжевый стан на 1.5 сек!" },
    { name: "Скаут-Диверсант", color: "#d100ff", maxHp: 95, speed: 5.2, cooldown: 48, type: "stun_scout", bulletSpeed: 16, bulletSize: 6, damage: 8, desc: "ПЯТАЯ АТАКА: Фиолетовый заряд парализует врага!" }
];

export const HATS = ["none", "banana", "party", "halo", "tophat", "cowboy"];
export const HAT_LABELS = {
    "none": "Без шляпы",
    "banana": "Банан",
    "party": "Колпак",
    "halo": "Нимб",
    "tophat": "Цилиндр",
    "cowboy": "Ковбойская"
};

// Палитра кастомных цветов, доступных игрокам вместо цвета класса по умолчанию.
export const COLOR_PALETTE = [
    "#00f0ff", "#ff0077", "#ff00ea", "#b624ff", "#ffffff", "#ffff00",
    "#ff7b00", "#00ffcc", "#2ecc71", "#d100ff", "#ff3333", "#3498db"
];

export const COLOR_LABEL_DEFAULT = "Цвет класса";

// Клавиши, отвечающие за переключение кастомного цвета в меню выбора класса.
// Не входят в перепривязываемые configKeys, чтобы не конфликтовать с движением/атакой.
export const COLOR_KEYS = {
    p1: { prev: "KeyQ", next: "KeyE" },
    p2: { prev: "Comma", next: "Period" }
};

export const DEFAULT_KEYS = {
    p1: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", attack: "Space" },
    p2: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", attack: "Enter" }
};

export const ICE_SERVERS_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
