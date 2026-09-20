import { clamp, seedRandom, transform } from './math.js';
class Sound {
    constructor(muted = false) { this.muted = muted; this.ctx = null; this.last = new Map(); this.voices = 0; this.paused = false; this.active = new Set(); this.master = null; }
    unlock() {
        try {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.muted || this.paused ? 0 : 1;
                this.master.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended')
                this.ctx.resume().catch(() => { });
        }
        catch { }
    }
    setMuted(m) {
        this.muted = m;
        if (this.master)
            this.master.gain.setTargetAtTime(m || this.paused ? 0 : 1, this.ctx.currentTime, .005);
    }
    pause(v) {
        this.paused = v;
        if (v)
            this.stopAll();
        if (this.master)
            this.master.gain.setTargetAtTime(v || this.muted ? 0 : 1, this.ctx.currentTime, .005);
    }
    stopAll() {
        for (let o of this.active)
            try {
                o.stop();
            }
            catch { }
    }
    play(kind = 'tap', strength = 1) {
        if (this.muted || this.paused || !this.ctx || this.ctx.state !== 'running')
            return;
        let now = this.ctx.currentTime;
        if (now - (this.last.get(kind) || -10) < (kind === 'shot' ? .10 : .065) || this.voices >= 10)
            return;
        this.last.set(kind, now);
        const map = { tap: [460, .09, 'sine'], shot: [150, .07, 'triangle'], multiply: [710, .18, 'sine'], eat: [220, .14, 'sine'], grow: [410, .28, 'sine'], pin: [1100, .12, 'triangle'], water: [340, .24, 'sine'], gold: [960, .20, 'sine'], screw: [680, .11, 'triangle'], metal: [310, .2, 'triangle'], impact: [100, .19, 'triangle'], win: [640, .28, 'sine'], lose: [170, .3, 'sine'] };
        let [freq, dur, type] = map[kind] || map.tap;
        let o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, now);
        o.frequency.exponentialRampToValueAtTime(Math.max(35, freq * (kind === 'grow' || kind === 'multiply' ? 1.75 : .45)), now + dur);
        g.gain.setValueAtTime(.0001, now);
        g.gain.exponentialRampToValueAtTime(.065 * clamp(strength, .1, 1), now + .007);
        g.gain.exponentialRampToValueAtTime(.0001, now + dur);
        o.connect(g).connect(this.master);
        this.voices++;
        this.active.add(o);
        o.onended = () => { this.voices--; this.active.delete(o); o.disconnect(); g.disconnect(); };
        o.start(now);
        o.stop(now + dur + .01);
    }
}
class Effects {
    constructor(reduced = false) { this.items = []; this.rng = seedRandom(123); this.reduced = reduced; }
    burst(p, c, count = 15, power = 3, mesh = 'sphere') {
        count = Math.min(count, this.reduced ? 7 : 40);
        for (let i = 0; i < count && this.items.length < 160; i++) {
            let a = this.rng() * Math.PI * 2, k = this.rng();
            this.items.push({ p: [...p], v: [Math.cos(a) * power * k, (.5 + this.rng()) * power, Math.sin(a) * power * k], c, life: .65 + this.rng() * .6, t: 0, s: .07 + this.rng() * .09, mesh, r: this.rng() * 6 });
        }
    }
    update(dt) {
        for (let f of this.items) {
            f.t += dt;
            f.v[1] -= 8 * dt;
            for (let i = 0; i < 3; i++)
                f.p[i] += f.v[i] * dt;
            if (f.p[1] < .08) {
                f.p[1] = .08;
                f.v[1] *= -.35;
                f.v[0] *= .85;
                f.v[2] *= .85;
            }
        }
        this.items = this.items.filter(f => f.t < f.life);
    }
    render(r) {
        for (let f of this.items) {
            let s = f.s * Math.min(1, (f.life - f.t) * 4);
            r.draw(f.mesh, f.p, [s, s, s], f.c, [f.r + f.t * 4, f.r, 0]);
        }
    }
    clear() { this.items.length = 0; }
}
class Input {
    constructor(canvas, onInput, onGesture) {
        this.canvas = canvas;
        this.onInput = onInput;
        this.onGesture = onGesture;
        this.pointer = null;
        this.keys = new Set();
        this.handlers = [];
        const listen = (el, k, fn, opts) => { el.addEventListener(k, fn, opts); this.handlers.push(() => el.removeEventListener(k, fn, opts)); };
        const pos = e => { let r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, type: e.pointerType }; };
        listen(canvas, 'pointerdown', e => {
            if (this.pointer !== null || e.button > 0)
                return;
            e.preventDefault();
            canvas.focus({ preventScroll: true });
            this.onGesture();
            this.pointer = e.pointerId;
            canvas.setPointerCapture(e.pointerId);
            onInput('down', pos(e));
        });
        listen(canvas, 'pointermove', e => {
            if (this.pointer !== e.pointerId)
                return;
            e.preventDefault();
            onInput('move', pos(e));
        });
        const end = (e, cancel) => {
            if (this.pointer !== e.pointerId)
                return;
            this.pointer = null;
            onInput(cancel ? 'cancel' : 'up', pos(e));
            if (canvas.hasPointerCapture(e.pointerId))
                canvas.releasePointerCapture(e.pointerId);
        };
        listen(canvas, 'pointerup', e => end(e, false));
        listen(canvas, 'pointercancel', e => end(e, true));
        listen(canvas, 'lostpointercapture', e => {
            if (this.pointer === e.pointerId) {
                this.pointer = null;
                onInput('cancel', pos(e));
            }
        });
        listen(window, 'keydown', e => {
            if (e.target?.closest('dialog,input,select') || e.ctrlKey || e.metaKey)
                return;
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
                e.preventDefault();
                this.onGesture();
                this.keys.add(e.key.toLowerCase());
                onInput('key', { key: e.key.toLowerCase(), down: true });
            }
        });
        listen(window, 'keyup', e => { this.keys.delete(e.key.toLowerCase()); onInput('key', { key: e.key.toLowerCase(), down: false }); });
        listen(window, 'blur', () => this.cancel());
    }
    cancel() {
        const p = this.pointer;
        this.pointer = null;
        if (p !== null && this.canvas.hasPointerCapture(p))
            this.canvas.releasePointerCapture(p);
        this.keys.clear();
        this.onInput('cancel', {});
    }
    dispose() { this.cancel(); this.handlers.forEach(f => f()); }
}
class Game {
    constructor(ctx, level) { this.ctx = ctx; this.r = ctx.renderer; this.level = level; this.started = false; this.time = 0; this.state = 'ready'; this.message = ''; this.result = null; this.particles = new Effects(ctx.reduced); }
    start() {
        if (!this.started) {
            this.started = true;
            this.state = 'playing';
            this.ctx.started();
        }
    }
    update(dt) {
        if (this.started && this.state === 'playing')
            this.time += dt;
        this.particles.update(dt);
    }
    finish(win, reason, metric, stars = 1) {
        if (this.result)
            return;
        this.state = win ? 'won' : 'lost';
        this.result = { win, reason, metric, stars: win ? clamp(stars, 1, 3) : 0, time: Math.round(this.time * 10) / 10 };
        this.ctx.sound.play(win ? 'win' : 'lose');
        this.ctx.finished(this.result);
    }
    input() { }
    hud() { return { value: '', label: '', progress: 0 }; }
    snapshot() { return { state: this.state, time: this.time, started: this.started, result: this.result, level: this.level.id }; }
    dispose() { this.particles.clear(); }
}
const STORAGE_KEY = 'play-the-ad:v1';
function readSave(storage) {
    try {
        storage ||= globalThis.localStorage;
        let d = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
        if (!d || d.version !== 1)
            return { version: 1, muted: false, quality: 'high', records: {}, played: [] };
        let records = {};
        if (d.records && typeof d.records === 'object')
            for (let [k, v] of Object.entries(d.records)) {
                if (/^[CHPSR][1-5]$/.test(k) && v && Number.isFinite(v.stars) && Number.isFinite(v.time))
                    records[k] = { stars: clamp(Math.floor(v.stars), 0, 3), time: Math.max(0, v.time), metric: typeof v.metric === 'string' ? v.metric.slice(0, 150) : '' };
            }
        return { version: 1, muted: !!d.muted, quality: d.quality === 'low' ? 'low' : 'high', records, played: Array.isArray(d.played) ? [...new Set(d.played.filter(k => /^[CHPSR][1-5]$/.test(k)))] : [] };
    }
    catch {
        return { version: 1, muted: false, quality: 'high', records: {}, played: [] };
    }
}
function writeSave(d, storage) {
    try {
        storage ||= globalThis.localStorage;
        storage.setItem(STORAGE_KEY, JSON.stringify(d));
        return true;
    }
    catch {
        return false;
    }
}


export {Sound,Effects,Input,Game,STORAGE_KEY,readSave,writeSave};
