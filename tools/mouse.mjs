// Teste de entrada real: hover, clique em hotspot, verbos pela UI, troca de crianca, andar.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')); }
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto((process.env.GAME_URL || 'http://127.0.0.1:4173/') + '?test=1&skip=1&fx=0');
await page.waitForFunction(() => window.game && !document.getElementById('start').disabled);
await page.click('#start');
await page.waitForFunction(() => window.game.idle() && window.game.S.flags.has('started'), null, { timeout: 60000 });
const screenOf = (name) => page.evaluate((n) => {
  const g = window.game, o = g.rooms[g.S.room].hs[n], c = document.getElementById('c').getBoundingClientRect();
  o.updateWorldMatrix(true, true);
  let m = null; o.traverse((x) => { if (!m && x.isMesh && x.visible) m = x; });
  const b = m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox);
  const v = b.getCenter(m.position.clone()).applyMatrix4(m.matrixWorld).project(g.cam);
  return [c.left + (v.x * 0.5 + 0.5) * c.width, c.top + (-v.y * 0.5 + 0.5) * c.height];
}, name);
const settle = async () => { for (let i = 0; i < 200; i++) { if (await page.evaluate(() => { window.game.next(); return window.game.idle(); })) return; await page.waitForTimeout(80); } throw new Error('nao assentou'); };
const check = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('  ok', m); };

let [x, y] = await screenOf('mailbox');
await page.mouse.move(x, y); await page.waitForTimeout(300);
check((await page.textContent('#sentence')).includes('Olhar caixa de correio'), 'hover mostra "Olhar caixa de correio"');
await page.mouse.click(x, y); await page.waitForTimeout(300);
check(await page.locator('.bubble').count() === 1, 'clique simples faz a crianca olhar e falar');
await settle();
await page.keyboard.press('2');
check(await page.evaluate(() => window.game.S.active) === 'caio', 'tecla 2 troca para o Caio');
await page.click('.verb.ability');
await page.waitForTimeout(2500); [x, y] = await screenOf('mailbox');   // a camera acompanha a crianca ativa
await page.mouse.move(x, y); await page.waitForTimeout(900);
check((await page.textContent('#sentence')).includes('Gazua caixa de correio'), 'verbo de classe na linha de frase');
await page.mouse.click(x, y); await page.waitForTimeout(200); await settle();
check(await page.evaluate(() => window.game.S.inv.includes('convite')), 'Gazua abre a caixa de correio e da o convite');
await page.click('.kid:nth-child(4)');
await page.click('.verb.ability'); await page.click('.item:nth-child(3)');
for (let i = 0; i < 60 && !(await page.locator('.paper').count()); i++) { await page.evaluate(() => window.game.next()); await page.waitForTimeout(150); }
check(await page.locator('.paper').count() === 1, 'Magia no convite abre o papel');
await page.click('.paper button'); await settle();
const before = await page.evaluate(() => window.game.actors.iris.root.position.x);
await page.mouse.click(400, 560); await page.waitForTimeout(400);
check(Math.abs((await page.evaluate(() => window.game.actors.iris.root.position.x)) - before) > 0.5, 'clique no chao faz andar');
await page.click('.item:nth-child(1)');
await page.waitForTimeout(2500); [x, y] = await screenOf('raven'); await page.mouse.move(x, y); await page.waitForTimeout(900);
check((await page.textContent('#sentence')).includes('Usar saco de doces em corvo'), 'item selecionado + hover no corvo');
await page.keyboard.press('h'); await page.waitForTimeout(300);
await page.screenshot({ path: new globalThis.URL('./shots/13-mouse.png', import.meta.url).pathname });
await browser.close();
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log('ENTRADA POR MOUSE OK');
