// Audio 100% sintetizado (WebAudio). Substituir por samples/OST na producao (ver docs/PRODUCAO.md).
let ctx = null, master = null, musicOn = false;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

function tone(freq, dur, { type = 'triangle', vol = 0.2, at = 0, slide = 0, attack = 0.01 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, at = 0, freq = 800, q = 0.7, type = 'lowpass', sweep = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq + sweep), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

export const NOTES = [392.0, 466.16, 523.25, 622.25]; // sol, sib, do, mib (as 4 teclas do bardo)

const SFX = {
  click: () => tone(660, 0.05, { type: 'square', vol: 0.05 }),
  pick: () => { tone(520, 0.08); tone(780, 0.12, { at: 0.07 }); },
  unlock: () => { noise(0.04, { freq: 3000, vol: 0.2 }); noise(0.05, { freq: 2200, vol: 0.2, at: 0.18 }); tone(180, 0.12, { type: 'square', vol: 0.12, at: 0.34 }); },
  spark: () => { for (let i = 0; i < 6; i++) tone(1200 + Math.random() * 1800, 0.07, { type: 'sawtooth', vol: 0.05, at: i * 0.04 }); noise(0.3, { freq: 5000, type: 'highpass', vol: 0.08 }); },
  heal: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { at: i * 0.09, type: 'sine', vol: 0.15 })),
  hurt: () => { tone(220, 0.25, { type: 'sawtooth', slide: -140, vol: 0.2 }); noise(0.12, { freq: 900, vol: 0.2 }); },
  dice: () => { for (let i = 0; i < 9; i++) noise(0.03, { freq: 2500 + Math.random() * 2000, type: 'bandpass', q: 4, vol: 0.25, at: i * (0.06 + i * 0.012) }); },
  stone: () => noise(0.9, { freq: 220, sweep: -150, vol: 0.5 }),
  knock: () => [0, 0.28, 0.56].forEach((at) => { noise(0.08, { freq: 300, vol: 0.5, at }); tone(90, 0.12, { type: 'sine', vol: 0.3, at }); }),
  door: () => { tone(110, 1.2, { type: 'sawtooth', slide: 60, vol: 0.07 }); noise(1.2, { freq: 500, sweep: 400, vol: 0.08 }); },
  slam: () => { noise(0.5, { freq: 160, vol: 0.9 }); tone(55, 0.5, { type: 'sine', vol: 0.5 }); },
  thunder: () => { noise(2.4, { freq: 700, sweep: -640, vol: 0.9 }); noise(0.15, { freq: 4000, vol: 0.5 }); },
  crow: () => [0, 0.26].forEach((at) => { tone(520, 0.18, { type: 'sawtooth', slide: -180, vol: 0.12, at }); noise(0.18, { freq: 1500, type: 'bandpass', q: 3, vol: 0.2, at }); }),
  bell: () => [0, 1.1].forEach((at) => { tone(196, 2.2, { type: 'sine', vol: 0.3, at }); tone(392.5, 1.8, { type: 'sine', vol: 0.12, at }); tone(587, 1.2, { type: 'sine', vol: 0.06, at }); }),
  roar: () => { tone(70, 1.4, { type: 'sawtooth', slide: -30, vol: 0.35 }); noise(1.4, { freq: 260, vol: 0.5 }); },
  zap: () => tone(1400, 0.12, { type: 'square', slide: -1200, vol: 0.08 }),
  rumble: () => noise(3.2, { freq: 120, vol: 0.8 }),
  ok: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, { at: i * 0.1, vol: 0.16 })),
  fail: () => { tone(196, 0.3, { type: 'square', vol: 0.1 }); tone(185, 0.5, { type: 'square', vol: 0.1, at: 0.2 }); },
  step: () => noise(0.04, { freq: 500, vol: 0.05 }),
  whoosh: () => noise(0.7, { freq: 300, sweep: 2400, type: 'bandpass', q: 1.2, vol: 0.25 }),
};
NOTES.forEach((f, i) => { SFX['note' + i] = () => { tone(f, 0.45, { type: 'square', vol: 0.09 }); tone(f * 2, 0.3, { type: 'triangle', vol: 0.07 }); }; });

export function sfx(name) { if (ctx && SFX[name]) SFX[name](); }

// Tema ambiente: arpejo menor lento + vento. Dois modos: "jardim" e "masmorra".
let mode = 'garden', step = 0, timer = null;
const SEQ = {
  garden: [220, 261.6, 329.6, 261.6, 196, 246.9, 293.7, 246.9, 174.6, 220, 261.6, 220, 164.8, 207.7, 246.9, 329.6],
  dungeon: [110, 130.8, 155.6, 185, 110, 146.8, 155.6, 207.7, 98, 116.5, 146.8, 174.6, 103.8, 123.5, 155.6, 196],
};
export function setMusic(m) { mode = m; }
export function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  const tick = () => {
    const s = SEQ[mode], f = s[step % s.length];
    tone(f, 1.6, { type: 'triangle', vol: 0.055, attack: 0.05 });
    if (step % 4 === 0) tone(f / 2, 2.6, { type: 'sine', vol: 0.08, attack: 0.2 });
    if (step % 8 === 6) tone(f * 3, 0.9, { type: 'sine', vol: 0.02, attack: 0.1 });
    if (step % 8 === 0) noise(4.5, { freq: 300 + Math.random() * 300, type: 'bandpass', q: 0.5, vol: 0.035 });
    step++;
  };
  tick();
  timer = setInterval(tick, mode === 'dungeon' ? 620 : 560);
}
export function toggleMute() {
  if (!master) return false;
  master.gain.value = master.gain.value > 0 ? 0 : 0.5;
  return master.gain.value === 0;
}
