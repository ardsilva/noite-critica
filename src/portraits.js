// Retratos 2D desenhados em canvas: usados na barra do grupo e nos quadros a oleo do hall.
export const LOOK = {
  bia:   { skin: '#c98d62', hair: '#3a2418', top: '#f2efe6', bg: '#7a2f3a' },
  caio:  { skin: '#e8b98f', hair: '#1c1c22', top: '#2a2d3a', bg: '#3a3f5c' },
  tomas: { skin: '#f0c8a0', hair: '#b5651d', top: '#c2a06a', bg: '#2f4f7d' },
  iris:  { skin: '#8a5a3c', hair: '#16121c', top: '#4a3a9c', bg: '#4b2f73' },
  leo:   { skin: '#f2d0b0', hair: '#d9a441', top: '#c0392b', bg: '#7d5a1c' },
  nina:  { skin: '#b97a50', hair: '#5a2d16', top: '#3f7d3a', bg: '#27492a' },
};

export function drawKid(ctx, id, w, h, { oil = false } = {}) {
  const k = LOOK[id], u = Math.min(w, h) / 100, cx = w / 2, cy = h * 0.5;
  const g = ctx.createRadialGradient(cx, cy, 5 * u, cx, cy, 80 * u);
  g.addColorStop(0, k.bg); g.addColorStop(1, '#120d18');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const R = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + x * u, cy + y * u, ww * u, hh * u); };
  const C = (x, y, r, c, sy = 1) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx + x * u, cy + y * u, r * u, r * u * sy, 0, 0, 7); ctx.fill(); };
  const T = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](cx + x * u, cy + y * u)); ctx.fill(); };
  R(-34, 28, 68, 60, k.top);                       // ombros
  if (id === 'leo' || id === 'nina') R(-40, 30, 12, 60, id === 'leo' ? '#8e1f18' : '#2f6130'), R(28, 30, 12, 60, id === 'leo' ? '#8e1f18' : '#2f6130');
  C(0, 2, 26, k.hair, 1.05);                       // cabelo
  C(0, 6, 23, k.skin);                             // rosto
  C(-9, 4, 3.2, '#15151a'); C(9, 4, 3.2, '#15151a');
  R(-6, 17, 12, 2.4, '#7a3030');
  if (id === 'bia') { C(-25, -12, 8, k.hair); C(25, -12, 8, k.hair); R(-16, -30, 32, 13, '#fff'); R(-6, -26, 12, 4, '#d63031'); R(-2, -30, 4, 12, '#d63031'); R(-9, 42, 18, 5, '#d63031'); R(-2.5, 35, 5, 19, '#d63031'); }
  if (id === 'caio') { C(0, -4, 28, '#2a2d3a', 1); C(0, 8, 22, k.skin); R(-24, -2, 48, 11, '#0c0c10'); C(-9, 3.5, 3.6, '#f5f5f5'); C(9, 3.5, 3.6, '#f5f5f5'); C(-9, 3.5, 1.6, '#15151a'); C(9, 3.5, 1.6, '#15151a'); R(-6, 19, 12, 2.4, '#7a3030'); }
  if (id === 'tomas') { T([[-25, -8], [25, -8], [21, -36], [-21, -36]], '#9aa3ad'); R(-2, -48, 5, 14, '#d63031'); R(-12, 40, 24, 6, '#2f5fa8'); R(-3, 34, 6, 18, '#2f5fa8'); }
  if (id === 'iris') { T([[-36, -12], [36, -12], [30, -17], [-30, -17]], '#3a2d80'); T([[-22, -16], [22, -16], [4, -62]], '#3a2d80'); C(-4, -30, 2.2, '#ffd84a'); C(8, -22, 1.8, '#ffd84a'); C(2, -46, 1.6, '#ffd84a'); ctx.strokeStyle = '#d9f2ff'; ctx.lineWidth = 1.6 * u; [-9, 9].forEach((x) => { ctx.beginPath(); ctx.arc(cx + x * u, cy + 4 * u, 6.5 * u, 0, 7); ctx.stroke(); }); R(-34, 30, 68, 5, '#ffd84a'); }
  if (id === 'leo') { T([[-34, -12], [34, -12], [28, -18], [-28, -18]], '#2e6b4f'); R(-19, -30, 38, 14, '#2e6b4f'); T([[14, -24], [36, -46], [22, -20]], '#f1c40f'); R(-34, 28, 68, 5, '#f1c40f'); }
  if (id === 'nina') { ctx.strokeStyle = '#2f6130'; ctx.lineWidth = 9 * u; ctx.beginPath(); ctx.arc(cx, cy + 4 * u, 27 * u, Math.PI * 0.95, Math.PI * 2.05); ctx.stroke(); R(-27, 12, 6, 26, k.hair); R(21, 12, 6, 26, k.hair); }
  if (oil) {                                        // verniz velho
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 260; i++) { ctx.fillStyle = i % 2 ? '#000' : '#c9a227'; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 14, 1); }
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(cx, cy, 30 * u, cx, cy, 85 * u);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }
}

export function drawAncestor(ctx, i, w, h) {
  const u = Math.min(w, h) / 100, cx = w / 2, cy = h / 2;
  ctx.fillStyle = '#1d1712'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3b3026'; ctx.fillRect(cx - 32 * u, cy + 26 * u, 64 * u, 60 * u);
  ctx.fillStyle = '#6a5a48'; ctx.beginPath(); ctx.ellipse(cx, cy + 2 * u, 20 * u, 25 * u, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#0e0b08'; ctx.fillRect(cx - 12 * u, cy - 2 * u, 7 * u, 3 * u); ctx.fillRect(cx + 5 * u, cy - 2 * u, 7 * u, 3 * u);
  ctx.fillRect(cx - 7 * u, cy + 14 * u, 14 * u, 2 * u);
  if (i % 2) { ctx.fillStyle = '#2a2018'; ctx.fillRect(cx - 24 * u, cy - 30 * u, 48 * u, 12 * u); }
}

export function portraitCanvas(id, size = 96) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawKid(c.getContext('2d'), id, size, size);
  return c;
}
