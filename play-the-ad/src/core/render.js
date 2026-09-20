import { clamp, hex, transform, mul, lookAt, ortho, invert, point, norm, sub } from './math.js';
// Small original WebGL2 renderer: real geometry, instanced batches, studio light,
// PCF contact shadows and a cut-out floor for the hole game. No network assets.
const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aTint;
layout(location=3) in mat4 iModel;
layout(location=7) in vec4 iColor;
uniform mat4 uVP; uniform mat4 uLight; uniform float uTime; uniform int uFigure;
out vec3 vWorld; out vec3 vNormal; out vec3 vColor; out vec4 vShadow; flat out float vMaterial;
void main(){
 vec3 p=aPos;
 if(uFigure==1 && p.y<0.23){float phase=sin(uTime*16.+iModel[3].x*5.+iModel[3].z*4.);p.z+=phase*.10*sign(p.x)*(1.-p.y/.23);}
 vec4 w=iModel*vec4(p,1.);vWorld=w.xyz;
 vec3 s2=vec3(dot(iModel[0].xyz,iModel[0].xyz),dot(iModel[1].xyz,iModel[1].xyz),dot(iModel[2].xyz,iModel[2].xyz));
 vNormal=normalize(mat3(iModel)*(aNormal/max(s2,vec3(.00001))));
 vColor=iColor.rgb*aTint;vMaterial=iColor.a;vShadow=uLight*w;gl_Position=uVP*w;
}`;
const FRAG = `#version 300 es
precision highp float;
in vec3 vWorld; in vec3 vNormal; in vec3 vColor; in vec4 vShadow; flat in float vMaterial;
uniform sampler2D uShadow; uniform vec3 uEye; uniform vec3 uSun; uniform vec3 uHole; uniform int uShadowOn;
out vec4 outColor;
void main(){
 if(vMaterial>2.5 && vMaterial<3.5 && uHole.z>0. && distance(vWorld.xz,uHole.xy)<uHole.z)discard;
 vec3 n=normalize(vNormal);vec3 l=normalize(uSun);float diffuse=max(0.,dot(n,l));
 vec3 sc=vShadow.xyz/vShadow.w*.5+.5;float shade=1.;
 if(uShadowOn==1 && sc.x>0. && sc.x<1. && sc.y>0. && sc.y<1. && sc.z<1.){
 float bias=max(.00035,.0012*(1.-diffuse)); float hit=0.;
 vec2 tx=1./vec2(textureSize(uShadow,0));
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)hit+=sc.z-bias>texture(uShadow,sc.xy+vec2(float(x),float(y))*tx).r?1.:0.;
 shade=1.-hit/9.*.58;
 }
 vec3 ambient=mix(vec3(.48,.49,.61),vec3(.68,.74,.80),n.y*.5+.5);
 vec3 linear=pow(vColor,vec3(2.2));
 vec3 view=normalize(uEye-vWorld);vec3 halfV=normalize(l+view);
 float metal=step(.5,vMaterial)*(1.-step(1.5,vMaterial));
 float spec=pow(max(dot(n,halfV),0.),mix(32.,75.,metal))*mix(.15,.55,metal)*shade;
 vec3 c=linear*(ambient*.55+vec3(1.07,.99,.88)*diffuse*shade*.83)+spec;
 if(vMaterial>1.5 && vMaterial<2.5)c=linear*1.4;
 if(vMaterial>3.5 && vMaterial<4.5)c=linear*.28;
 c*=1.10;c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);c=pow(c,vec3(1./2.2));outColor=vec4(c,1.);
}`;
const DEPTHFRAG = `#version 300 es
precision highp float;
in vec3 vWorld; flat in float vMaterial;uniform vec3 uHole;
void main(){if(vMaterial>2.5 && vMaterial<3.5 && uHole.z>0. && distance(vWorld.xz,uHole.xy)<uHole.z)discard;}`;
function program(gl, vs, fs) {
    const build = (t, s) => {
        let sh = gl.createShader(t);
        gl.shaderSource(sh, s);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
            throw Error(gl.getShaderInfoLog(sh));
        return sh;
    };
    let v = build(gl.VERTEX_SHADER, vs), f = build(gl.FRAGMENT_SHADER, fs), p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(p));
    return p;
}
function vertex(dst, p, n, t = [1, 1, 1]) { dst.push(...p, ...n, ...t); }
function tri(dst, a, b, c, na, nb = na, nc = na, t = [1, 1, 1]) { vertex(dst, a, na, t); vertex(dst, b, nb, t); vertex(dst, c, nc, t); }
function quad(dst, a, b, c, d, n, t) { tri(dst, a, b, c, n, n, n, t); tri(dst, a, c, d, n, n, n, t); }
function boxGeometry(bevel = .07) {
    let d = [], steps = [-.5, -.5 + bevel, .5 - bevel, .5];
    for (let ax = 0; ax < 3; ax++)
        for (let sign of [-1, 1]) {
            let u = (ax + 1) % 3, v = (ax + 2) % 3;
            const vv = (s, t) => { let p = [0, 0, 0]; p[ax] = sign * .5; p[u] = s; p[v] = t; let c = p.map(x => clamp(x, -.5 + bevel, .5 - bevel)), n = norm(sub(p, c)); return [p.map((_, i) => c[i] + n[i] * bevel), n]; };
            for (let i = 0; i < steps.length - 1; i++)
                for (let j = 0; j < steps.length - 1; j++) {
                    let a = vv(steps[i], steps[j]), b = vv(steps[i + 1], steps[j]), c = vv(steps[i + 1], steps[j + 1]), e = vv(steps[i], steps[j + 1]);
                    if (sign > 0) {
                        tri(d, a[0], b[0], c[0], a[1], b[1], c[1]);
                        tri(d, a[0], c[0], e[0], a[1], c[1], e[1]);
                    }
                    else {
                        tri(d, a[0], c[0], b[0], a[1], c[1], b[1]);
                        tri(d, a[0], e[0], c[0], a[1], e[1], c[1]);
                    }
                }
        }
    return d;
}
// Small distant runners use a low-poly mesh, never fewer simulated people.
function cuboidGeometry() {
    let d = [];
    for (let ax = 0; ax < 3; ax++)
        for (let sign of [-1, 1]) {
            let u = (ax + 1) % 3, v = (ax + 2) % 3, n = [0, 0, 0];
            n[ax] = sign;
            let pts = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(([a, b]) => { let p = [0, 0, 0]; p[ax] = sign * .5; p[u] = a; p[v] = b; return p; });
            if (sign < 0)
                pts.reverse();
            quad(d, ...pts, n);
        }
    return d;
}
function sphereGeometry(nx = 16, ny = 10) {
    let d = [];
    const v = (x, y) => { let a = x / nx * Math.PI * 2, b = y / ny * Math.PI, n = [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)]; return [n.map(x => x * .5), n]; };
    for (let x = 0; x < nx; x++)
        for (let y = 0; y < ny; y++) {
            let a = v(x, y), b = v(x + 1, y), c = v(x + 1, y + 1), e = v(x, y + 1);
            tri(d, a[0], c[0], b[0], a[1], c[1], b[1]);
            tri(d, a[0], e[0], c[0], a[1], e[1], c[1]);
        }
    return d;
}
function cylinderGeometry(n = 24, top = .5, bevel = .035) {
    let d = [], rings = [[-.5, .5 - bevel], [-.5 + bevel, .5], [.5 - bevel, top], [.5, Math.max(.001, top - bevel)]];
    for (let j = 0; j < rings.length - 1; j++)
        for (let i = 0; i < n; i++) {
            let a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
            let [y, r] = rings[j], [yy, rr] = rings[j + 1];
            let p = [r * Math.cos(a), y, r * Math.sin(a)], q = [r * Math.cos(b), y, r * Math.sin(b)], s = [rr * Math.cos(b), yy, rr * Math.sin(b)], t = [rr * Math.cos(a), yy, rr * Math.sin(a)];
            let na = norm([Math.cos(a), (r - rr) / (yy - y), Math.sin(a)]), nb = norm([Math.cos(b), (r - rr) / (yy - y), Math.sin(b)]);
            tri(d, p, t, s, na, na, nb);
            tri(d, p, s, q, na, nb, nb);
        }
    for (let sign of [-1, 1])
        for (let i = 0; i < n; i++) {
            let a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, r = sign < 0 ? rings[0][1] : rings.at(-1)[1], p = [Math.cos(a) * r, sign * .5, Math.sin(a) * r], q = [Math.cos(b) * r, sign * .5, Math.sin(b) * r];
            if (sign > 0)
                tri(d, [0, .5, 0], q, p, [0, 1, 0]);
            else
                tri(d, [0, -.5, 0], p, q, [0, -1, 0]);
        }
    return d;
}
function ringGeometry(n = 48, m = 8, r = .5, t = .06) {
    let d = [];
    const v = (i, j) => { let a = i / n * Math.PI * 2, b = j / m * Math.PI * 2, no = [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)]; return [[(r + t * Math.cos(b)) * Math.cos(a), t * Math.sin(b), (r + t * Math.cos(b)) * Math.sin(a)], no]; };
    for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++) {
            let a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), e = v(i, j + 1);
            tri(d, a[0], c[0], b[0], a[1], c[1], b[1]);
            tri(d, a[0], e[0], c[0], a[1], e[1], c[1]);
        }
    return d;
}
function wellGeometry() {
    let d = [];
    for (let i = 0; i < 48; i++) {
        let a = i / 48 * Math.PI * 2, b = (i + 1) / 48 * Math.PI * 2, p = [Math.cos(a) * .5, 0, Math.sin(a) * .5], q = [Math.cos(b) * .5, 0, Math.sin(b) * .5], u = [Math.cos(a) * .42, -1, Math.sin(a) * .42], v = [Math.cos(b) * .42, -1, Math.sin(b) * .42], na = norm([-Math.cos(a), .08, -Math.sin(a)]), nb = norm([-Math.cos(b), .08, -Math.sin(b)]);
        tri(d, p, v, u, na, nb, na);
        tri(d, p, q, v, na, nb, nb);
    }
    return d;
}
function combine(parts) {
    let out = [];
    for (let [geo, pos, scale, rot, tint] of parts) {
        let m = transform(pos, scale, rot), ns = [Math.hypot(...m.slice(0, 3)) ** 2, Math.hypot(...m.slice(4, 7)) ** 2, Math.hypot(...m.slice(8, 11)) ** 2];
        for (let i = 0; i < geo.length; i += 9) {
            let p = point(m, geo.slice(i, i + 3)), n = geo.slice(i + 3, i + 6).map((v, j) => v / ns[j]);
            n = norm([0, 1, 2].map(r => m[r] * n[0] + m[4 + r] * n[1] + m[8 + r] * n[2]));
            vertex(out, p, n, tint || geo.slice(i + 6, i + 9));
        }
    }
    return out;
}
class Renderer {
    constructor(canvas, labelLayer) {
        this.canvas = canvas;
        this.labels = labelLayer;
        this.labelNodes = new Map();
        this.labelUsed = new Set();
        this.meshes = new Map();
        this.batches = new Map();
        this.time = 0;
        this.hole = [0, 0, 0];
        this.frame = 0;
        this.quality = 'high';
        this.bg = [.80, .86, .88];
        const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
        if (!gl)
            throw Error('Для этих игр нужен WebGL 2. Обнови браузер или включи аппаратное ускорение.');
        this.gl = gl;
        this.main = program(gl, VERT, FRAG);
        this.depth = program(gl, VERT, DEPTHFRAG);
        this.uniforms = new Map();
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        this.shadowSize = 1024;
        this.shadow = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadow);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.shadowFB = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadow, 0);
        gl.drawBuffers([gl.NONE]);
        gl.readBuffer(gl.NONE);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
            throw Error('Shadow framebuffer unavailable');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.lightVP = mul(ortho(-18, 18, -18, 18, .1, 80), lookAt([-12, 26, 18], [0, 0, 0]));
        this.sun = [-12, 26, 18];
        this.addMesh('well', wellGeometry());
        this.addMesh('box', boxGeometry());
        this.addMesh('sphere', sphereGeometry());
        this.addMesh('cylinder', cylinderGeometry());
        this.addMesh('cone', cylinderGeometry(24, .005));
        this.addMesh('ring', ringGeometry());
        this.addMesh('figure', combine([
            [sphereGeometry(8, 5), [0, .53, 0], [.255, .26, .235]],
            [boxGeometry(.10), [0, .31, 0], [.235, .26, .16]],
            [cuboidGeometry(), [-.075, .12, 0], [.098, .24, .115]], [cuboidGeometry(), [.075, .12, 0], [.098, .24, .115]],
            [cuboidGeometry(), [-.166, .30, 0], [.085, .24, .10], [0, 0, -.15]], [cuboidGeometry(), [.166, .30, 0], [.085, .24, .10], [0, 0, .15]],
            [cuboidGeometry(), [-.045, .55, -.117], [.031, .041, .022], [0, 0, 0], [.10, .13, .18]], [cuboidGeometry(), [.045, .55, -.117], [.031, .041, .022], [0, 0, 0], [.10, .13, .18]]
        ]));
        this.setCamera({ eye: [0, 18, 20], at: [0, 0, -1], width: 11.5, height: 14 });
    }
    addMesh(name, vertices) {
        if (this.meshes.has(name))
            return;
        const g = this.gl, vao = g.createVertexArray(), vbo = g.createBuffer(), ibo = g.createBuffer();
        g.bindVertexArray(vao);
        g.bindBuffer(g.ARRAY_BUFFER, vbo);
        g.bufferData(g.ARRAY_BUFFER, new Float32Array(vertices), g.STATIC_DRAW);
        for (let i = 0; i < 3; i++) {
            g.enableVertexAttribArray(i);
            g.vertexAttribPointer(i, 3, g.FLOAT, false, 36, i * 12);
        }
        g.bindBuffer(g.ARRAY_BUFFER, ibo);
        g.bufferData(g.ARRAY_BUFFER, 80, g.DYNAMIC_DRAW);
        for (let i = 0; i < 4; i++) {
            g.enableVertexAttribArray(3 + i);
            g.vertexAttribPointer(3 + i, 4, g.FLOAT, false, 80, i * 16);
            g.vertexAttribDivisor(3 + i, 1);
        }
        g.enableVertexAttribArray(7);
        g.vertexAttribPointer(7, 4, g.FLOAT, false, 80, 64);
        g.vertexAttribDivisor(7, 1);
        this.meshes.set(name, { vao, vbo, ibo, count: vertices.length / 9, capacity: 1 });
        this.batches.set(name, { values: [], count: 0 });
        g.bindVertexArray(null);
    }
    removeMesh(name) {
        let m = this.meshes.get(name);
        if (!m)
            return;
        const g = this.gl;
        g.deleteBuffer(m.vbo);
        g.deleteBuffer(m.ibo);
        g.deleteVertexArray(m.vao);
        this.meshes.delete(name);
        this.batches.delete(name);
    }
    setCamera({ eye, at, width, height }) { this.eye = eye; this.at = at; this.minWidth = width; this.minHeight = height; this.view = lookAt(eye, at); this.resize(); }
    resize() {
        const r = this.canvas.getBoundingClientRect();
        this.width = Math.max(1, r.width);
        this.height = Math.max(1, r.height);
        let dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.65);
        let w = Math.round(this.width * dpr), h = Math.round(this.height * dpr);
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        let aspect = this.width / this.height, vh = Math.max(this.minHeight, this.minWidth / aspect), vw = vh * aspect;
        this.vp = mul(ortho(-vw / 2, vw / 2, -vh / 2, vh / 2, .1, 100), this.view);
        this.inv = invert(this.vp);
    }
    begin(t) {
        this.time = t;
        this.frame++;
        for (let b of this.batches.values()) {
            b.values.length = 0;
            b.count = 0;
        }
        this.labelUsed.clear();
    }
    draw(mesh, p = [0, 0, 0], s = [1, 1, 1], color = '#ffffff', r = [0, 0, 0], material = 0, parent = null) {
        let m = transform(p, s, r);
        if (parent)
            m = mul(parent, m);
        const c = hex(color), b = this.batches.get(mesh);
        if (!b)
            throw Error('Unknown mesh ' + mesh);
        for (let i = 0; i < 16; i++)
            b.values.push(m[i]);
        b.values.push(c[0], c[1], c[2], material);
        b.count++;
    }
    box(p, s, c, r = [0, 0, 0], mat = 0, parent = null) { this.draw('box', p, s, c, r, mat, parent); }
    sphere(p, s, c, r = [0, 0, 0], mat = 0, parent = null) { this.draw('sphere', p, s, c, r, mat, parent); }
    cyl(p, s, c, r = [0, 0, 0], mat = 0, parent = null) { this.draw('cylinder', p, s, c, r, mat, parent); }
    ring(p, s, c, r = [0, 0, 0], mat = 0, parent = null) { this.draw('ring', p, s, c, r, mat, parent); }
    project(p) { let n = point(this.vp, p); return { x: (n[0] + 1) * this.width / 2, y: (1 - n[1]) * this.height / 2, depth: n[2] }; }
    unproject(x, y, plane = 'ground', value = 0) { let a = point(this.inv, [x / this.width * 2 - 1, 1 - y / this.height * 2, -1]), b = point(this.inv, [x / this.width * 2 - 1, 1 - y / this.height * 2, 1]), axis = plane === 'ground' ? 1 : 2, t = (value - a[axis]) / (b[axis] - a[axis]); let p = a.map((v, i) => v + (b[i] - v) * t); return { x: p[0], y: p[1], z: p[2] }; }
    label(id, text, p, cls = '', size = 1) {
        this.labelUsed.add(id);
        let el = this.labelNodes.get(id);
        if (!el) {
            el = document.createElement('div');
            el.className = 'world-label';
            this.labels.append(el);
            this.labelNodes.set(id, el);
        }
        const q = this.project(p);
        el.textContent = text;
        el.className = 'world-label ' + cls;
        el.style.transform = `translate(${q.x}px,${q.y}px) translate(-50%,-50%) scale(${size})`;
        el.style.display = q.depth > 1 ? 'none' : '';
    }
    u(prog, name) {
        let key = (prog === this.main ? 'm' : 'd') + name;
        if (!this.uniforms.has(key))
            this.uniforms.set(key, this.gl.getUniformLocation(prog, name));
        return this.uniforms.get(key);
    }
    flush() {
        const g = this.gl;
        for (let [name, b] of this.batches) {
            if (!b.count)
                continue;
            let mesh = this.meshes.get(name);
            g.bindBuffer(g.ARRAY_BUFFER, mesh.ibo);
            if (b.count > mesh.capacity) {
                mesh.capacity = 2 ** Math.ceil(Math.log2(b.count));
                g.bufferData(g.ARRAY_BUFFER, mesh.capacity * 80, g.DYNAMIC_DRAW);
            }
            g.bufferSubData(g.ARRAY_BUFFER, 0, new Float32Array(b.values));
        }
        const pass = (prog, vp) => {
            g.useProgram(prog);
            g.uniformMatrix4fv(this.u(prog, 'uVP'), false, vp);
            g.uniformMatrix4fv(this.u(prog, 'uLight'), false, this.lightVP);
            g.uniform1f(this.u(prog, 'uTime'), this.time);
            g.uniform3fv(this.u(prog, 'uHole'), this.hole);
            if (prog === this.main) {
                g.uniform3fv(this.u(prog, 'uEye'), this.eye);
                g.uniform3fv(this.u(prog, 'uSun'), this.sun);
                g.uniform1i(this.u(prog, 'uShadowOn'), this.quality === 'low' ? 0 : 1);
                g.activeTexture(g.TEXTURE0);
                g.bindTexture(g.TEXTURE_2D, this.shadow);
                g.uniform1i(this.u(prog, 'uShadow'), 0);
            }
            for (let [name, b] of this.batches) {
                if (!b.count)
                    continue;
                let m = this.meshes.get(name);
                g.uniform1i(this.u(prog, 'uFigure'), name === 'figure' ? 1 : 0);
                g.bindVertexArray(m.vao);
                g.drawArraysInstanced(g.TRIANGLES, 0, m.count, b.count);
            }
        };
        if (this.quality !== 'low') {
            g.bindFramebuffer(g.FRAMEBUFFER, this.shadowFB);
            g.viewport(0, 0, this.shadowSize, this.shadowSize);
            g.clear(g.DEPTH_BUFFER_BIT);
            g.enable(g.POLYGON_OFFSET_FILL);
            g.polygonOffset(1, 1);
            pass(this.depth, this.lightVP);
            g.disable(g.POLYGON_OFFSET_FILL);
        }
        g.bindFramebuffer(g.FRAMEBUFFER, null);
        g.viewport(0, 0, this.canvas.width, this.canvas.height);
        g.clearColor(...this.bg, 1);
        g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
        pass(this.main, this.vp);
        g.bindVertexArray(null);
        for (let [id, el] of this.labelNodes)
            if (!this.labelUsed.has(id)) {
                el.remove();
                this.labelNodes.delete(id);
            }
        this.drawCalls = [...this.batches.values()].filter(x => x.count).length * (this.quality === 'low' ? 1 : 2);
        this.instanceCount = [...this.batches.values()].reduce((s, b) => s + b.count, 0);
    }
    clearLabels() {
        for (let el of this.labelNodes.values())
            el.remove();
        this.labelNodes.clear();
    }
    dispose() {
        const g = this.gl;
        for (let m of this.meshes.values()) {
            g.deleteBuffer(m.vbo);
            g.deleteBuffer(m.ibo);
            g.deleteVertexArray(m.vao);
        }
        g.deleteProgram(this.main);
        g.deleteProgram(this.depth);
        g.deleteTexture(this.shadow);
        g.deleteFramebuffer(this.shadowFB);
        this.clearLabels();
    }
}


export {boxGeometry,sphereGeometry,cylinderGeometry,ringGeometry,wellGeometry,Renderer};
