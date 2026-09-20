const GAMES = [
    { id: 'crowd', prefix: 'C', name: 'CROWD CASCADE', ru: 'Толпа решает', tag: 'Сила в количестве', color: '#73d2c8', icon: '↟', hint: 'Удерживай и веди пушку. Отпусти, чтобы не тратить заряды.' },
    { id: 'hole', prefix: 'H', name: 'POCKET HOLE', ru: 'Съешь этот город', tag: 'От яблока до квартала', color: '#b6c889', icon: '◉', hint: 'Тяни в нужную сторону. На компьютере — WASD или стрелки.' },
    { id: 'pins', prefix: 'P', name: 'PINFALL TREASURE', ru: 'Думай, потом тяни', tag: 'Один ход меняет всё', color: '#e9bc70', icon: '⤓', hint: 'Нажимай на кольца штифтов. Не всё нужно вытаскивать.' },
    { id: 'screws', prefix: 'S', name: 'SCREW STUDIO', ru: 'Разбери красиво', tag: 'Найди правильный порядок', color: '#b4a1d7', icon: '✣', hint: 'Нажимай на открытые болты. Собирай тройки одного цвета.' },
    { id: 'wreck', prefix: 'R', name: 'RICOCHET WRECK', ru: 'Идеальный развал', tag: 'Меньше выстрелов. Больше хаоса.', color: '#e6a49a', icon: '➶', hint: 'Потяни назад в свободном месте и отпусти. Линия покажет рикошет.' }
];
const gate = (id, x, z, mult, w = 3.2, extra = {}) => ({ id, x, z, mult, w, ...extra });
const fort = (id, x, z, hp) => ({ id, x, z, hp, max: hp });
const CROWD = [
    { id: 'C1', name: 'Шесть лучше четырёх', goal: 'Разнеси крепость. ×2 → ×3 сильнее ×4.', ammo: 64, gates: [gate(0, -2.2, 3.5, 2), gate(1, -2.2, .8, 3), gate(2, 2.2, 2.2, 4)], targets: [fort('keep', 0, -5.4, 180)], stars: [36, 47], recipe: [[-2.2, 5.5]] },
    { id: 'C2', name: 'Два фронта', goal: 'Разруши обе башни и сдержи встречные волны.', ammo: 96, gates: [gate(0, -2.2, 3, 3), gate(1, 2.2, 3, 5)], targets: [fort('left', -2.4, -5, 95), fort('right', 2.4, -5, 125)], waves: 4, stars: [74, 88], recipe: [[-2.2, 6], [2.2, 5]] },
    { id: 'C3', name: 'Поймай окно', goal: 'Лови движущиеся ×7 или выбери надёжные ×3.', ammo: 105, gates: [gate(0, -2.5, 2.8, 3, 2.8), gate(1, 2, 2.8, 7, 2, { move: 1.1, speed: .9 })], targets: [fort('keep', 0, -5.4, 240)], stars: [55, 84], recipe: [[-2.5, 12]] },
    { id: 'C4', name: 'Большая толпа, узкий проход', goal: '×9 ведёт под пресс. Жёлтый свет предупреждает об ударе.', ammo: 115, gates: [gate(0, -2.2, 3.4, 9), gate(1, 2.2, 3.4, 3)], targets: [fort('keep', 0, -5.4, 285)], press: { x: -2.2, z: .0, w: 3.3, period: 3.8 }, stars: [53, 97], recipe: [[2.2, 14.5]] },
    { id: 'C5', name: 'Цитадель', goal: 'Сначала обе боковые башни. Затем центральная цитадель.', ammo: 150, gates: [gate(0, -2.7, 3.5, 3, 2.2), gate(1, 2.7, 3.5, 4, 2.2), gate(2, 0, 3.5, 2, 1.7), gate(3, 0, 1.0, 3, 1.7)], targets: [fort('left', -2.7, -3.8, 96), fort('right', 2.7, -3.8, 116), fort('core', 0, -6.1, 210)], citadel: true, stars: [108, 132], recipe: [[-2.7, 5], [2.7, 4.5], [0, 6]] }
];
const HOLE_NAMES = ['От яблока до киоска', 'Какой квартал съесть первым?', 'Это не трогай', 'Убегающий обед', 'Весь квартал'];
const PIN_NAMES = ['Не все штифты надо вытаскивать', 'Сначала остуди', 'Отдельный слив', 'Воды не бесконечно', 'Сокровищница'];
const SCREW_NAMES = ['Леденец', 'Что под верхним слоем?', 'Последняя опора', 'Не забей лоток', 'Механическая бабочка'];
const WRECK_NAMES = ['Одна важная опора', 'За углом', 'Домино', 'Сохрани соседей', 'Идеальный развал'];
function gameMeta(id) { return GAMES.find(g => g.id === id) || GAMES[0]; }
function levelTitle(game, index) { return game === 'crowd' ? CROWD[index].name : ({ hole: HOLE_NAMES, pins: PIN_NAMES, screws: SCREW_NAMES, wreck: WRECK_NAMES }[game] || HOLE_NAMES)[index]; }
function validRoute(search) {
    const p = new URLSearchParams(search), g = GAMES.some(g => g.id === p.get('game')) ? p.get('game') : 'crowd';
    let l = Number(p.get('level') || 1);
    if (!Number.isInteger(l) || l < 1 || l > 5)
        l = 1;
    return { game: g, index: l - 1 };
}


export {GAMES,CROWD,HOLE_NAMES,PIN_NAMES,SCREW_NAMES,WRECK_NAMES,gameMeta,levelTitle,validRoute};
