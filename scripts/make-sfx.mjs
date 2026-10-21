// Renders Carbix's sound effects to WAV files from the SAME recipes the web app's ORIGINAL set plays live
// (square/saw/triangle tones with a fast attack + exponential decay, and band-passed noise bursts for
// anything mechanical, like the shutter). Pure Node, no audio libraries.
import fs from 'node:fs';

const SR = 44100;
const TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32000), 44 + i * 2);
  return b;
}

class Mix {
  constructor() { this.parts = []; this.end = 0; }
  /** WebAudio-style tone: 8ms linear attack to vol, exponential decay to .001 at the end, optional linear pitch slide. */
  tone(freq, start, dur, { type = 'square', vol = 0.12, slide = 0 } = {}) {
    const n = Math.floor(dur * SR), s0 = Math.floor(start * SR);
    const buf = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = freq + (slide ? slide * (i / n) : 0);
      phase += f / SR;
      const p = phase % 1;
      const w = type === 'square' ? (p < 0.5 ? 1 : -1) : type === 'sawtooth' ? 2 * p - 1 : type === 'triangle' ? 4 * Math.abs(p - 0.5) - 1 : Math.sin(2 * Math.PI * p);
      const env = t < 0.008 ? t / 0.008 : Math.pow(0.001 / vol, (t - 0.008) / Math.max(1e-6, dur - 0.008)) * vol / vol;
      buf[i] = w * vol * (t < 0.008 ? t / 0.008 : Math.pow(0.001 / vol, (t - 0.008) / Math.max(1e-6, dur - 0.008)));
      void env;
    }
    this.parts.push([s0, buf]);
    this.end = Math.max(this.end, s0 + n);
  }
  /** Band-passed white noise, exponential volume decay, optional exponential centre-frequency drop. */
  noise(start, dur, { vol = 0.2, freq = 2000, q = 1, drop = 0 } = {}) {
    const n = Math.floor(dur * SR), s0 = Math.floor(start * SR);
    const buf = new Float32Array(n);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) {
      const frac = i / n;
      const fc = drop ? Math.max(60, freq) * Math.pow(Math.max(60, freq - drop) / Math.max(60, freq), frac) : freq;
      const w0 = (2 * Math.PI * fc) / SR, alpha = Math.sin(w0) / (2 * q);
      const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
      const x0 = Math.random() * 2 - 1;
      const y0 = (b0 * x0 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      buf[i] = y0 * vol * Math.pow(0.001 / vol, frac) * 4; // x4 makes up the level the band-pass takes away
    }
    this.parts.push([s0, buf]);
    this.end = Math.max(this.end, s0 + n);
  }
  render() {
    const out = new Float32Array(this.end + Math.floor(0.05 * SR));
    for (const [s0, b] of this.parts) for (let i = 0; i < b.length; i++) out[s0 + i] += b[i];
    return out;
  }
}

const sfx = {};
const def = (name, fn) => { const m = new Mix(); fn(m); sfx[name] = m.render(); };
const tone = (m) => m.tone.bind(m);

def('click', (m) => { m.tone(660, 0, 0.06, { vol: 0.08 }); m.tone(330, 0, 0.05, { type: 'triangle', vol: 0.035 }); });
def('tab', (m) => { m.tone(440, 0, 0.05, { vol: 0.07 }); m.tone(660, 0.05, 0.06, { vol: 0.07 }); });
def('scan', (m) => m.tone(220, 0, 0.5, { type: 'sawtooth', vol: 0.06, slide: 660 }));
def('shutter', (m) => {
  m.noise(0, 0.018, { vol: 0.28, freq: 5200, q: 1.6 });
  m.noise(0.022, 0.05, { vol: 0.34, freq: 1500, q: 0.9, drop: 1100 });
  m.noise(0.075, 0.04, { vol: 0.14, freq: 420, q: 0.8, drop: 260 });
  m.tone(1244, 0.12, 0.045, { type: 'square', vol: 0.06 });
});
def('shiny', (m) => [1568, 2093, 2637, 3136].forEach((f, i) => m.tone(f, i * 0.07, 0.09, { vol: 0.09 })));
def('rev', (m) => {
  m.tone(55, 0, 0.55, { type: 'sawtooth', vol: 0.16, slide: 130 });
  m.tone(110, 0, 0.55, { type: 'sawtooth', vol: 0.07, slide: 260 });
  m.noise(0.05, 0.45, { vol: 0.2, freq: 220, q: 1.1, drop: 80 });
  m.tone(185, 0.5, 0.35, { type: 'sawtooth', vol: 0.1, slide: -95 });
  m.noise(0.52, 0.3, { vol: 0.11, freq: 420, q: 1, drop: 260 });
});
def('error', (m) => { m.tone(180, 0, 0.18, { type: 'sawtooth', vol: 0.1 }); m.tone(140, 0.18, 0.25, { type: 'sawtooth', vol: 0.1 }); });
const BASE = [[523, 659, 784], [523, 659, 784, 1047], [587, 740, 880, 1175], [659, 830, 988, 1319, 1568], [698, 880, 1047, 1397, 1760], [784, 988, 1175, 1568, 1976, 2349]];
TIERS.forEach((r, ti) => def('caught-' + r.toLowerCase(), (m) => {
  const seq = BASE[ti];
  seq.forEach((f, i) => { m.tone(f, i * 0.09, 0.14, { vol: 0.11 }); m.tone(f / 2, i * 0.09, 0.14, { type: 'triangle', vol: 0.07 }); });
  if (ti >= 4) seq.forEach((f, i) => m.tone(f * 2, 0.6 + i * 0.07, 0.1, { vol: 0.06 }));
}));
def('star-on', (m) => { m.tone(880, 0, 0.06, { vol: 0.09 }); m.tone(1320, 0.07, 0.07, { vol: 0.09 }); m.tone(1760, 0.15, 0.1, { vol: 0.08 }); });
def('star-off', (m) => { m.tone(660, 0, 0.07, { vol: 0.07 }); m.tone(440, 0.08, 0.1, { vol: 0.06 }); });
def('dup', (m) => { m.tone(320, 0, 0.13, { type: 'triangle', vol: 0.1 }); m.tone(240, 0.14, 0.22, { type: 'triangle', vol: 0.1 }); });
[0, 1, 2].forEach((i) => def('ping' + i, (m) => { const f = 560 + i * 220; m.tone(f, 0, 0.07, { vol: 0.06 }); m.tone(f * 1.5, 0.01, 0.06, { type: 'triangle', vol: 0.03 }); }));
def('levelup', (m) => {
  [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => { m.tone(f, i * 0.1, 0.13, { vol: 0.11 }); m.tone(f * 2, i * 0.1, 0.1, { vol: 0.05 }); });
  m.tone(1568, 0.75, 0.35, { vol: 0.1 });
});
def('trash', (m) => { m.tone(220, 0, 0.16, { type: 'sawtooth', vol: 0.09, slide: -140 }); m.tone(90, 0.18, 0.2, { type: 'sawtooth', vol: 0.08 }); });
def('streak', (m) => [440, 554, 659].forEach((f, i) => m.tone(f, i * 0.06, 0.09, { vol: 0.08 })));
def('swipe', (m) => m.tone(300, 0, 0.09, { type: 'triangle', vol: 0.06, slide: 260 }));
void tone;

fs.mkdirSync('assets/sfx', { recursive: true });
for (const f of fs.readdirSync('assets/sfx')) fs.unlinkSync('assets/sfx/' + f);
for (const [name, samples] of Object.entries(sfx)) {
  // the web plays these through a speaker chain at unity; normalise gently so quiet ones are still audible on a phone
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? Math.min(6, 0.7 / peak) : 1;
  fs.writeFileSync(`assets/sfx/${name}.wav`, wav(samples.map((v) => v * g)));
}
console.log(Object.keys(sfx).length, 'sounds');
