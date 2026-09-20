import { Game } from '../core/runtime.js';
import { clamp, lerp, seedRandom } from '../core/math.js';
import { board, cannon, gate, castle, tree, flag } from '../core/models.js';
import { CROWD } from '../levels.js';
class Crowd extends Game {
    constructor(ctx, index) { super(ctx, structuredClone(CROWD[index])); this.index = index; this.agents = []; this.enemies = []; this.ammo = this.level.ammo; this.used = 0; this.spawnTimer = 0; this.aim = -2.2; this.holding = false; this.keys = new Set(); this.targets = this.level.targets; this.totalHP = this.targets.reduce((s, t) => s + t.hp, 0); this.rng = seedRandom(77 + index); this.nextId = 0; this.wave = 0; this.integrity = 12; this.losses = 0; this.damage = 0; this.generated = 0; this.maxCrowd = 0; this.r.hole = [0, 0, 0]; this.r.setCamera({ eye: [0, 18, 20], at: [0, 0, -.5], width: 10.6, height: 14.9 }); }
    input(type, p) {
        if (this.result)
            return;
        if (type === 'down' || type === 'move') {
            if (type === 'down') {
                this.start();
                this.holding = true;
            }
            let q = this.r.unproject(p.x, p.y);
            this.aim = clamp(q.x, -3.85, 3.85);
        }
        if (type === 'up' || type === 'cancel') {
            this.holding = false;
            if (type === 'cancel')
                this.keys.clear();
        }
        if (type === 'key') {
            p.down ? this.keys.add(p.key) : this.keys.delete(p.key);
            if (p.down && [' ', 'arrowleft', 'arrowright', 'a', 'd'].includes(p.key))
                this.start();
        }
    }
    spawn(x, z, mask = 0, laneX = x) { this.agents.push({ id: this.nextId++, x, z, mask, laneX, alive: true }); this.generated++; }
    update(dt) {
        super.update(dt);
        if (!this.started || this.result)
            return;
        const t = this.time;
        if (this.keys.has('a') || this.keys.has('arrowleft'))
            this.aim = clamp(this.aim - dt * 5, -3.85, 3.85);
        if (this.keys.has('d') || this.keys.has('arrowright'))
            this.aim = clamp(this.aim + dt * 5, -3.85, 3.85);
        this.spawnTimer -= dt;
        if ((this.holding || this.keys.has(' ')) && this.ammo > 0 && this.spawnTimer <= 0) {
            this.spawnTimer = .14;
            this.ammo--;
            this.used++;
            this.spawn(this.aim + (this.rng() - .5) * .22, 5.9);
            this.ctx.sound.play('shot', .5);
        }
        if (this.level.waves && this.wave < this.level.waves && t > 1.8 + this.wave * 3.0) {
            this.wave++;
            for (let target of this.targets)
                if (target.hp > 0)
                    for (let j = 0; j < 4; j++)
                        this.enemies.push({ x: target.x + (j - 1.5) * .24, z: target.z + 1 + j * .17, alive: true });
        }
        let clones = [];
        for (let a of this.agents) {
            if (!a.alive)
                continue;
            const old = a.z;
            a.z -= dt * 2.95;
            if (a.mask && a.z > -.8)
                a.x = lerp(a.x, a.laneX, dt * 3.5);
            for (let g of this.level.gates) {
                let gx = g.x + (g.move ? Math.sin(t * g.speed) * g.move : 0);
                if (!(a.mask & (1 << g.id)) && old > g.z && a.z <= g.z && Math.abs(a.x - gx) < g.w * .5 - .06) {
                    a.mask |= 1 << g.id;
                    a.laneX = gx + (this.rng() - .5) * g.w * .64;
                    for (let k = 1; k < g.mult; k++)
                        clones.push({ x: clamp(a.x + (k - (g.mult - 1) / 2) * .09, gx - g.w * .46, gx + g.w * .46), z: a.z + this.rng() * .09, mask: a.mask, laneX: gx + (this.rng() - .5) * g.w * .64 });
                    this.ctx.sound.play('multiply', .4);
                }
            }
            if (this.level.press && Math.abs(a.x - this.level.press.x) < this.level.press.w * .5 && Math.abs(a.z - this.level.press.z) < .5) {
                let phase = t % this.level.press.period;
                if (phase > 2.75 && phase < 3.3) {
                    a.alive = false;
                    this.losses++;
                    if (this.losses % 12 === 0)
                        this.particles.burst([a.x, .25, a.z], '#9fdbd3', 4, 1);
                    continue;
                }
            }
            const unlocked = !this.level.citadel || this.targets.filter(o => o.id !== 'core').every(o => o.hp <= 0);
            let target = this.targets.length === 1 ? this.targets[0] : this.level.citadel && unlocked ? this.targets.find(o => o.id === 'core') : this.targets.find(o => a.x < -1 ? o.id === 'left' : a.x > 1 ? o.id === 'right' : o.id === 'core');
            if (target && a.z < -.8) {
                if (target.id !== 'core' || unlocked || this.targets.length === 1)
                    a.x = lerp(a.x, target.x, dt * 2.1);
                if (a.z <= target.z + .65) {
                    a.alive = false;
                    if (target.hp > 0 && (target.id !== 'core' || unlocked)) {
                        target.hp--;
                        this.damage++;
                        if (target.hp === 0) {
                            this.particles.burst([target.x, 1.3, target.z], '#f2c494', 35, 4, 'box');
                            this.ctx.sound.play('impact');
                        }
                        else if (target.hp % 20 === 0)
                            this.particles.burst([target.x, 1, target.z], '#f8daa6', 5, 1.5);
                    }
                    else
                        this.losses++;
                }
            }
            if (a.z < -7.4) {
                a.alive = false;
                this.losses++;
            }
        }
        for (let c of clones)
            this.spawn(c.x, c.z, c.mask, c.laneX);
        for (let e of this.enemies) {
            if (!e.alive)
                continue;
            e.z += dt * 1.6;
            for (let a of this.agents) {
                if (a.alive && Math.abs(a.z - e.z) < .3 && Math.abs(a.x - e.x) < .36) {
                    a.alive = false;
                    e.alive = false;
                    this.losses++;
                    this.particles.burst([a.x, .3, a.z], '#ece0b8', 3, 1);
                    break;
                }
            }
            if (e.alive && e.z > 5.6) {
                e.alive = false;
                this.integrity--;
            }
        }
        this.agents = this.agents.filter(a => a.alive);
        this.enemies = this.enemies.filter(e => e.alive);
        this.maxCrowd = Math.max(this.maxCrowd, this.agents.length);
        if (this.targets.every(o => o.hp <= 0)) {
            this.finish(true, this.index === 4 ? 'Цитадель пала. Вот это каскад!' : 'Крепости не устояли перед твоей толпой.', `${this.used} из ${this.level.ammo} зарядов`, this.used <= this.level.stars[0] ? 3 : this.used <= this.level.stars[1] ? 2 : 1);
        }
        else if (this.integrity <= 0)
            this.finish(false, 'Один фронт остался без защиты. Переводи огонь между башнями.', 'Защита прорвана');
        else if (this.ammo === 0 && this.agents.length === 0)
            this.finish(false, 'Заряды закончились. Используй множители и береги поток.', `${this.damage} урона из ${this.totalHP}`);
    }
    hud() { return { value: String(this.ammo), label: 'зарядов', secondary: this.level.waves ? `Защита ${this.integrity}/12` : `В потоке ${this.agents.length}`, progress: this.damage / this.totalHP }; }
    render(t) {
        const r = this.r;
        board(r, { w: 9.8, d: 15, color: '#f3e7c9', edge: '#93b5b4', ground: '#bbced2' });
        r.box([0, .02, 0], [8.5, .035, 14.4], '#e7d7b7');
        for (let x of [-4.55, 4.55]) {
            r.box([x, .12, 0], [.18, .26, 14.8], '#faf1d8');
            for (let z = -6.4; z < 7; z += 2.2)
                flag(r, x, .12, z, '#94cbb9');
        }
        for (let z = -6; z < 6; z += 1.1)
            r.box([0, .05, z], [.06, .04, .4], '#d0bea0');
        for (let z of [-5, 0, 4])
            for (let s of [-1, 1]) {
                r.box([s * 4.85, .2, z], [.5, .4, 1.2], '#98bba1');
                tree(r, s * 4.85, z, .48, '#6a9f8a');
            }
        for (let g of this.level.gates)
            gate(r, g, this.time);
        if (this.level.press) {
            let p = this.level.press, phase = this.time % p.period, warn = phase > 2.05 && phase < 2.75, slam = phase > 2.75 && phase < 3.3, h = slam ? .28 : warn ? 1.5 : 2.6;
            for (let side of [-1, 1])
                r.box([p.x + side * (p.w / 2 + .13), 1.35, p.z], [.22, 2.7, .8], '#7895a0');
            r.box([p.x, h, p.z], [p.w, .5, .95], warn ? '#e7b14e' : slam ? '#cc796d' : '#8e9da6');
            for (let j = 0; j < 5; j++)
                r.box([p.x - 1.2 + j * .6, h - .02, p.z + .49], [.16, .42, .04], '#f7d57d', [0, 0, -.35]);
            r.label('press', warn ? 'СЕЙЧАС УДАР' : 'ПРЕСС', [p.x, 3.15, p.z], warn ? 'warning' : 'small');
        }
        for (let target of this.targets)
            castle(r, target, this.time);
        if (this.level.citadel && this.targets.some(o => o.id !== 'core' && o.hp > 0)) {
            r.box([0, .8, -4.7], [1.6, 1.6, .12], '#8cacc5');
            r.label('shield', 'Сначала боковые', [0, 2.4, -5.2], 'small');
        }
        for (let a of this.agents)
            r.draw('figure', [a.x, .02, a.z], [.67, .67, .67], '#28b8ad');
        for (let e of this.enemies)
            r.draw('figure', [e.x, .02, e.z], [.76, .76, .76], '#e96972', [0, Math.PI, 0]);
        cannon(r, this.aim, 6.55, this.holding ? Math.max(0, .07 - this.spawnTimer) * 2 : 0);
        for (let i = 0; i < 7; i++)
            r.cyl([-3.6 + i * 1.2, .05, 6.5], [.17, .05, .17], '#c4af89');
        this.particles.render(r);
    }
    snapshot() { return { ...super.snapshot(), ammo: this.ammo, used: this.used, agents: this.agents.length, enemyCount: this.enemies.length, generated: this.generated, maxCrowd: this.maxCrowd, losses: this.losses, damage: this.damage, integrity: this.integrity, targets: this.targets.map(o => ({ id: o.id, hp: o.hp, x: o.x, z: o.z })), aim: this.aim, gates: this.level.gates.map(g => ({ ...g, x: g.x + (g.move ? Math.sin(this.time * g.speed) * g.move : 0) })) }; }
}


export {Crowd};
