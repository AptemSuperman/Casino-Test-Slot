import { transform, clamp } from './math.js';
function board(r, { w = 10, d = 15, color = '#eadfcd', edge = '#6b98a0', ground = '#8eaab4' } = {}) { r.bg = ground.match(/\w\w/g).map(v => parseInt(v, 16) / 255); r.box([0, -.55, 0], [w + .35, .7, d + .35], edge, [0, 0, 0], r.hole[2] > 0 ? 3 : 0); r.box([0, -.15, 0], [w, .3, d], color, [0, 0, 0], r.hole[2] > 0 ? 3 : 0); r.box([0, -.92, 0], [w + .7, .14, d + .7], '#456271', [0, 0, 0], r.hole[2] > 0 ? 3 : 0); }
function tree(r, x, z, s = 1, color = '#63a683', parent = null) { r.cyl([x, .55 * s, z], [.20 * s, 1.1 * s, .20 * s], '#b58764', [0, 0, 0], 0, parent); r.sphere([x, 1.2 * s, z], [.95 * s, 1.25 * s, .90 * s], color, [0, 0, 0], 0, parent); r.sphere([x - .26 * s, 1.08 * s, z + .05 * s], [.70 * s, .85 * s, .70 * s], color, [0, 0, 0], 0, parent); }
function flag(r, x, y, z, c = '#ffbd5b', parent = null) { r.cyl([x, y + .55, z], [.05, 1.1, .05], '#efe6cf', [0, 0, 0], 1, parent); r.box([x + .22, y + .91, z], [.47, .30, .06], c, [0, 0, -.10], 0, parent); }
function cannon(r, x, z, kick = 0) { const p = transform([x, 0, z]); r.cyl([0, .16, 0], [1.12, .26, .95], '#2f626e', [0, 0, 0], 0, p); r.cyl([0, .32, 0], [.83, .20, .76], '#fae3b5', [0, 0, 0], 1, p); r.sphere([0, .61, 0], [.75, .68, .67], '#29bcb6', [0, 0, 0], 0, p); r.cyl([0, .66, -.46 + kick], [.62, .88, .62], '#24a7a2', [Math.PI / 2, 0, 0], 0, p); r.cyl([0, .66, -.90 + kick], [.68, .15, .68], '#edcb80', [Math.PI / 2, 0, 0], 1, p); r.cyl([0, .66, -.98 + kick], [.49, .04, .49], '#203541', [Math.PI / 2, 0, 0], 0, p); r.cyl([-.47, .32, 0], [.5, .17, .5], '#284957', [0, 0, Math.PI / 2], 0, p); r.cyl([.47, .32, 0], [.5, .17, .5], '#284957', [0, 0, Math.PI / 2], 0, p); r.cyl([-.57, .32, 0], [.2, .035, .2], '#f6d796', [0, 0, Math.PI / 2], 1, p); r.cyl([.57, .32, 0], [.2, .035, .2], '#f6d796', [0, 0, Math.PI / 2], 1, p); }
function gate(r, g, t) {
    let x = g.x + (g.move ? Math.sin(t * g.speed) * g.move : 0), w = g.w, c = g.mult >= 5 ? '#f6b648' : '#45beb8';
    r.box([x, 0.035, g.z], [w, .07, 1], c);
    for (let side of [-1, 1]) {
        r.box([x + side * w / 2, .78, g.z], [.20, 1.6, .26], '#f8f2df');
        r.box([x + side * w / 2, .12, g.z], [.43, .22, .55], c);
        r.sphere([x + side * w / 2, 1.6, g.z], [.3, .3, .3], '#f1ce83');
    }
    r.box([x, 1.47, g.z], [w + .18, .42, .22], c);
    r.label('gate' + g.id, '×' + g.mult, [x, 1.51, g.z], 'gate-number');
}
function castle(r, target, t = 0) {
    let { x, z, hp, max } = target;
    let p = transform([x, 0, z]);
    let frac = hp / max;
    const stone = '#e5a88c', cream = '#f8d9b0', dark = '#a45b64';
    if (hp <= 0) {
        for (let i = 0; i < 8; i++)
            r.box([x + Math.sin(i * 4.3) * .8, .10 + (i % 2) * .08, z + Math.cos(i * 2.2) * .55], [.5, .2, .4], i % 2 ? stone : cream, [0, i, 0]);
        return;
    }
    let h = 1.1 + frac * .65;
    r.box([0, h / 2, 0], [1.55, h, 1.05], stone, [0, 0, 0], 0, p);
    r.box([0, .55, .548], [.58, 1.1, .08], dark, [0, 0, 0], 0, p);
    r.box([0, .53, .602], [.40, .92, .055], '#72494d', [0, 0, 0], 0, p);
    for (let yy of [.28, .65])
        r.box([0, yy, .644], [.5, .075, .035], '#e2b375', [0, 0, 0], 1, p);
    for (let sx of [-.92, .92]) {
        r.cyl([sx, h * .55, 0], [.72, h * 1.1, .72], cream, [0, 0, 0], 0, p);
        r.cyl([sx, h * 1.1 + .08, 0], [.86, .24, .86], stone, [0, 0, 0], 0, p);
        for (let j = 0; j < 5; j++) {
            let a = j / 5 * Math.PI * 2;
            r.box([sx + Math.cos(a) * .32, h * 1.1 + .27, Math.sin(a) * .32], [.24, .28, .22], cream, [0, -a, 0], 0, p);
        }
        r.box([sx, h * .67, .362], [.16, .34, .04], dark, [0, 0, 0], 0, p);
    }
    for (let i = 0; i < 5; i++)
        r.box([-.68 + i * .34, h + .13, 0], [.22, .30, 1.02], cream, [0, 0, 0], 0, p);
    flag(r, 0, h + .1, -.20, '#de666f', p);
    r.label('castle' + target.id, String(Math.ceil(hp)), [x, h + .9, z], 'enemy-number');
}
function fruit(r, p, kind = 'apple', s = 1, parent = null) { r.sphere(p, [.38 * s, .35 * s, .36 * s], kind === 'lemon' ? '#fac33e' : '#ef625b', [0, 0, 0], 0, parent); r.box([p[0] + .04 * s, p[1] + .19 * s, p[2]], [.025 * s, .11 * s, .035 * s], '#866444', [0, 0, -.3], 0, parent); r.sphere([p[0] + .11 * s, p[1] + .20 * s, p[2]], [.15 * s, .04 * s, .07 * s], '#71a977', [0, 0, .3], 0, parent); }
function prop(r, obj) {
    const p = transform([obj.x, obj.y || 0, obj.z], [obj.scale || 1, obj.scale || 1, obj.scale || 1], [obj.rx || 0, obj.ry || 0, obj.rz || 0]);
    const c = obj.color || '#eabf7c';
    switch (obj.kind) {
        case 'fruit':
            fruit(r, [0, .18, 0], obj.variant || 'apple', 1, p);
            break;
        case 'crate':
            r.box([0, .22, 0], [.67, .43, .57], '#bd8b62', [0, 0, 0], 0, p);
            for (let i = 0; i < 4; i++)
                r.box([-.30 + i * .2, .22, .3], [.12, .41, .05], '#dcab76', [0, 0, 0], 0, p);
            for (let i = 0; i < 4; i++)
                fruit(r, [(i % 2 - .5) * .25, .52, (Math.floor(i / 2) - .5) * .23], i % 2 ? 'lemon' : 'apple', .7, p);
            break;
        case 'bench':
            for (let i = 0; i < 3; i++)
                r.box([0, .58, -.2 + i * .2], [1.35, .12, .16], '#ddaa72', [0, 0, 0], 0, p);
            r.box([0, 1.01, -.36], [1.35, .34, .10], '#ddaa72', [0, 0, 0], 0, p);
            for (let x of [-.5, .5]) {
                r.box([x, .29, 0], [.09, .59, .62], '#567785', [0, 0, 0], 1, p);
                r.box([x, .85, -.36], [.08, .64, .09], '#567785', [0, 0, 0], 1, p);
            }
            break;
        case 'cart':
            r.box([0, .57, 0], [1.35, .45, .75], c, [0, 0, 0], 0, p);
            for (let x of [-.5, .5])
                for (let z of [-.42, .42]) {
                    r.cyl([x, .22, z], [.40, .14, .40], '#395565', [Math.PI / 2, 0, 0], 0, p);
                    r.cyl([x, .22, z * 1.18], [.18, .025, .18], '#f2d496', [Math.PI / 2, 0, 0], 1, p);
                }
            r.box([.78, .94, 0], [.08, .45, .08], '#faf0d8', [0, 0, -.45], 0, p);
            for (let i = 0; i < 6; i++)
                fruit(r, [(i % 3 - 1) * .37, .89, (Math.floor(i / 3) - .5) * .28], i % 2 ? 'lemon' : 'apple', .85, p);
            break;
        case 'lamp':
            r.cyl([0, .1, 0], [.45, .2, .45], '#547584', [0, 0, 0], 0, p);
            r.cyl([0, .9, 0], [.10, 1.7, .10], '#547584', [0, 0, 0], 1, p);
            r.box([0, 1.83, 0], [.42, .5, .42], '#f5d998', [0, 0, 0], 0, p);
            r.draw('cone', [0, 2.20, 0], [.64, .34, .64], '#547584', [0, 0, 0], 0, p);
            break;
        case 'car':
            r.box([0, .48, 0], [1.02, .45, 1.85], c, [0, 0, 0], 0, p);
            r.box([0, .88, -.05], [.89, .57, .91], c, [0, 0, 0], 0, p);
            r.box([0, .91, .425], [.75, .36, .035], '#496d81', [.15, 0, 0], 0, p);
            r.box([0, .91, -.525], [.75, .36, .035], '#496d81', [-.1, 0, 0], 0, p);
            for (let x of [-.525, .525]) {
                r.box([x, .91, -.05], [.025, .32, .68], '#547c8c', [0, 0, 0], 0, p);
                for (let z of [-.6, .61]) {
                    r.cyl([x, .30, z], [.47, .14, .47], '#344c59', [0, 0, Math.PI / 2], 0, p);
                    r.cyl([x * 1.14, .30, z], [.21, .02, .21], '#dfdcd0', [0, 0, Math.PI / 2], 1, p);
                }
            }
            for (let x of [-.32, .32])
                r.box([x, .53, .944], [.22, .14, .03], '#fff0bc', [0, 0, 0], 2, p);
            break;
        case 'kiosk':
        case 'house':
        case 'tower': {
            let big = obj.kind === 'tower' ? 1.55 : obj.kind === 'house' ? 1.2 : 1;
            let h = obj.kind === 'tower' ? 2.8 : 1.8;
            const pp = transform([obj.x, obj.y || 0, obj.z], [big * (obj.scale || 1), obj.scale || 1, big * (obj.scale || 1)], [obj.rx || 0, obj.ry || 0, obj.rz || 0]);
            r.box([0, h / 2, 0], [1.75, h, 1.55], c, [0, 0, 0], 0, pp);
            r.box([0, .12, 0], [1.93, .24, 1.72], '#ede1c4', [0, 0, 0], 0, pp);
            r.box([0, h + .08, 0], [2.02, .20, 1.86], '#577e86', [0, 0, 0], 0, pp);
            for (let yy = .9; yy < h; yy += .9)
                for (let x of [-.46, .46]) {
                    r.box([x, yy, .785], [.49, .58, .06], '#f9e9c8', [0, 0, 0], 0, pp);
                    r.box([x, yy, .824], [.37, .46, .028], '#4b798f', [0, 0, 0], 0, pp);
                    r.box([x, yy, .846], [.035, .45, .025], '#ddcda8', [0, 0, 0], 0, pp);
                }
            if (obj.kind === 'kiosk') {
                for (let i = 0; i < 6; i++)
                    r.box([-.9 + i * .36, 1.63, 1.02], [.36, .11, .70], i % 2 ? '#f5e0b0' : '#de8877', [-.22, 0, 0], 0, pp);
                r.box([0, .62, .93], [1.85, .12, .42], '#8aab9a', [0, 0, 0], 0, pp);
                r.box([0, h + .44, 0], [1.05, .55, .20], '#eee0b7', [0, 0, 0], 0, pp);
            }
            else {
                r.box([0, .42, .80], [.44, .77, .06], '#bc8371', [0, 0, 0], 0, pp);
                r.draw('cone', [0, h + .40, 0], [2.36, .7, 2.1], '#cc8073', [0, Math.PI / 4, 0], 0, pp);
            }
            break;
        }
        case 'tree':
            tree(r, 0, 0, 1, c, p);
            break;
        case 'safe':
            r.cyl([0, .2, 0], [.7, .4, .7], '#f6d8ac', [0, 0, 0], 0, p);
            r.sphere([0, .8, 0], [.7, .95, .6], '#75a397', [0, 0, 0], 0, p);
            r.sphere([0, 1.4, 0], [.5, .5, .5], '#f5d69d', [0, 0, 0], 0, p);
            r.box([0, 1.55, .25], [.50, .09, .06], '#547781', [0, 0, 0], 0, p);
            r.box([0, .79, .325], [.44, .5, .04], '#f7f0d9', [0, 0, 0], 0, p);
            r.box([0, .79, .35], [.3, .08, .015], '#d97873', [0, 0, 0], 0, p);
            break;
    }
}


export {board,tree,flag,cannon,gate,castle,fruit,prop};
