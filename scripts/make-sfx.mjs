// Carbix sound effects, version 2. Pure Node, no audio libraries, deterministic (seeded noise).
//
// The first set was bare square and sawtooth beeps: the sound of a Web Audio demo. This one is built like instruments:
//   - mallet:  a marimba-like tap (a few inharmonic partials, each decaying at its own rate, a soft thump at the front)
//   - chime:   a bell with bright partials that ring out
//   - thud / clickNoise / whoosh: the mechanical and air sounds (shutter, latch, tap, swipe)
//   - pad:     a soft sustained chord under the bigger jingles
// then everything goes through a small room reverb and a soft limiter, and each sound is levelled for its job
// (taps are quiet, jingles are full). All notes sit in one key family so overlapping sounds never clash.
import fs from 'node:fs';

const SR = 44100;
const TAU = Math.PI * 2;
const TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Grail'];

let seed = 20261115;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32000), 44 + i * 2);
  return b;
}

/* ---------- filters ---------- */
function biquad(buf, type, fc, q = 0.7) {
  const w0 = (TAU * Math.min(fc, SR * 0.45)) / SR, alpha = Math.sin(w0) / (2 * q), cw = Math.cos(w0);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; } // bandpass
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  const out = new Float32Array(buf.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    out[i] = y0;
  }
  return out;
}

/** A small room: four damped combs and two allpass stages. `circular` makes it wrap, for seamless loops. */
function reverb(dry, wet, { size = 1, damp = 0.35, circular = false } = {}) {
  if (wet <= 0) return dry;
  const tail = circular ? 0 : Math.floor(SR * 0.9 * size);
  const src = new Float32Array(dry.length * (circular ? 3 : 1) + tail);
  if (circular) { for (let k = 0; k < 3; k++) src.set(dry, k * dry.length); } else src.set(dry, 0);
  const n = src.length;
  const pre = Math.floor(0.012 * SR);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => Math.floor(s * size * SR));
  const fb = 0.8;
  const acc = new Float32Array(n);
  for (const d of combs) {
    const line = new Float32Array(d);
    let idx = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const x = i >= pre ? src[i - pre] : 0;
      const y = line[idx];
      lp = y * (1 - damp) + lp * damp;
      line[idx] = x + lp * fb;
      idx = (idx + 1) % d;
      acc[i] += y * 0.25;
    }
  }
  let out = acc;
  for (const [d, g] of [[Math.floor(0.005 * SR), 0.7], [Math.floor(0.0017 * SR), 0.7]]) {
    const line = new Float32Array(d);
    let idx = 0;
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const bufd = line[idx];
      const x = out[i];
      const y = -g * x + bufd;
      line[idx] = x + g * y;
      idx = (idx + 1) % d;
      o[i] = y;
    }
    out = o;
  }
  out = biquad(out, 'lp', 5200, 0.6);
  const res = new Float32Array(circular ? dry.length : n);
  const off = circular ? dry.length : 0;
  for (let i = 0; i < res.length; i++) res[i] = (circular ? 0 : src[i]) + out[i + off] * wet * 3.2;
  if (circular) for (let i = 0; i < res.length; i++) res[i] += dry[i];
  return res;
}

/* ---------- voices ---------- */
class Mix {
  constructor() { this.parts = []; this.end = 0; }
  add(start, buf) {
    const s0 = Math.floor(start * SR);
    this.parts.push([s0, buf]);
    this.end = Math.max(this.end, s0 + buf.length);
  }
  /** a marimba-like tap */
  mallet(midi, start, dur, vol = 0.3, { bright = 1 } = {}) {
    const n = Math.floor(dur * SR), f = hz(midi);
    const buf = new Float32Array(n);
    const P = [[1, 1, 0.38], [3.92, 0.32 * bright, 0.09], [9.4, 0.1 * bright, 0.035]];
    for (const [r, a, tau] of P) {
      if (f * r > 12000) continue;
      const ph0 = rnd() * TAU;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const att = Math.min(1, t / 0.002);
        buf[i] += Math.sin(TAU * f * r * t + ph0) * a * att * Math.exp(-t / (dur * tau));
      }
    }
    // the soft thump of the mallet itself
    const th = Math.min(n, Math.floor(0.012 * SR));
    for (let i = 0; i < th; i++) buf[i] += (rnd() * 2 - 1) * 0.18 * Math.pow(1 - i / th, 2);
    const lpd = biquad(buf, 'lp', 4800, 0.6);
    for (let i = 0; i < n; i++) lpd[i] *= vol;
    this.add(start, lpd);
  }
  /** a bell */
  chime(midi, start, dur, vol = 0.2) {
    const n = Math.floor(dur * SR), f = hz(midi);
    const buf = new Float32Array(n);
    const P = [[1, 1, 0.5], [2.0, 0.5, 0.4], [2.76, 0.34, 0.26], [5.4, 0.18, 0.12], [8.93, 0.09, 0.06]];
    for (const [r, a, tau] of P) {
      if (f * r > 14000) continue;
      const ph0 = rnd() * TAU;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const att = Math.min(1, t / 0.001);
        buf[i] += Math.sin(TAU * f * r * t + ph0) * a * att * Math.exp(-t / (dur * tau));
      }
    }
    for (let i = 0; i < n; i++) buf[i] *= vol;
    this.add(start, buf);
  }
  /** a sine that falls (or rises) in pitch: a thump or a pop */
  thud(start, dur, f0, f1, vol = 0.4) {
    const n = Math.floor(dur * SR);
    const buf = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const f = f0 * Math.pow(f1 / f0, Math.min(1, t * 1.6));
      ph += (TAU * f) / SR;
      buf[i] = Math.sin(ph) * vol * Math.min(1, i / (0.0015 * SR)) * Math.exp(-5 * t);
    }
    this.add(start, buf);
  }
  /** a short burst of band-passed noise: the click of a latch, a key, a shutter curtain */
  clickNoise(start, dur, fc, vol = 0.2, q = 1) {
    const n = Math.floor(dur * SR);
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = (rnd() * 2 - 1) * Math.exp((-6 * i) / n);
    const f = biquad(raw, 'bp', fc, q);
    for (let i = 0; i < n; i++) f[i] *= vol * 4;
    this.add(start, f);
  }
  /** moving air: noise through a band-pass whose centre glides, with a smooth swell */
  whoosh(start, dur, fc0, fc1, vol = 0.25) {
    const n = Math.floor(dur * SR);
    const out = new Float32Array(n);
    const seg = 256;
    for (let s = 0; s < n; s += seg) {
      const len = Math.min(seg, n - s);
      const t = s / n;
      const fc = fc0 * Math.pow(fc1 / fc0, t);
      const raw = new Float32Array(len + 512);
      for (let i = 0; i < raw.length; i++) raw[i] = rnd() * 2 - 1;
      const f = biquad(raw, 'bp', fc, 0.9);
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, t)), 1.6);
      for (let i = 0; i < len; i++) out[s + i] = f[i + 256] * env * vol * 5;
    }
    this.add(start, out);
  }
  /** a soft sustained chord */
  pad(midis, start, dur, vol = 0.1) {
    const n = Math.floor(dur * SR);
    const buf = new Float32Array(n);
    for (const m of midis) {
      const f = hz(m);
      for (const det of [-0.003, 0.003]) {
        const ph0 = rnd() * TAU;
        for (let i = 0; i < n; i++) {
          const t = i / SR;
          const env = Math.min(1, t / (dur * 0.12)) * Math.pow(Math.max(0, 1 - t / dur), 1.5);
          const x = Math.sin(TAU * f * (1 + det) * t + ph0) + 0.3 * Math.sin(TAU * f * 2 * (1 + det) * t + ph0);
          buf[i] += x * env;
        }
      }
    }
    const lpd = biquad(buf, 'lp', 2200, 0.6);
    for (let i = 0; i < n; i++) lpd[i] *= (vol / midis.length) * 0.9;
    this.add(start, lpd);
  }
  /** a saw run through a low-pass: an engine */
  engine(start, dur, f0, f1, vol, fc) {
    const n = Math.floor(dur * SR);
    const buf = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const f = f0 * Math.pow(f1 / f0, i / n);
      ph += f / SR;
      const p = ph % 1;
      buf[i] = (2 * p - 1) * Math.min(1, i / (0.02 * SR)) * Math.pow(1 - i / n, 0.6);
    }
    const lpd = biquad(buf, 'lp', fc, 0.9);
    for (let i = 0; i < n; i++) lpd[i] *= vol;
    this.add(start, lpd);
  }
  render() {
    const out = new Float32Array(this.end);
    for (const [s0, b] of this.parts) for (let i = 0; i < b.length; i++) out[s0 + i] += b[i];
    return out;
  }
}

const sfx = {};
/** `wet`: reverb amount. `level`: the loudest sample after levelling (taps quiet, jingles full). */
function def(name, fn, { wet = 0.1, level = 0.5, size = 1 } = {}) {
  const m = new Mix();
  fn(m);
  let out = reverb(m.render(), wet, { size });
  // soft limiter, then trim leading/trailing silence a touch
  out = out.map((v) => Math.tanh(v * 1.1));
  sfx[name] = { out, level };
}

/* ---------- interface ---------- */
def('click', (m) => { m.thud(0, 0.05, 280, 150, 0.35); m.clickNoise(0, 0.012, 3200, 0.14, 0.9); }, { wet: 0.03, level: 0.42 });
def('tab', (m) => { m.mallet(79, 0, 0.2, 0.3); m.clickNoise(0, 0.008, 3800, 0.08, 1); }, { wet: 0.07, level: 0.4 });
def('tick', (m) => { m.clickNoise(0, 0.014, 2600, 0.16, 1.2); m.mallet(91, 0, 0.07, 0.12); }, { wet: 0.02, level: 0.3 });
def('swipe', (m) => m.whoosh(0, 0.16, 1900, 800, 0.2), { wet: 0.04, level: 0.34 });
def('whoosh', (m) => m.whoosh(0, 0.24, 1300, 500, 0.3), { wet: 0.06, level: 0.4 });
def('pop', (m) => { m.thud(0, 0.07, 520, 220, 0.4); m.clickNoise(0, 0.01, 2500, 0.16, 1); }, { wet: 0.04, level: 0.42 });
def('star-on', (m) => { m.mallet(76, 0, 0.22, 0.3); m.mallet(83, 0.07, 0.22, 0.3); m.chime(88, 0.14, 0.55, 0.18); }, { wet: 0.16, level: 0.5 });
def('star-off', (m) => { m.mallet(79, 0, 0.2, 0.26); m.mallet(72, 0.08, 0.34, 0.26); }, { wet: 0.12, level: 0.42 });
def('dup', (m) => { m.mallet(67, 0, 0.24, 0.3); m.mallet(64, 0.12, 0.36, 0.3); }, { wet: 0.12, level: 0.46 });
def('trash', (m) => { m.whoosh(0, 0.22, 2400, 450, 0.25); m.thud(0.13, 0.14, 160, 60, 0.4); }, { wet: 0.06, level: 0.5 });
def('error', (m) => { m.mallet(55, 0, 0.4, 0.34); m.mallet(48, 0.16, 0.55, 0.36); }, { wet: 0.12, level: 0.55 });
def('coin', (m) => { m.chime(91, 0, 0.4, 0.22); m.chime(96, 0.07, 0.7, 0.24); }, { wet: 0.16, level: 0.5 });
[0, 1, 2].forEach((i) => def('ping' + i, (m) => m.mallet([79, 83, 86][i], 0, 0.3, 0.3, { bright: 1.2 }), { wet: 0.14, level: 0.4 }));

/* ---------- scanning ---------- */
// the one-shot at the start of a read (kept for the catch screen): a soft rising swell
def('scan', (m) => {
  m.whoosh(0, 0.5, 600, 3200, 0.2);
  m.thud(0, 0.5, 120, 330, 0.18);
}, { wet: 0.15, level: 0.5 });
def('shutter', (m) => {
  m.clickNoise(0, 0.012, 6200, 0.34, 1.2);
  m.thud(0, 0.045, 300, 90, 0.4);
  m.clickNoise(0.048, 0.022, 3600, 0.3, 1.0);
  m.thud(0.048, 0.055, 210, 70, 0.34);
  m.clickNoise(0.11, 0.05, 1300, 0.14, 0.7);
}, { wet: 0.05, level: 0.62 });
def('lock', (m) => {
  m.thud(0, 0.1, 190, 60, 0.5);
  m.clickNoise(0, 0.015, 2300, 0.3, 1);
  m.chime(91, 0.05, 0.55, 0.2);
  m.chime(96, 0.1, 0.7, 0.14);
}, { wet: 0.18, level: 0.62 });

/* ---------- jingles ---------- */
const chord = (root) => [root, root + 4, root + 7, root + 12];
TIERS.forEach((r, ti) => def('caught-' + r.toLowerCase(), (m) => {
  const roots = [72, 72, 74, 76, 77, 79, 72];
  const seq = [
    [0, 4, 7], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12, 16], [0, 4, 7, 12, 16], [0, 4, 7, 12, 16, 19], [0, 7, 12, 16, 19, 24, 28, 31],
  ][ti].map((x) => roots[ti] + x);
  const step = ti >= 5 ? 0.075 : 0.09;
  seq.forEach((n, i) => m.mallet(n, i * step, 0.34 + ti * 0.04, 0.26 - ti * 0.006));
  const last = seq.length * step;
  m.pad(chord(roots[ti] - 12), 0, 0.5 + ti * 0.17, 0.12 + ti * 0.01);
  if (ti >= 2) m.chime(seq[seq.length - 1] + 12, last, 0.5 + ti * 0.12, 0.13);
  if (ti >= 4) seq.slice(-3).forEach((n, i) => m.chime(n + 12, last + 0.07 + i * 0.07, 0.8, 0.1));
  if (ti >= 5) m.thud(0, 0.5, 100, 45, 0.45);
  if (ti >= 6) { for (let i = 0; i < 6; i++) m.chime(96 + i * 3, 0.6 + i * 0.08, 1.2, 0.08); m.whoosh(0, 0.7, 500, 4200, 0.12); }
}, { wet: 0.12 + ti * 0.04, level: 0.5 + ti * 0.03, size: 1 + ti * 0.08 }));
def('shiny', (m) => {
  [96, 100, 103, 108, 112, 115].forEach((n, i) => m.chime(n, i * 0.06, 1.0, 0.13));
  m.pad([72, 79, 84, 88], 0, 0.9, 0.1);
  m.whoosh(0, 0.4, 1200, 5200, 0.1);
}, { wet: 0.34, level: 0.58, size: 1.3 });
def('streak', (m) => { m.mallet(72, 0, 0.22, 0.28); m.mallet(76, 0.07, 0.22, 0.28); m.mallet(79, 0.14, 0.3, 0.3); m.chime(84, 0.21, 0.6, 0.16); }, { wet: 0.16, level: 0.5 });
def('levelup', (m) => {
  [72, 76, 79, 84, 88].forEach((n, i) => m.mallet(n, i * 0.09, 0.45, 0.28));
  m.pad(chord(60), 0, 1.3, 0.14);
  m.chime(96, 0.5, 1.1, 0.18);
  m.chime(91, 0.54, 1.1, 0.12);
}, { wet: 0.3, level: 0.66, size: 1.2 });
def('fanfare', (m) => {
  [72, 76, 79, 84].forEach((n, i) => m.mallet(n, i * 0.1, 0.5, 0.28));
  m.pad(chord(60), 0, 1.6, 0.16);
  m.pad(chord(67), 0.4, 1.4, 0.12);
  [84, 88, 91, 96].forEach((n, i) => m.chime(n, 0.45 + i * 0.03, 1.4, 0.14));
  m.thud(0, 0.4, 110, 50, 0.4);
}, { wet: 0.32, level: 0.68, size: 1.3 });
def('rev', (m) => {
  m.engine(0, 0.6, 52, 120, 0.36, 520);
  m.whoosh(0.05, 0.5, 260, 90, 0.2);
  m.engine(0.52, 0.45, 150, 70, 0.26, 430);
}, { wet: 0.08, level: 0.55 });

/* ---------- the scanning loop: 2.5 s, seamless, quiet enough to sit under everything ---------- */
{
  const T = 2.5, N = Math.round(SR * T);
  const m = new Mix();
  const sweep = new Float32Array(N);
  // a gentle rise and fall, mean 412 Hz (1030 whole cycles per loop) so the seam is silent
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const f = 330 + 164 * (1 - Math.cos((TAU * t) / T)) / 2;
    ph += f / SR;
    sweep[i] = Math.sin(TAU * ph) * 0.05;
  }
  const hum = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const trem = 0.7 + 0.3 * Math.cos((TAU * 2 * t) / T); // 2 whole cycles
    hum[i] = (Math.sin(TAU * 110 * t) * 0.09 + Math.sin(TAU * 165 * t) * 0.05 + Math.sin(TAU * 220 * t) * 0.03) * trem;
  }
  m.add(0, sweep);
  m.add(0, hum);
  // eight soft taps and a bell blip every 1.25 s, so it reads as "working" without being a melody
  for (let k = 0; k < 8; k++) m.clickNoise((k * T) / 8, 0.012, 2800, 0.06, 1.2);
  m.chime(91, 0, 0.9, 0.05);
  m.chime(88, 1.25, 0.9, 0.05);
  const raw = new Float32Array(N);
  for (const [s0, b] of m.parts) for (let i = 0; i < b.length; i++) raw[(s0 + i) % N] += b[i]; // wrap anything that runs past the end
  let out = reverb(raw, 0.22, { circular: true });
  out = out.map((v) => Math.tanh(v * 1.1));
  sfx['scan-loop'] = { out, level: 0.5, loop: true };
}

fs.mkdirSync('assets/sfx', { recursive: true });
for (const f of fs.readdirSync('assets/sfx')) fs.unlinkSync('assets/sfx/' + f);
for (const [name, { out: raw, level, loop }] of Object.entries(sfx)) {
  let out = raw;
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? Math.min(8, level / peak) : 1;
  let cut = out.length;
  if (!loop) { while (cut > 1 && Math.abs(out[cut - 1] * g) < 0.002) cut--; cut = Math.min(out.length, cut + Math.floor(0.03 * SR)); }
  const trimmed = out.slice(0, cut).map((v, i, a) => v * g * (loop ? 1 : Math.min(1, (a.length - i) / (0.03 * SR))));
  fs.writeFileSync(`assets/sfx/${name}.wav`, wav(trimmed));
}
console.log(Object.keys(sfx).length, 'sounds');
