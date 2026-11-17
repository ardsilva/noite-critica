// Teste do Capitulo 2 (prototipo): joga as 10 duplas de apoio (Caio + 2 de 5) ate a 1a badalada.
// Caminho facil quando a dupla tem a classe; senao o caminho do Caio sozinho (custa PV, ver docs/PUZZLES.md).
//   npm run build && npx vite preview --port 4173 &   depois:   npm run test:ch2   (ou PAIR=nina,iris para uma dupla)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')); }

const GAME = process.env.GAME_URL || 'http://127.0.0.1:4173/';
const ALL = ['bia', 'tomas', 'iris', 'leo', 'nina'];
const pairs = process.env.PAIR ? [process.env.PAIR.split(',')] : ALL.flatMap((a, i) => ALL.slice(i + 1).map((b) => [a, b]));
const ORDER = [3, 1, 4, 2]; // pena, folha, pedra, chumbo (docs/PUZZLES.md)

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const results = [];

async function playPair(team) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(`[${team}] ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${team}] ${m.text()}`); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  async function settle(max = 900) {
    for (let i = 0; i < max; i++) {
      const idle = await ev(() => { const g = window.game; if (g.S.cut) g.skip(); g.next(); document.querySelector('.paper button')?.click(); return g.idle(); });
      if (idle) return;
      await page.waitForTimeout(40);
    }
    throw new Error('o jogo nao voltou ao estado livre');
  }
  const act = async (hs, verb, who, item) => { await ev((a) => { window.game.act(...a); }, [hs, verb, who, item]); await page.waitForTimeout(60); await settle(); };
  const flag = (f) => ev((x) => window.game.S.flags.has(x), f);
  const hp = () => ev(() => window.game.S.hp.caio);
  const expect = async (f) => { if (!(await flag(f))) throw new Error(`faltou a flag ${f}`); };
  const useCurativo = async () => { await ev(() => { window.game.useItem('curativo', 'caio'); }); await page.waitForTimeout(60); await settle(); };
  // se o Caio esta com 1 PV: curativo se houver, senao a bancada da sala
  const bench = { adega: ['bench', 'rest_adega'], barris: ['bench2', 'rest_barris'], caldeira: ['bench3', 'rest_caldeira'] };
  const heal = async () => {
    if ((await hp()) > 1) return;
    if (await ev(() => window.game.S.inv.includes('curativo'))) { await useCurativo(); if ((await hp()) > 1) return; }
    const room = await ev(() => window.game.S.loc.caio), [hs, fl] = bench[room];
    if (!(await flag(fl))) await act(hs, 'use', 'caio');
  };

  await page.goto(GAME + '?ch=2&test=1&fx=0');
  await page.waitForFunction(() => window.game && !document.getElementById('start').disabled, null, { timeout: 60000 });
  await page.click('#start');
  await page.waitForSelector('.mini .team', { timeout: 15000 });
  await ev((t) => window.game.ui.team(t), team);
  await settle();
  const st = await ev(() => ({ team: window.game.S.team, room: window.game.S.room, loc: window.game.S.loc.caio }));
  if (st.team.join() !== ['caio', ...team].join() || st.loc !== 'adega' || st.room !== 'adega') throw new Error('equipe/sala inicial errada: ' + JSON.stringify(st));
  const has = (k) => team.includes(k), other = team[0];
  let hard = [];

  // curativos da Bia ficam prontos antes de descer (usados so se o Caio se machucar)
  await act('mouthpiece', 'use', 'caio'); await expect('tube_open');
  if (has('bia')) { await act('medkit', 'ability', 'bia'); await act('medkit', 'ability', 'bia'); }

  // O1: grade
  if (has('tomas')) await act('winch', 'ability', 'tomas');
  else if (has('nina')) { await act('mosaic', 'ability', 'nina'); await act('stone', 'use', 'caio'); }
  else { hard.push('O1'); await heal(); await act('grate', 'ability', 'caio'); }
  await expect('grate_up');
  await act('grate', 'use', 'caio');
  if ((await ev(() => window.game.S.loc.caio)) !== 'barris') throw new Error('Caio nao passou a grade');

  // O2: barris
  if (has('iris')) await act('runewall', 'ability', 'iris');
  else if (has('leo')) await act('horn', 'ability', 'leo');
  else {
    hard.push('O2');
    await heal(); await act('barrel_1', 'use', 'caio'); // errado de proposito (-1 PV)
    await heal(); await act('barrel_2', 'use', 'caio'); // errado (-1 PV)
    await heal();
  }
  for (const k of ORDER) { await act(`barrel_${k}`, 'use', 'caio'); }
  await expect('drain_open');
  await act('drain', 'use', 'caio');
  if ((await ev(() => window.game.S.loc.caio)) !== 'caldeira') throw new Error('Caio nao desceu o escoadouro');

  // O3: cao
  if (has('leo')) await act('tube', 'ability', 'leo');
  else if (has('nina')) await act('tube', 'ability', 'nina');
  else { hard.push('O3'); await heal(); await act('dog', null, 'caio', 'doces'); }
  await act('collar', 'ability', 'caio'); await expect('got_bell');
  await act('cart_down', null, 'caio', 'sino'); await expect('bell_up');
  await act('cart_up', 'use', other); await expect('bell_arrived');
  const minHp = await hp();
  await act('clock', null, other, 'sino');
  for (let i = 0; i < 80; i++) { if (await ev(() => window.game.S.ended)) break; await ev(() => window.game.next()); await page.waitForTimeout(60); }
  if (!(await ev(() => window.game.S.ended))) throw new Error('o capitulo nao terminou');
  const endHp = await hp();
  if (endHp < 1) throw new Error('Caio chegou a 0 PV');
  await page.close();
  return { team, hard, endHp };
}

for (const t of pairs) {
  try { const r = await playPair(t); results.push(r); console.log(`  ok  caio+${t.join('+').padEnd(10)} caminho do Caio: ${r.hard.join(',') || '-'}  PV final ${r.endHp}`); }
  catch (e) { console.error(`  FALHOU caio+${t.join('+')}: ${e.message}`); process.exitCode = 1; }
}
await browser.close();
const real = errors.filter((e) => !/GPU stall|WebGL|swiftshader|GroupMarker|fonts\.g/i.test(e));
if (real.length) { console.error('ERROS DE CONSOLE:\n' + real.join('\n')); process.exit(1); }
if (process.exitCode) process.exit(process.exitCode);
console.log(`CAPITULO 2 (prototipo): ${results.length}/${pairs.length} duplas completaram, sem erros de console.`);
