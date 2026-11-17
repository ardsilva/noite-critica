// NOITE CRITICA - build web (vertical slice do Capitulo 1)
// Motor point-and-click 2.5D: cena 3D com camera fixa, verbos, habilidades de classe e
// um interprete de regras que le content/chapter1.json (o mesmo ficheiro que o Unity consome).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import chapter1 from '../content/chapter1.json';
import chapter2 from '../content/chapter2.json';
import { initAudio, sfx, startMusic, setMusic, toggleMute, NOTES } from './audio.js';
import { portraitCanvas, drawKid, drawAncestor } from './portraits.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const params = new URLSearchParams(location.search);
const content = params.get('ch') === '2' ? chapter2 : chapter1; // ?ch=2 = Capitulo 2 (prototipo)
const LOWFX = params.get('fx') === '0';
const TEST = params.get('test') === '1'; // caminhada instantanea para o teste automatizado
const KIDS = Object.fromEntries(content.party.map((k) => [k.id, k]));
const VERBS = [['look', 'Olhar'], ['take', 'Pegar'], ['use', 'Usar'], ['talk', 'Falar']];

// ------------------------------------------------------------------ estado
const S = {
  room: null, active: content.start.active, flags: new Set(), inv: [], hp: {}, looked: new Set(),
  team: content.party.map((k) => k.id), loc: {}, // equipe do capitulo e sala onde cada crianca esta
  verb: null, item: null, hover: null, busy: true, cut: false, skipping: false, objective: '', ended: false,
};
content.party.forEach((k) => (S.hp[k.id] = k.hp));

// ------------------------------------------------------------------ three
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !LOWFX;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 300);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.7, 0.82);
if (!LOWFX) composer.addPass(bloom);
composer.addPass(new OutputPass());

const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, free: false };
const rooms = {}, actors = {}, tweens = [], waiters = [];
const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
const timer = new THREE.Timer();

function resize() {
  const w = $('stage').clientWidth, h = $('stage').clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  // em ecras estreitos abre o campo de visao para a cena inteira caber
  camera.fov = (rooms[S.room]?.cfg.camera.fov || 44) * (camera.aspect < 1.5 ? Math.min(1.7, 1.5 / camera.aspect) : 1);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ utilitarios async
function tween(dur, fn, ease = (t) => t * t * (3 - 2 * t)) {
  return new Promise((res) => {
    if (S.skipping || dur <= 0) { fn(1); return res(); }
    tweens.push({ t: 0, dur, fn, ease, res });
  });
}
function wait(sec) {
  return new Promise((res) => {
    if (S.skipping) return res();
    const w = { res, timer: setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); res(); }, sec * 1000) };
    waiters.push(w);
  });
}
let advance = null;
function waitAdvance(ms) {
  return new Promise((res) => {
    if (S.skipping) return res();
    const done = () => { clearTimeout(timer); advance = null; res(); };
    const timer = setTimeout(done, ms);
    advance = done;
  });
}
function skipCutscene() {
  if (!S.cut || S.skipping) return;
  S.skipping = true;
  waiters.splice(0).forEach((w) => { clearTimeout(w.timer); w.res(); });
  tweens.splice(0).forEach((t) => { t.fn(1); t.res(); });
  advance?.();
}

// ------------------------------------------------------------------ atores
class Actor {
  constructor(id, model) {
    this.id = id;
    this.root = new THREE.Group();
    model.scale.setScalar(1.3);
    this.root.add(model);
    this.p = {};
    model.traverse((o) => {
      if (['body', 'head', 'armL', 'armR', 'legL', 'legR'].includes(o.name)) this.p[o.name] = o;
      if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); }
    });
    this.baseY = this.p.body.position.y;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 28), new THREE.MeshBasicMaterial({ color: KIDS[id].color, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    this.ring = ring; this.root.add(ring);
    this.walk = null; this.t = Math.random() * 9; this.gesture = null; this.talking = 0; this.faceTo = null;
  }
  place(x, z, deg) { this.root.position.set(x, 0, z); if (deg != null) this.root.rotation.y = THREE.MathUtils.degToRad(deg); this.walk = null; }
  face(x, z) { this.faceTo = Math.atan2(x - this.root.position.x, z - this.root.position.z); }
  walkTo(x, z) {
    return new Promise((res) => {
      this.walk?.res();
      if (S.skipping || TEST) { this.place(x, z); return res(); }
      this.walk = { x, z, res };
    });
  }
  play(name, dur = 0.9) { this.gesture = { name, t: 0, dur }; }
  update(dt) {
    this.t += dt;
    const { body, head, armL, armR, legL, legR } = this.p, pos = this.root.position;
    let moving = false;
    if (this.walk) {
      const dx = this.walk.x - pos.x, dz = this.walk.z - pos.z, d = Math.hypot(dx, dz), step = 3.1 * dt;
      if (d <= step) { pos.x = this.walk.x; pos.z = this.walk.z; const r = this.walk.res; this.walk = null; r(); }
      else { pos.x += (dx / d) * step; pos.z += (dz / d) * step; this.faceTo = Math.atan2(dx, dz); moving = true; }
    }
    if (this.faceTo != null) {
      let d = this.faceTo - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * Math.min(1, dt * 12);
      if (Math.abs(d) < 0.01) this.faceTo = null;
    }
    const sw = moving ? Math.sin(this.t * 11) * 0.75 : 0, k = Math.min(1, dt * 14);
    const L = (o, ax, v) => (o.rotation[ax] += (v - o.rotation[ax]) * k);
    let aL = -sw, aR = sw, aLz = 0, aRz = 0, lean = 0, hop = 0, headX = Math.sin(this.t * 1.3) * 0.04, headY = Math.sin(this.t * 0.7) * 0.12;
    if (this.talking > 0) { this.talking -= dt; headX = Math.sin(this.t * 13) * 0.1; aR += Math.sin(this.t * 6) * 0.25 - 0.3; }
    const g = this.gesture;
    if (g) {
      g.t += dt;
      const u = Math.min(1, g.t / g.dur), bell = Math.sin(u * Math.PI);
      if (g.name === 'cast') { aR = -2.6 * bell; aRz = 0.2 * bell; headX = -0.2 * bell; }
      if (g.name === 'use') { aR = -1.4 * bell + Math.sin(g.t * 30) * 0.08; aL = -1.2 * bell; lean = 0.15 * bell; }
      if (g.name === 'push') { aL = aR = -1.5 * bell; lean = 0.35 * bell; }
      if (g.name === 'play') { aL = -0.9 + Math.sin(g.t * 18) * 0.25; aR = -0.7 + Math.cos(g.t * 18) * 0.25; hop = Math.abs(Math.sin(g.t * 9)) * 0.05; }
      if (g.name === 'hurt') { hop = bell * 0.35; aL = aR = -2.4 * bell; aLz = -0.6 * bell; aRz = 0.6 * bell; }
      if (g.name === 'cheer') { hop = Math.abs(Math.sin(g.t * 10)) * 0.25; aL = aR = -2.9; }
      if (u >= 1) this.gesture = null;
    }
    L(legL, 'x', sw); L(legR, 'x', -sw);
    L(armL, 'x', aL); L(armR, 'x', aR); L(armL, 'z', aLz); L(armR, 'z', aRz);
    L(body, 'x', lean); L(head, 'x', headX); L(head, 'y', moving ? 0 : headY);
    body.position.y = this.baseY + (moving ? Math.abs(Math.sin(this.t * 11)) * 0.03 : Math.sin(this.t * 2.2) * 0.006) + hop / 1.3;
    this.ring.visible = S.active === this.id && !S.cut;
    this.ring.material.opacity = 0.55 + Math.sin(this.t * 4) * 0.25;
  }
}

// ------------------------------------------------------------------ salas
const visibleDeep = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };

// sala sem arte (prototipo): monta caixas coloridas a partir de cfg.blockout, com os mesmos nomes hs_/st_ do Blender
function blockoutScene(cfg) {
  const g = new THREE.Group(), w = cfg.walk, box = (name, [x, y, z], [sx, sy, sz], color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    m.name = name; m.position.set(x, y, z); g.add(m); return m;
  };
  box('floor', [(w.minX + w.maxX) / 2, -0.05, (w.minZ + w.maxZ) / 2], [w.maxX - w.minX + 4, 0.1, w.maxZ - w.minZ + 4], cfg.floor || '#2a2330');
  box('wall_back', [(w.minX + w.maxX) / 2, 2.6, w.minZ - 1.3], [w.maxX - w.minX + 4, 5.2, 0.3], cfg.wall || '#1b1626');
  cfg.blockout.forEach(([name, pos, size, color]) => {
    const m = box(name, pos, size, color);
    if (name.startsWith('glow_')) m.material.emissive.set(color);
  });
  return { scene: g };
}
function setupRoom(id, gltf) {
  const cfg = content.rooms[id];
  if (!gltf) gltf = blockoutScene(cfg);
  const group = gltf.scene, nodes = {}, hs = {}, glows = [], wins = [];
  group.traverse((o) => {
    if (!nodes[o.name]) nodes[o.name] = o;
    if (o.name.startsWith('hs_')) hs[o.name.slice(3)] = o;
    if (o.isMesh) {
      o.castShadow = !/^(ground|moon|hill|win_|glow_|dung_floor|house_floor|flag)/.test(o.name);
      o.receiveShadow = true;
      if (o.name.startsWith('win_')) { o.material = new THREE.MeshStandardMaterial({ color: 0x0b0d14, emissive: 0xffbe5e, emissiveIntensity: 0, roughness: 0.3 }); wins.push(o); }
      if (o.name.startsWith('glow_')) { o.material = o.material.clone(); o.userData.base = o.material.emissiveIntensity; glows.push(o); }
    }
  });
  for (const [hid, node] of Object.entries(hs)) {
    node.userData.hs = hid;
    node.traverse((o) => { if (o.isMesh && !o.name.startsWith('glow_') && !o.name.startsWith('win_')) { o.material = o.material.clone(); o.userData.em = o.material.emissive.clone(); o.userData.emI = o.material.emissiveIntensity; } });
  }
  const room = { id, cfg, group, nodes, hs, glows, wins, lights: {} };
  const L = room.lights, add = (n, l) => { L[n] = l; group.add(l); return l; };
  const pt = (n, col, x, y, z, dist = 12) => { const l = add(n, new THREE.PointLight(col, 0, dist, 1.6)); l.position.set(x, y, z); return l; };
  if (id === 'exterior') {
    room.bg = 0x0a1024; room.fog = [0x0c1428, 0.016];
    add('hemi', new THREE.HemisphereLight(0x6f86d6, 0x141a22, 1.25));
    const moon = add('moon', new THREE.DirectionalLight(0xa9c0ff, 2.1));
    moon.position.set(-9, 16, 12); moon.castShadow = true;
    Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -8, near: 1, far: 50 });
    moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0015;
    const rim = add('rim', new THREE.DirectionalLight(0xfff0c0, 0.7)); rim.position.set(9, 12, -22);
    pt('lamp', 0xffb45e, 2.7, 0.9, -1.8, 9).intensity = 16;
    pt('lanL', 0xff9a3c, -3.3, 1.6, -6.2, 10); pt('lanR', 0xff9a3c, 3.3, 1.6, -6.2, 10);
    pt('doorway', 0x9d5bff, 0, 2, -9.2, 9);
    const stars = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI, e = 0.08 + Math.random() * 1.2; sp.push(Math.cos(a) * 120 * Math.cos(e), 120 * Math.sin(e), -60 - Math.sin(a) * 60 * Math.cos(e)); }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    group.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.5, fog: false })));
    nodes.moon.material.fog = false;
  } else if (cfg.blockout) {
    room.bg = 0x05040a; room.fog = [0x05040a, 0.02];
    add('hemi', new THREE.HemisphereLight(0x9a8fc8, 0x1a1424, 0.9));
    const key = add('key', new THREE.DirectionalLight(0xffe6c8, 1.1)); key.position.set(3, 10, 10);
    pt('lampA', 0xb98cff, -3, 3.2, -3, 14).intensity = 14; pt('lampB', 0xffc878, 3, 3.2, -3, 14).intensity = 12;
    room.dungeon = false;
  } else {
    room.bg = 0x05040a; room.fog = [0x05040a, 0.012];
    add('hemi', new THREE.HemisphereLight(0x8a7fb8, 0x15101c, 0.35));
    const key = add('key', new THREE.DirectionalLight(0xffe6c8, 0.5));
    key.position.set(3, 14, 12); key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -13, right: 13, top: 12, bottom: -6, near: 1, far: 45 });
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0015;
    pt('chand', 0xffc878, 0, 4.6, -4, 26);
    [[-4.9, -8.4], [4.9, -8.4], [-1.75, -8.4], [1.75, -8.4], [-9.8, -3.6], [9.8, -3.6]].forEach(([x, z], i) => pt('torch' + i, 0xb98cff, x, 3.5, z, 11));
    pt('mosaic', 0x7a3cff, 0, 1.2, -3.6, 8);
    pt('caio', 0x6dff9a, -9.2, 2, -5.2, 9);
    // quadros: plano com textura de canvas por cima de cada portrait_i
    room.portraits = cfg.portraits.map((kid, i) => {
      const mk = (draw) => { const c = document.createElement('canvas'); c.width = 256; c.height = 332; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
      const old = mk((x) => drawAncestor(x, i, 256, 332)), now = mk((x) => drawKid(x, kid, 256, 332, { oil: true }));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3), new THREE.MeshStandardMaterial({ map: old, roughness: 0.6 }));
      m.position.set(0, 0, 0.1);
      hs['portrait_' + i].add(m);
      return { m, old, now };
    });
    room.dungeon = false;
  }
  (cfg.hide || []).forEach((n) => nodes[n] && (nodes[n].visible = false));
  rooms[id] = room;
}

// mostra a sala (troca de cenario e camera) sem mexer em quem esta onde
function showRoom(id) {
  if (S.room) scene.remove(rooms[S.room].group);
  const room = rooms[id];
  S.room = id; S.hover = null;
  scene.add(room.group);
  scene.background = new THREE.Color(room.bg);
  scene.fog = new THREE.FogExp2(room.fog[0], room.fog[1]);
  content.party.forEach((k) => { actors[k.id].root.visible = S.team.includes(k.id) && S.loc[k.id] === id; });
  setMusic(room.cfg.music || (id === 'hall' ? 'dungeon' : 'garden'));
  camReset(0);
  resize();
}
function spawnOf(room, kid) {
  const sp = room.cfg.spawn;
  return Array.isArray(sp) ? sp[content.party.findIndex((k) => k.id === kid)] : sp[kid] || sp.default;
}
function placeKid(id, roomId) {
  const room = rooms[roomId], [x, z, deg] = spawnOf(room, id), a = actors[id];
  S.loc[id] = roomId;
  a.place(x, z, deg);
  if (room.cfg.focus) { a.face(...room.cfg.focus); a.root.rotation.y = a.faceTo; }
}
// leva a equipe toda para a sala e mostra
function enterRoom(id) {
  S.team.forEach((k) => placeKid(k, id));
  showRoom(id);
}

function show(names, v) {
  names.forEach((n0) => { // "sala:no" mexe num no de outra sala (o hall puxa a grade do porao)
    const [rid, n] = n0.includes(':') ? n0.split(':') : [S.room, n0], node = rooms[rid].nodes[n];
    if (node) node.visible = v;
  });
  const room = rooms[S.room];
  if (S.room === 'exterior') {
    room.lights.lanL.intensity = room.nodes.st_flameL.visible ? 22 : 0;
    room.lights.lanR.intensity = room.nodes.st_flameR.visible ? 22 : 0;
    room.lights.doorway.intensity = room.nodes.st_door_open.visible ? 30 : 0;
  }
}

// ------------------------------------------------------------------ camera
function camBase() {
  const c = rooms[S.room].cfg.camera, ax = actors[S.active]?.root.position.x || 0;
  return [new THREE.Vector3(c.pos[0] + ax * 0.16, c.pos[1], c.pos[2]), new THREE.Vector3(c.look[0] + ax * 0.3, c.look[1], c.look[2])];
}
function camTo(pos, look, t) {
  cam.free = true;
  const p0 = cam.pos.clone(), l0 = cam.look.clone(), p1 = new THREE.Vector3(...pos), l1 = new THREE.Vector3(...look);
  return tween(t, (u) => { cam.pos.lerpVectors(p0, p1, u); cam.look.lerpVectors(l0, l1, u); });
}
async function camReset(t) {
  const [p, l] = camBase();
  await camTo(p.toArray(), l.toArray(), t);
  cam.free = false;
}
function shake(amount = 0.35) { if (!S.skipping) cam.shake = amount; }

// ------------------------------------------------------------------ UI
function flash(color, ms = 500) {
  if (S.skipping) return;
  const f = $('flash');
  f.style.transition = 'none'; f.style.background = color; f.style.opacity = 0.85;
  requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms`; f.style.opacity = 0; });
}
function setObjective(text) { S.objective = text; $('objective').innerHTML = text ? `<b>Objetivo</b> ${text}` : ''; }
function toast(text) {
  const t = el('div', 'toast', text);
  $('toasts').append(t);
  setTimeout(() => t.remove(), 3200);
}

const bubbles = [];
async function say(who, text) {
  const a = actors[who], k = KIDS[who];
  if (S.skipping) return;
  if (!a.root.visible) return voice(`${k.name} (pelo tubo)`, k.color, text); // quem esta do outro lado so se ouve
  const b = el('div', 'bubble', `<span class="who">${k.name}</span>${text}`);
  b.style.color = k.color;
  $('bubbles').append(b);
  const entry = { b, a };
  bubbles.push(entry);
  a.talking = 99;
  await waitAdvance(1500 + text.length * 62);
  a.talking = 0;
  b.remove();
  bubbles.splice(bubbles.indexOf(entry), 1);
}
async function voice(name, color, text, cls = '') {
  if (S.skipping) return;
  const m = $('mestre');
  m.className = 'on ' + cls;
  m.innerHTML = `<span class="who" style="color:${color}">${name}</span><span class="txt" style="color:${color}">${text}</span>`;
  await waitAdvance(1900 + text.length * 68);
  m.className = '';
}
async function card(text) {
  if (S.skipping) return;
  const c = $('card');
  c.innerHTML = text.replace(/\n/g, '<br>');
  c.className = 'on';
  await waitAdvance(2600 + text.length * 50);
  c.className = '';
  await wait(0.5);
}
async function title(big, small) {
  if (S.skipping) return;
  const t = $('title');
  t.innerHTML = `<h1>${big}</h1><h2>${small}</h2>`;
  t.className = 'on';
  sfx('bell');
  await waitAdvance(3600);
  t.className = '';
}
function overlay(html, cls = '') {
  const o = $('overlay');
  o.className = 'on ' + cls;
  o.innerHTML = html;
  return o;
}
function closeOverlay() { $('overlay').className = ''; $('overlay').innerHTML = ''; }
function read(ttl, text) {
  if (S.skipping) return Promise.resolve();
  return new Promise((res) => {
    sfx('pick');
    const o = overlay(`<div class="paper"><h3>${ttl}</h3><pre>${text}</pre><button>Fechar</button></div>`);
    o.querySelector('button').onclick = () => { closeOverlay(); res(); };
  });
}

function melodyUI() {
  const cfg = content.ui.melody;
  return new Promise((res) => {
    const o = overlay(`<div class="mini"><h3>♪ A senha se canta</h3><div class="slots"></div><div class="keys"></div><button class="cancel">Desistir</button></div>`);
    const seq = [], slots = o.querySelector('.slots');
    const draw = () => (slots.innerHTML = cfg.answer.map((_, i) => `<span>${seq[i] != null ? cfg.symbols[seq[i]] : '·'}</span>`).join(''));
    draw();
    cfg.symbols.forEach((s, i) => {
      const b = el('button', 'key k' + i, s);
      b.onclick = () => {
        if (seq.length >= cfg.answer.length) return;
        sfx('note' + i); actors.leo.play('play', 0.5); seq.push(i); draw();
        if (seq.length === cfg.answer.length) setTimeout(() => { closeOverlay(); res(seq.every((v, j) => v === cfg.answer[j])); }, 650);
      };
      o.querySelector('.keys').append(b);
    });
    o.querySelector('.cancel').onclick = () => { closeOverlay(); res(null); };
    ui.melody = (arr) => arr.forEach((i, n) => setTimeout(() => o.querySelectorAll('.key')[i].click(), n * 60));
  });
}
function clockUI() {
  const cfg = content.ui.clock;
  return new Promise((res) => {
    const o = overlay(`<div class="mini"><h3>O relógio marca a vez</h3><p>Para qual símbolo girar o ponteiro?</p><div class="dial"></div><button class="cancel">Deixar quieto</button></div>`);
    cfg.options.forEach((kid, i) => {
      const a = (i * Math.PI) / 3, b = el('button', 'sym', KIDS[kid].icon);
      b.style.left = 50 + Math.sin(a) * 38 + '%'; b.style.top = 50 - Math.cos(a) * 38 + '%';
      b.dataset.kid = kid;
      b.onclick = () => { closeOverlay(); res(kid); };
      o.querySelector('.dial').append(b);
    });
    o.querySelector('.cancel').onclick = () => { closeOverlay(); res(null); };
    ui.clock = (kid) => o.querySelector(`[data-kid=${kid}]`).click();
  });
}
const ui = {};

function buildPanel() {
  const party = $('party');
  party.innerHTML = '';
  content.party.filter((k) => S.team.includes(k.id)).forEach((k, i) => {
    const d = el('button', 'kid' + (S.active === k.id ? ' active' : ''));
    d.style.setProperty('--c', k.color);
    d.append(portraitCanvas(k.id, 96));
    d.append(el('span', 'nm', `${i + 1} ${k.name}`), el('span', 'cl', `${k.icon} ${k.cls}`),
      el('span', 'hp', '♥'.repeat(S.hp[k.id]) + '<i>' + '♥'.repeat(k.hp - S.hp[k.id]) + '</i>'));
    d.onclick = () => clickKid(k.id, true);
    d.onmouseenter = () => setHover({ type: 'kid', id: k.id });
    d.onmouseleave = () => setHover(null);
    party.append(d);
  });
  const verbs = $('verbs');
  verbs.innerHTML = '';
  VERBS.forEach(([v, label], i) => {
    const b = el('button', 'verb' + (S.verb === v ? ' on' : ''), `<u>${'QWER'[i]}</u> ${label}`);
    b.onclick = () => setVerb(v);
    verbs.append(b);
  });
  const k = KIDS[S.active], ab = el('button', 'verb ability' + (S.verb === 'ability' ? ' on' : ''), `<u>T</u> ${k.icon} ${k.verb}`);
  ab.style.setProperty('--c', k.color);
  ab.onclick = () => setVerb('ability');
  verbs.append(ab);
  const inv = $('inv');
  inv.innerHTML = '';
  S.inv.forEach((id) => {
    const it = content.items[id], b = el('button', 'item' + (S.item === id ? ' on' : ''), `<span>${it.icon}</span><em>${it.name}</em>`);
    b.onclick = () => clickItem(id);
    b.oncontextmenu = (e) => { e.preventDefault(); if (!S.busy) doRules(it.rules, 'look', null, 'item'); };
    b.onmouseenter = () => setHover({ type: 'item', id });
    b.onmouseleave = () => setHover(null);
    inv.append(b);
  });
  sentence();
}
function hoverName(h) {
  if (!h) return '';
  if (h.type === 'kid') return KIDS[h.id].name;
  if (h.type === 'item') return content.items[h.id].name;
  return hsDef(h.id)?.name || '';
}
function defaultVerb(h) {
  if (!h) return null;
  if (h.type === 'kid') return 'talk';
  if (h.type === 'item') return 'use';
  return S.looked.has(S.room + ':' + h.id) ? 'use' : 'look';
}
function sentence() {
  const k = KIDS[S.active], h = S.hover, name = hoverName(h);
  let v = S.item ? 'item' : S.verb || defaultVerb(h), txt = '';
  if (v === 'item') txt = `Usar ${content.items[S.item].name} em ${name}`;
  else if (v === 'ability') txt = `${k.verb} ${name}`;
  else if (v) txt = `${VERBS.find((x) => x[0] === v)[1]} ${name}`;
  if (h?.type === 'kid' && !S.verb && !S.item) txt = h.id === S.active ? `${name} (${k.cls})` : `Falar com ${name}`;
  $('sentence').textContent = txt || `${k.name}, ${k.cls}`;
  const tip = $('tooltip');
  tip.textContent = h && h.type !== 'item' && !S.busy ? name : '';
  tip.style.display = tip.textContent ? 'block' : 'none';
}
function setVerb(v) { if (S.busy) return; sfx('click'); S.verb = S.verb === v ? null : v; S.item = null; buildPanel(); }
function setActive(id) {
  if (S.busy || S.active === id) return;
  activate(id);
  sfx('click'); buildPanel();
}
// torna a crianca ativa e mostra a sala onde ela esta (equipe dividida em dois lados)
function activate(id) {
  S.active = id; S.verb = null; S.item = null;
  if (S.loc[id] && S.loc[id] !== S.room) showRoom(S.loc[id]);
}
function setHover(h) {
  if (S.hover?.type === h?.type && S.hover?.id === h?.id) return;
  const glow = (hh, on) => {
    if (hh?.type !== 'hs') return;
    rooms[S.room].hs[hh.id]?.traverse((o) => { if (o.isMesh && o.userData.em) { o.material.emissive.copy(on ? new THREE.Color(0x4a3a7a) : o.userData.em); o.material.emissiveIntensity = on ? 1 : o.userData.emI; } });
  };
  glow(S.hover, false);
  S.hover = h;
  if (!S.busy) glow(h, true);
  canvas.style.cursor = h && !S.busy ? 'pointer' : 'default';
  sentence();
}

// ------------------------------------------------------------------ regras
const hsDef = (id) => content.rooms[S.room].hotspots[id];
function test(conds = []) {
  return conds.every((c0) => {
    const c = c0.replace('$a', S.active), neg = c[0] === '!', f = neg ? c.slice(1) : c;
    let v;
    if (f.startsWith('has:')) v = S.inv.includes(f.slice(4));
    else if (f.startsWith('team:')) v = S.team.includes(f.slice(5));
    else if (f === 'low') v = S.hp[S.active] <= 1;
    else v = S.flags.has(f);
    return neg ? !v : v;
  });
}
function findRule(rules, verb, item) {
  return (rules || []).find((r) => r.v === verb && (!r.who || [].concat(r.who).includes(S.active)) && (verb !== 'item' || r.item === item) && test(r.if));
}
const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : text);

async function run(effects, vars) {
  for (const e of effects) {
    const [op, a, b, c] = e, who = a === '$a' ? S.active : a;
    switch (op) {
      case 'say': await say(who, fill(b, vars)); break;
      case 'mestre': await voice('O Mestre', '#c9a3ff', fill(a, vars), 'mestre'); break;
      case 'voice': await voice(a, b, c); break;
      case 'card': await card(a); break;
      case 'title': await title(a, b); break;
      case 'read': await read(a, b); break;
      case 'set': S.flags.add(a.replace('$a', S.active)); break;
      case 'unset': S.flags.delete(a); break;
      case 'give': if (!S.inv.includes(a)) { S.inv.push(a); if (!S.skipping && !S.cut) { sfx('pick'); toast(`+ ${content.items[a].icon} ${content.items[a].name}`); } buildPanel(); } break;
      case 'take': S.inv = S.inv.filter((i) => i !== a); if (S.item === a) S.item = null; buildPanel(); break;
      case 'hp': changeHp(who, b); break;
      case 'show': show(e.slice(1), true); break;
      case 'hide': show(e.slice(1), false); break;
      case 'sfx': if (!S.skipping) sfx(a); break;
      case 'fx': await fx(a); break;
      case 'anim': if (!S.skipping) { actors[who].play(b); await wait(0.55); } break;
      case 'wait': await wait(a); break;
      case 'cam': await camTo(a, b, c); break;
      case 'camreset': await camReset(a); break;
      case 'obj': setObjective(a); if (!S.skipping) toast('Novo objetivo'); break;
      case 'room': enterRoom(a); break;
      case 'view': showRoom(a); break;
      case 'goto': placeKid(who, b); if (S.active === who) showRoom(b); break;
      case 'place': actors[who].place(b, c, e[4]); break;
      case 'walk': await actors[who].walkTo(b, c); break;
      case 'd20': await rollD20(a, b); break;
      case 'if': await run(test(a) ? b : c || [], vars); break;
      case 'call': await run(content.macros[a], vars); break;
      case 'cutscene': await cutscene(a); break;
      case 'ui': await runUI(a); break;
      case 'end': endChapter(); break;
      default: console.warn('efeito desconhecido', op);
    }
  }
}
function changeHp(who, d) {
  const max = KIDS[who].hp;
  S.hp[who] = Math.max(1, Math.min(max, S.hp[who] + d));
  if (d > 0 && S.hp[who] >= max) S.flags.delete('hurt_' + who); // so deixa de estar machucado com PV cheios
  if (d < 0) { S.flags.add('hurt_' + who); if (!S.skipping) { sfx('hurt'); actors[who].play('hurt', 0.7); flash('#a01020', 450); } }
  buildPanel();
}
function teamUI() {
  const cfg = content.ui.team;
  return new Promise((res) => {
    const o = overlay(`<div class="mini"><h3>${cfg.title}</h3><p>${cfg.text}</p><div class="team"></div><button class="cancel go" disabled>${cfg.go}</button></div>`);
    const chosen = [], go = o.querySelector('.go');
    cfg.pool.forEach((id) => {
      const k = KIDS[id], b = el('button', 'pick', `${k.icon}<small>${k.name}</small>`);
      b.dataset.kid = id;
      b.onclick = () => {
        const i = chosen.indexOf(id);
        if (i >= 0) chosen.splice(i, 1); else if (chosen.length < cfg.size) chosen.push(id);
        o.querySelectorAll('.pick').forEach((x) => x.classList.toggle('on', chosen.includes(x.dataset.kid)));
        go.disabled = chosen.length !== cfg.size; sfx('click');
      };
      o.querySelector('.team').append(b);
    });
    go.onclick = () => { closeOverlay(); res(chosen.slice()); };
    ui.team = (ids) => { ids.forEach((id) => o.querySelector(`[data-kid=${id}]`).click()); go.click(); };
  });
}
async function runUI(kind) {
  if (kind === 'team') {
    const picked = await teamUI(), cfg = content.ui.team;
    S.team = [...cfg.fixed, ...picked];
    S.active = cfg.fixed[0];
    enterRoom(cfg.room);
    buildPanel();
  } else if (kind === 'melody') {
    const ok = await melodyUI();
    if (ok === null) return;
    sfx(ok ? 'ok' : 'fail');
    await wait(0.5);
    await run(ok ? content.ui.melody.ok : content.ui.melody.fail);
  } else if (kind === 'clock') {
    const kid = await clockUI();
    if (!kid) return;
    const cfg = content.ui.clock, hand = rooms.hall.nodes.clock_hand, from = hand.rotation.z, to = -(cfg.options.indexOf(kid) * Math.PI) / 3;
    sfx('unlock');
    await tween(1.1, (u) => (hand.rotation.z = from + (to - from) * u));
    await wait(0.4);
    await run(kid === cfg.answer ? cfg.ok : cfg.fail);
  }
}
async function cutscene(id) {
  const outer = S.cut;
  S.cut = true; S.verb = null; S.item = null;
  document.body.classList.add('cut');
  setHover(null);
  await run(content.cutscenes[id]);
  if (!outer) {
    S.cut = false; S.skipping = false;
    document.body.classList.remove('cut');
    if (cam.free) await camReset(0);
    buildPanel();
  }
}

async function doRules(rules, verb, item, kind, vars) {
  const rule = findRule(rules, verb, item);
  S.busy = true; setHover(null);
  try {
    if (rule) await run(rule.do, vars);
    else {
      const d = content.strings.defaults, line = verb === 'ability' ? d.ability[S.active] : d[verb][Math.floor(Math.random() * d[verb].length)];
      await say(S.active, line);
    }
  } finally {
    S.busy = false; S.verb = null; S.item = null;
    if (!S.ended) buildPanel();
  }
}
async function interact(hid, verbOverride) {
  if (S.busy) return;
  const def = hsDef(hid);
  if (!def) return;
  const verb = verbOverride || (S.item ? 'item' : S.verb || defaultVerb({ type: 'hs', id: hid })), item = S.item, a = actors[S.active];
  S.busy = true; setHover(null);
  const node = rooms[S.room].hs[hid], wp = node.getWorldPosition(new THREE.Vector3());
  if (verb !== 'look' && def.at) await a.walkTo(...clampWalk(def.at[0], def.at[1]));
  a.face(wp.x, wp.z);
  S.looked.add(S.room + ':' + hid);
  const rules = def.rules || content.rooms[S.room].protos[def.proto];
  await doRules(rules, verb, item, 'hs', def.kid ? KIDS[def.kid] : null);
}
async function clickKid(id, fromBar) {
  if (S.busy) return;
  const verb = S.item ? 'item' : S.verb, k = KIDS[id], st = content.strings;
  if (verb === 'ability' && S.active === 'bia' && S.loc[id] !== S.loc.bia) {
    S.busy = true;
    try { await say('bia', st.heal_far || 'Longe demais pra isso.'); } finally { S.busy = false; S.verb = null; buildPanel(); }
    return;
  }
  if (verb === 'ability' && S.active === 'bia') {
    S.busy = true;
    try {
      if (id !== 'bia') { await actors.bia.walkTo(...clampWalk(actors[id].root.position.x + 0.8, actors[id].root.position.z + 0.3)); actors.bia.face(actors[id].root.position.x, actors[id].root.position.z); }
      if (S.hp[id] < k.hp) {
        actors.bia.play('use'); sfx('heal'); await wait(0.6);
        changeHp(id, k.hp); actors[id].play('cheer', 0.8);
        await say('bia', st.heal[0]); await voice('O Mestre', '#c9a3ff', st.heal[1], 'mestre');
      } else await say('bia', st.heal_none);
    } finally { S.busy = false; S.verb = null; buildPanel(); }
    return;
  }
  if (fromBar || (!verb && id === S.active)) return setActive(id);
  if (id === S.active) return;
  S.busy = true;
  try {
    actors[S.active].face(actors[id].root.position.x, actors[id].root.position.z);
    actors[id].face(actors[S.active].root.position.x, actors[S.active].root.position.z);
    if (verb === 'look') await say(S.active, fill(st.kid_look, k));
    else if (verb === 'item' || verb === 'take' || verb === 'use' || verb === 'ability') await say(id, 'Ei! Em mim, não.');
    else await say(id, hint());
  } finally { S.busy = false; S.verb = null; S.item = null; buildPanel(); }
}
function hint() { return content.rooms[S.room].hints.find((h) => test(h.if)).text; }
function clickItem(id) {
  if (S.busy) return;
  const it = content.items[id];
  if (S.verb === 'look' || S.verb === 'ability') return doRules(it.rules, S.verb, null, 'item');
  if (it.auto && !S.verb) return doRules(it.rules, 'use', null, 'item'); // curativo etc.: clicar ja usa
  sfx('click');
  S.item = S.item === id ? null : id; S.verb = null;
  buildPanel();
}

// ------------------------------------------------------------------ efeitos especiais (mesmos nomes no Unity)
async function rollD20(path, dur) {
  const d = rooms[S.room].nodes.d20, pts = path.map((p) => new THREE.Vector3(...p)), curve = new THREE.CatmullRomCurve3(pts);
  await tween(dur, (u) => {
    curve.getPoint(u, d.position);
    d.position.y += Math.abs(Math.sin(u * 22)) * 0.25 * (1 - u);
    d.rotation.set(u * 40, u * 23, u * 31);
  }, (t) => 1 - (1 - t) * (1 - t));
  d.rotation.set(0.55, 0, 0.3);
}
function hallDungeon(room) {
  const n = room.nodes;
  n.house_set.visible = false; n.house_clockface.visible = false;
  n.dung_set.visible = true; n.dung_clockface.visible = true;
  n.dung_set.children.forEach((c) => (c.visible = true));
  room.portraits.forEach((p) => { p.m.material.map = p.now; p.m.material.needsUpdate = true; });
  room.lights.chand.intensity = 0;
  for (let i = 0; i < 6; i++) room.lights['torch' + i].intensity = 15;
  room.lights.mosaic.intensity = 10; room.lights.key.intensity = 2.3; room.lights.hemi.intensity = 1.0;
  n.clock_hand.rotation.z = -2.6;
  room.dungeon = true;
}
async function fx(name) {
  const room = rooms[S.room], n = room.nodes, L = room.lights;
  if (name === 'shake') { shake(); }
  else if (name === 'thunder') { sfx('thunder'); flash('#dfe6ff', 900); shake(0.5); }
  else if (name === 'windows_on') {
    room.wins.forEach((w, i) => setTimeout(() => { w.material.emissiveIntensity = 1.25; if (!S.skipping) sfx('click'); }, S.skipping ? 0 : 180 * i));
    if (S.skipping) room.wins.forEach((w) => (w.material.emissiveIntensity = 1.25));
  } else if (name === 'gate_slam') { sfx('slam'); shake(0.5); }
  else if (name === 'eyes_on') {
    sfx('whoosh'); flash('#7a3cff', 700);
    room.wins.forEach((w) => { w.material.emissive.set(0xa66bff); w.material.emissiveIntensity = 1.8; });
  } else if (name === 'gargoyle_wake') {
    sfx('stone'); shake(0.2);
    room.glows.filter((g) => g.name.startsWith('glow_geye')).forEach((g) => { g.material.emissive.set(0xff3b3b); g.material.color.set(0xff3b3b); g.material.emissiveIntensity = g.userData.base = 6; });
  } else if (name === 'chandelier') { sfx('spark'); await tween(0.8, (u) => (L.chand.intensity = 90 * u)); }
  else if (name === 'transform_hall') {
    if (room.dungeon) return;
    sfx('rumble'); flash('#7a3cff', 1200);
    const dk = n.dung_set.children, hk = n.house_set.children;
    dk.forEach((c) => { c.visible = false; c.userData.r = Math.random() * 0.9; });
    hk.forEach((c) => (c.userData.r = 0.1 + Math.random() * 0.9));
    n.dung_set.visible = true;
    await tween(3.2, (u) => {
      cam.shake = 0.25 * (1 - u);
      dk.forEach((c) => (c.visible = u > c.userData.r));
      hk.forEach((c) => (c.visible = u < c.userData.r));
      L.chand.intensity = 90 * (1 - u); L.chand.color.setHSL(0.1 + u * 0.65, 1, 0.6);
      for (let i = 0; i < 6; i++) L['torch' + i].intensity = 15 * u;
    }, (t) => t);
    hallDungeon(room);
    flash('#7a3cff', 800); sfx('slam');
  } else if (name === 'mimic_bite') {
    const lid = n.mimic_lid, r0 = lid.rotation.x;
    sfx('roar'); shake(0.5);
    await tween(0.9, (u) => (lid.rotation.x = r0 - Math.abs(Math.sin(u * Math.PI * 3)) * 0.9));
    lid.rotation.x = r0;
  } else if (name === 'clock_strike') { sfx('bell'); flash('#ffe9a8', 600); room.pendulum = true; }
  else if (name === 'open_caio') {
    n.hs_door_caio.traverse((o) => {
      if (/^(leaf|archleaf)/.test(o.name)) o.material = new THREE.MeshBasicMaterial({ color: 0x020203 });
      if (/^(band|glow_seal|emb_)/.test(o.name)) o.visible = false;
    });
    await tween(1.0, (u) => (L.caio.intensity = 40 * u));
  }
}

// ------------------------------------------------------------------ input
function clampWalk(x, z) {
  const w = rooms[S.room].cfg.walk;
  x = Math.max(w.minX, Math.min(w.maxX, x)); z = Math.max(w.minZ, Math.min(w.maxZ, z));
  for (const [bx, bz, r] of w.blockers) {
    const dx = x - bx, dz = z - bz, d = Math.hypot(dx, dz);
    if (d < r) { const k = r / (d || 1); x = bx + (dx || 0.01) * k; z = bz + (dz || r) * k; }
  }
  return [x, z];
}
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  const targets = [rooms[S.room].group, ...Object.values(actors).map((a) => a.root)];
  for (const hit of raycaster.intersectObjects(targets, true)) {
    if (!hit.object.isMesh || !visibleDeep(hit.object) || hit.object === actors[S.active]?.ring) continue;
    for (let o = hit.object; o; o = o.parent) {
      if (o.userData.hs && hsDef(o.userData.hs)) return { type: 'hs', id: o.userData.hs };
      if (o.userData.kid) return { type: 'kid', id: o.userData.kid };
    }
    break;
  }
  const ground = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  return ground ? { type: 'ground', x: ground.x, z: ground.z } : null;
}
canvas.addEventListener('mousemove', (ev) => {
  const tip = $('tooltip');
  tip.style.left = ev.clientX + 14 + 'px'; tip.style.top = ev.clientY + 12 + 'px';
  if (S.busy || !S.room) return;
  const p = pick(ev);
  setHover(p && p.type !== 'ground' ? p : null);
});
canvas.addEventListener('pointerdown', (ev) => {
  if (advance) return advance();
  if (S.busy || !S.room) return;
  const p = pick(ev);
  if (!p) return;
  if (p.type === 'hs') interact(p.id, ev.button === 2 ? 'look' : null);
  else if (p.type === 'kid') clickKid(p.id, false);
  else if (ev.button === 0) { S.verb = null; S.item = null; buildPanel(); actors[S.active].walkTo(...clampWalk(p.x, p.z)); }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
$('stage').addEventListener('pointerdown', (ev) => { if (ev.target !== canvas && advance && !$('overlay').classList.contains('on')) advance(); });
addEventListener('keydown', (ev) => {
  if ($('menu').classList.contains('on')) return;
  const k = ev.key.toLowerCase();
  if (k === 'escape') return S.cut ? skipCutscene() : closeOverlay();
  if (k === ' ' || k === '.' || k === 'enter') { ev.preventDefault(); return advance?.(); }
  if (k === 'm') return toast(toggleMute() ? 'Som desligado' : 'Som ligado');
  if (S.busy) return;
  if (k >= '1' && k <= '6') { const t = content.party.filter((p) => S.team.includes(p.id))[+k - 1]; if (t) setActive(t.id); }
  const vi = 'qwert'.indexOf(k);
  if (vi >= 0) setVerb(vi === 4 ? 'ability' : VERBS[vi][0]);
  if (k === 'h') { const others = content.party.filter((p) => p.id !== S.active && S.team.includes(p.id)); clickKid(others[Math.floor(Math.random() * others.length)].id, false); }
});
$('hintbtn').onclick = () => dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
$('mutebtn').onclick = () => toast(toggleMute() ? 'Som desligado' : 'Som ligado');

// ------------------------------------------------------------------ ciclo principal
const v3 = new THREE.Vector3();
function frame() {
  timer.update();
  const dt = Math.min(TEST ? 1 : 0.05, timer.getDelta()), t = timer.getElapsed();
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const u = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.ease(u));
    if (u >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.res(); }
  }
  if (S.room) {
    const room = rooms[S.room];
    Object.values(actors).forEach((a) => a.update(dt));
    if (!cam.free) { const [p, l] = camBase(); cam.pos.lerp(p, Math.min(1, dt * 2.5)); cam.look.lerp(l, Math.min(1, dt * 2.5)); }
    camera.position.copy(cam.pos);
    if (cam.shake > 0.001) { camera.position.x += (Math.random() - 0.5) * cam.shake; camera.position.y += (Math.random() - 0.5) * cam.shake; cam.shake *= Math.pow(0.02, dt); }
    camera.lookAt(cam.look);
    room.glows.forEach((g, i) => {
      const fl = g.name.startsWith('glow_torch') || g.name.startsWith('glow_chand') || g.name.startsWith('glow_lamp');
      g.material.emissiveIntensity = g.userData.base * (fl ? 0.8 + Math.sin(t * 13 + i * 1.7) * 0.12 + Math.sin(t * 31 + i) * 0.08 : 0.75 + Math.sin(t * 2 + i) * 0.25);
      if (g.name.startsWith('glow_torch')) g.scale.y = 1 + Math.sin(t * 17 + i) * 0.12;
    });
    if (S.room === 'exterior') {
      room.lights.lamp.intensity = 16 + Math.sin(t * 9) * 1.5;
      ['lanL', 'lanR'].forEach((n, i) => { if (room.lights[n].intensity) room.lights[n].intensity = 22 + Math.sin(t * 11 + i * 2) * 3; });
      room.nodes.hs_raven.rotation.y = Math.sin(t * 0.8) * 0.25;
    } else if (room.dungeon) {
      for (let i = 0; i < 6; i++) room.lights['torch' + i].intensity = 15 + Math.sin(t * 12 + i * 2.1) * 3;
      if (room.pendulum) room.nodes.pendulum.rotation.z = Math.sin(t * 3) * 0.22;
      room.nodes.mimic_lid.rotation.x += (Math.sin(t * 1.6) * 0.04 - 0.38 - room.nodes.mimic_lid.rotation.x) * 0.1;
    }
    const w = $('stage').clientWidth, h = $('stage').clientHeight;
    bubbles.forEach(({ b, a }) => {
      v3.copy(a.root.position); v3.y += 2.15; v3.project(camera);
      const x = Math.max(190, Math.min(w - 190, (v3.x * 0.5 + 0.5) * w)), y = Math.max(70, (-v3.y * 0.5 + 0.5) * h);
      b.style.left = x + 'px'; b.style.top = y + 'px';
    });
    composer.render();
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ arranque
function endChapter() {
  S.ended = true; S.busy = true;
  document.body.classList.remove('cut');
  const m = $('menu');
  const end = content.meta.end;
  m.querySelector('.sub').textContent = end?.sub || 'Fim do Capítulo 1: O Limiar';
  m.querySelector('.blurb').innerHTML = end?.blurb || 'Uma porta aberta. Cinco lacradas. Alguma coisa de seis patas no porão.<br><b>Capítulo 2, A Vez do Ladino</b>, em produção.';
  m.querySelector('#start').textContent = 'Jogar de novo';
  m.querySelector('#start').onclick = () => location.reload();
  m.classList.add('on');
}
async function boot() {
  const loader = new GLTFLoader(), base = import.meta.env.BASE_URL + 'assets/';
  // VITE_ASSETS=json: os GLB vao embrulhados em JSON/base64 (hosts que nao servem .glb)
  const load = import.meta.env.VITE_ASSETS === 'json'
    ? async (f) => { const { b64 } = await (await fetch(base + f + '.json')).json(); return loader.parseAsync(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer, ''); }
    : (f) => loader.loadAsync(base + f);
  const roomIds = Object.keys(content.rooms), withAsset = roomIds.filter((id) => content.rooms[id].asset);
  const files = [...content.party.map((k) => `kid_${k.id}.glb`), ...withAsset.map((id) => content.rooms[id].asset)];
  let done = 0;
  const res = await Promise.all(files.map((f) => load(f).then((g) => { $('loading').textContent = `Carregando… ${Math.round((++done / files.length) * 100)}%`; return g; })));
  content.party.forEach((k, i) => {
    const a = (actors[k.id] = new Actor(k.id, res[i].scene));
    a.root.userData.kid = k.id;
    scene.add(a.root);
  });
  roomIds.forEach((id) => setupRoom(id, withAsset.includes(id) ? res[content.party.length + withAsset.indexOf(id)] : null));
  content.start.items.forEach((i) => S.inv.push(i));
  enterRoom(content.start.room || 'exterior');
  if (content.meta.chapter !== 1) { $('menu').querySelector('.sub').textContent = `Capítulo ${content.meta.chapter}: ${content.meta.chapterTitle}`; document.title = `Noite Crítica — Capítulo ${content.meta.chapter}: ${content.meta.chapterTitle}`; }
  if (content.start.room) camReset(0); else { cam.pos.set(-7, 10, 19); cam.look.set(-1, 6, -10); cam.free = true; }
  buildPanel();
  frame();
  $('loading').style.display = 'none';
  $('start').disabled = false;
  $('start').onclick = async () => {
    initAudio(); startMusic();
    $('menu').classList.remove('on');
    if (params.get('skip') === '1') S.skipping = true;
    await cutscene(content.start.cutscene);
    S.busy = false;
    buildPanel();
  };
  // API de testes/automacao (tools/playthrough.mjs)
  window.game = {
    cam: camera, run, fx, enterRoom,
    S, content, rooms, actors, ui, skip: skipCutscene, interact,
    idle: () => !S.busy && !advance && !tweens.length,
    async act(hid, verb, who, item) { if (who) activate(who); S.verb = null; S.item = item || null; buildPanel(); await interact(hid, item ? 'item' : verb); },
    async item(id, verb, who) { if (who) activate(who); await doRules(content.items[id].rules, verb, null, 'item'); },
    async useItem(id, who) { if (who) activate(who); S.verb = null; buildPanel(); await clickItem(id); },
    async heal(target) { activate('bia'); S.verb = 'ability'; await clickKid(target, false); },
    next: () => advance?.(),
  };
}
boot().catch((e) => { console.error(e); $('loading').textContent = 'Erro ao carregar: ' + e.message; });
