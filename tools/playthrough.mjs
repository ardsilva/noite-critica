// Teste automatizado: joga o Capitulo 1 inteiro pela solucao canonica (docs/PUZZLES.md)
// num Chromium headless e grava capturas em tools/shots/.
//   npm run build && npx vite preview --port 4173 &   depois:   npm test
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')); }
import fs from 'node:fs';

const GAME = process.env.GAME_URL || 'http://127.0.0.1:4173/';
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });

const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` });
// avanca falas/minijogos ate o jogo ficar livre
async function settle(max = 900) {
  for (let i = 0; i < max; i++) {
    const st = await page.evaluate(() => { const g = window.game; if (g.S.cut) g.skip(); g.next(); document.querySelector('.paper button')?.click(); return g.idle(); });
    if (st) return;
    await page.waitForTimeout(60);
  }
  throw new Error('jogo nao voltou ao estado livre');
}
const act = async (hs, verb, who, item) => { await page.evaluate((a) => { window.game.act(...a); }, [hs, verb, who, item]); await page.waitForTimeout(80); await settle(); };
const flags = () => page.evaluate(() => [...window.game.S.flags]);
const expect = async (flag) => { if (!(await flags()).includes(flag)) throw new Error('faltou a flag ' + flag); console.log('  ok', flag); };

await page.goto(GAME + '?test=1' + (process.env.FX === '0' ? '&fx=0' : ''));
await page.waitForFunction(() => window.game && !document.getElementById('start').disabled, null, { timeout: 60000 });
await shot('00-menu');
await page.click('#start');
await page.waitForTimeout(13000); await shot('01-intro-mansao');
await page.evaluate(() => { for (let i = 0; i < 2; i++) window.game.next(); });
await page.waitForTimeout(9000); await shot('02-intro-mesa');
await settle(); await page.waitForTimeout(1500); await expect('started'); await shot('03-jardim');

console.log('Fase 1: jardim');
await act('mailbox', 'ability', 'caio'); await expect('mail_open');
await page.evaluate(() => { window.game.item('convite', 'ability', 'iris'); }); await page.waitForTimeout(900); await shot('04-convite'); await settle(); await expect('invite_read');
await act('lanternL', 'ability', 'iris'); await expect('litL');
await act('fountain', 'ability', 'tomas'); await expect('hurt_tomas');
await page.evaluate(() => { window.game.heal('tomas'); }); await page.waitForTimeout(80); await settle();
if ((await flags()).includes('hurt_tomas')) throw new Error('cura falhou');
await act('fountain', 'ability', 'tomas'); await expect('statue_moved');
await act('fountain', 'take', 'bia'); await expect('got_vela');
await act('lanternR', null, 'bia', 'vela'); await expect('candleR');
await act('lanternR', 'ability', 'iris'); await expect('eyes');
await act('raven', 'ability', 'nina'); await expect('raven_talked');
await act('raven', null, 'nina', 'doces'); await expect('got_ring');
await act('door', null, 'caio', 'anel'); await expect('ring_placed');
await act('door', 'use', 'leo'); await expect('awake');
await page.waitForTimeout(600); await shot('05-jardim-olhos-acesos');
page.evaluate(() => { window.game.act('door', 'ability', 'leo'); });
await page.waitForSelector('.mini .key'); await page.waitForTimeout(700); await shot('06-senha');
await page.evaluate(() => window.game.ui.melody([0, 3, 2, 1]));            // errada de proposito
await page.waitForTimeout(1500); await settle();
page.evaluate(() => { window.game.act('door', 'ability', 'leo'); });
await page.waitForSelector('.mini .key');
await page.evaluate(() => window.game.ui.melody([0, 1, 2, 1]));
await page.waitForTimeout(2200);
await page.evaluate(() => window.game.next()); await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) { await page.evaluate(() => window.game.next()); await page.waitForTimeout(700); }
await shot('07-hall-casa');
await settle(); await page.waitForTimeout(1500); await expect('in_hall'); await shot('08-hall-masmorra');

console.log('Fase 2: hall');
await act('plaque', 'ability', 'iris'); await expect('plaque_read');
await act('portrait_2', 'ability', 'iris'); await expect('runes');
await act('clock', 'ability', 'caio'); await expect('clock_open');
await act('clock', 'ability', 'tomas'); await expect('hand_free');
page.evaluate(() => { window.game.act('clock', 'use', 'leo'); });
await page.waitForSelector('.mini .sym'); await page.waitForTimeout(600); await shot('09-relogio');
await page.evaluate(() => window.game.ui.clock('nina'));                  // errada: o mimico morde
await page.waitForTimeout(2600); await shot('10-mimico'); await settle();
const hp = await page.evaluate(() => window.game.S.hp.leo);
if (hp !== 2) throw new Error('mimico devia tirar 1 PV, leo=' + hp);
console.log('  ok mimico mordeu (leo 2 PV)');
await page.evaluate(() => { window.game.heal('leo'); }); await page.waitForTimeout(80); await settle();
page.evaluate(() => { window.game.act('clock', 'use', 'leo'); });
await page.waitForSelector('.mini .sym');
await page.evaluate(() => window.game.ui.clock('caio'));
await page.waitForTimeout(9000); await shot('11-porta-da-chave');
for (let i = 0; i < 300; i++) { if (await page.evaluate(() => window.game.S.ended)) break; await page.evaluate(() => window.game.next()); await page.waitForTimeout(100); }
if (!(await page.evaluate(() => window.game.S.ended))) throw new Error('o capitulo nao terminou');
await page.waitForTimeout(500); await shot('12-fim');
await browser.close();
const real = errors.filter((e) => !/GPU stall|WebGL|swiftshader|GroupMarker|fonts\.g/i.test(e));
if (real.length) { console.error('ERROS DE CONSOLE:\n' + real.join('\n')); process.exit(1); }
console.log('CAPITULO 1 COMPLETO, sem erros de console. Capturas em tools/shots/');
