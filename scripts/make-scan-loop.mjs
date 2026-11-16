// Renders assets/sfx/scan-loop.wav: a seamless 2.5 s loop that plays while a car is being read.
// One slow rise-and-fall sweep (matches the blue bar, 1.25 s down + 1.25 s back), a low hum, and a soft tick on every
// 1/8 of the loop. Frequencies are chosen so every voice finishes a whole number of cycles per loop: no click at the seam.
import fs from 'node:fs';

const SR = 44100;
const T = 2.5;
const N = Math.round(SR * T);
const out = new Float32Array(N);

// sweep: mean 440 Hz over the loop (1100 whole cycles), swinging 300..580
const base = 300, depth = 280;
let ph = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const f = base + depth * (1 - Math.cos((2 * Math.PI * t) / T)) / 2;
  ph += f / SR;
  out[i] += 0.07 * Math.sin(2 * Math.PI * ph);
  // a fifth above, quieter, for a bit of shimmer
  out[i] += 0.025 * Math.sin(2 * Math.PI * ph * 1.5);
}
// hum: 110 Hz, 275 whole cycles per loop
for (let i = 0; i < N; i++) out[i] += 0.05 * Math.sin((2 * Math.PI * 110 * i) / SR);

// ticks: 8 per loop, a 25 ms burst of a 1.8 kHz square with a fast decay
const tickN = Math.floor(0.025 * SR);
for (let k = 0; k < 8; k++) {
  const s0 = Math.round((k * N) / 8);
  for (let j = 0; j < tickN; j++) {
    const env = Math.pow(1 - j / tickN, 3);
    const sq = Math.sin((2 * Math.PI * 1800 * j) / SR) > 0 ? 1 : -1;
    out[(s0 + j) % N] += 0.05 * sq * env * (k % 2 ? 0.7 : 1);
  }
}

// seam safety: a 3 ms fade at both ends (the content is already periodic, this just guards rounding)
const fade = Math.floor(0.003 * SR);
for (let i = 0; i < fade; i++) {
  const g = i / fade;
  out[i] *= g;
  out[N - 1 - i] *= g;
}

const b = Buffer.alloc(44 + N * 2);
b.write('RIFF', 0); b.writeUInt32LE(36 + N * 2, 4); b.write('WAVEfmt ', 8);
b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
b.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i])) * 30000), 44 + i * 2);
fs.writeFileSync(new URL('../assets/sfx/scan-loop.wav', import.meta.url), b);
console.log('scan-loop.wav', (b.length / 1024).toFixed(0) + ' KB');
