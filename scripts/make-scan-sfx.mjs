// The scanning sounds only (camera autofocus feel, clean 8-bit pixel voice, no reverb): scan-loop, scan, lock, shutter,
// tick. Every other sound keeps the original set from make-sfx.mjs; run this AFTER that script (it overwrites just these).
import fs from 'node:fs';

const SR = 44100;
const TAU = Math.PI * 2;
let seed = 20261116;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function wav(s) {
  const b = Buffer.alloc(44 + s.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + s.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(s.length * 2, 40);
  for (let i = 0; i < s.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s[i])) * 32000), 44 + i * 2);
  return b;
}

function biquad(buf, type, fc, q = 0.7) {
  const w0 = (TAU * Math.min(fc, SR * 0.45)) / SR, alpha = Math.sin(w0) / (2 * q), cw = Math.cos(w0);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; } else { b0 = alpha; b1 = 0; b2 = -alpha; }
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  const out = new Float32Array(buf.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; out[i] = y0;
  }
  return out;
}

class Mix {
  constructor() { this.parts = []; this.end = 0; }
  add(start, buf) { const s0 = Math.floor(start * SR); this.parts.push([s0, buf]); this.end = Math.max(this.end, s0 + buf.length); }
  /** a clean pixel note: band-limited pulse wave, fast attack, short pluck decay */
  pix(midi, start, dur, vol = 0.3, duty = 0.25, hold = 0.35) {
    const n = Math.floor(dur * SR), f = hz(midi);
    const K = Math.max(1, Math.min(40, Math.floor(9000 / f)));
    const amp = [];
    for (let k = 1; k <= K; k++) amp.push((2 / (Math.PI * k)) * Math.sin(Math.PI * k * duty));
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let s = 0;
      for (let k = 1; k <= K; k++) s += amp[k - 1] * Math.cos(TAU * k * f * t);
      buf[i] = s * Math.min(1, t / 0.0015) * Math.exp(-t / (dur * hold)) * Math.min(1, (n - i) / (0.004 * SR)) * vol;
    }
    this.add(start, biquad(buf, 'lp', 7000, 0.5));
  }
  thud(start, dur, f0, f1, vol = 0.4) {
    const n = Math.floor(dur * SR), buf = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      ph += (TAU * f0 * Math.pow(f1 / f0, Math.min(1, t * 1.6))) / SR;
      buf[i] = Math.sin(ph) * vol * Math.min(1, i / (0.0015 * SR)) * Math.exp(-5 * t);
    }
    this.add(start, buf);
  }
  clickNoise(start, dur, fc, vol = 0.2, q = 1) {
    const n = Math.floor(dur * SR), raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = (rnd() * 2 - 1) * Math.exp((-6 * i) / n);
    const f = biquad(raw, 'bp', fc, q);
    for (let i = 0; i < n; i++) f[i] *= vol * 4;
    this.add(start, f);
  }
  render() {
    const out = new Float32Array(this.end);
    for (const [s0, b] of this.parts) for (let i = 0; i < b.length; i++) out[s0 + i] += b[i];
    return out;
  }
}

const sfx = {};
function def(name, fn, level) { const m = new Mix(); fn(m); sfx[name] = { out: m.render().map((v) => Math.tanh(v * 1.1)), level }; }

// a camera waking up: a stepped pixel climb
def('scan', (m) => [72, 76, 79, 84, 88, 91].forEach((n, i) => m.pix(n, i * 0.045, 0.07, 0.3, 0.25, 0.5)), 0.4);
// the shutter: crisp two-blade mechanical click
def('shutter', (m) => {
  m.clickNoise(0, 0.01, 5200, 0.34, 1.2); m.thud(0, 0.035, 260, 90, 0.34);
  m.clickNoise(0.045, 0.016, 3400, 0.3, 1.0); m.thud(0.045, 0.04, 200, 80, 0.28);
}, 0.6);
// autofocus confirmed: the classic camera double beep, then a small latch
def('lock', (m) => { m.pix(91, 0, 0.07, 0.4, 0.5, 0.6); m.pix(91, 0.1, 0.1, 0.4, 0.5, 0.6); m.clickNoise(0.2, 0.012, 3000, 0.22, 1.1); }, 0.52);
// the "whoosh" sounds, now stepped pixel glides (no noise): swipe falls in 5 steps, whoosh in 7
def('swipe', (m) => [91, 88, 84, 81, 76].forEach((n, i) => m.pix(n, i * 0.03, 0.045, 0.3, 0.25, 0.6)), 0.3);
def('whoosh', (m) => [84, 81, 79, 76, 72, 69, 64].forEach((n, i) => m.pix(n, i * 0.032, 0.05, 0.3, 0.25, 0.6)), 0.34);
// the rarity engine rev and the pop: pixel too, no noise
def('rev', (m) => { [36,40,43,48,52,55,60,64].forEach((n,i)=>m.pix(n,i*0.05,0.09,0.3,0.5,0.7)); [64,60,55,52,48].forEach((n,i)=>m.pix(n,0.45+i*0.06,0.09,0.25,0.25,0.7)); }, 0.5);
def('pop', (m) => [76,88].forEach((n,i)=>m.pix(n,i*0.03,0.045,0.3,0.25,0.5)), 0.38);
def('tick',(m) => m.pix(96, 0, 0.035, 0.3, 0.25, 0.5), 0.26);

// the scanning loop: 2.5 s, seamless. 8-bit autofocus blips + a soft focus-motor click per beat + a quiet triangle under.
{
  const T = 2.5, N = Math.round(SR * T);
  const m = new Mix();
  const scale = [72, 74, 76, 79, 81, 84, 81, 79];
  for (let k = 0; k < 16; k++) m.pix(scale[k % 8], (k * T) / 16, 0.085, k % 4 === 0 ? 0.16 : 0.11, 0.125, 0.4);
  for (let k = 0; k < 4; k++) m.clickNoise((k * T) / 4, 0.01, 3000, 0.07, 1.1);
  const bass = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let x = 0;
    for (let h = 1, sgn = 1; h <= 5; h += 2, sgn = -sgn) x += (sgn / (h * h)) * Math.sin(TAU * 100 * h * t);
    bass[i] = x * 0.07 * (0.75 + 0.25 * Math.cos((TAU * 4 * t) / T));
  }
  m.add(0, bass);
  const raw = new Float32Array(N);
  for (const [s0, b] of m.parts) for (let i = 0; i < b.length; i++) raw[(s0 + i) % N] += b[i];
  sfx['scan-loop'] = { out: raw.map((v) => Math.tanh(v * 1.1)), level: 0.42, loop: true };
}

for (const [name, { out, level, loop }] of Object.entries(sfx)) {
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? Math.min(40, level / peak) : 1;
  let cut = out.length;
  if (!loop) { while (cut > 1 && Math.abs(out[cut - 1] * g) < 0.002) cut--; cut = Math.min(out.length, cut + Math.floor(0.03 * SR)); }
  const o = out.slice(0, cut).map((v, i, a) => v * g * (loop ? 1 : Math.min(1, (a.length - i) / (0.03 * SR))));
  fs.writeFileSync(`assets/sfx/${name}.wav`, wav(o));
}
console.log(Object.keys(sfx).join(', '));
