// The scanning loop, built ONLY from the app's own sounds (assets/sfx/ping0-2 and click), so the scan sounds like the app:
// a simple 2 s pixel pattern, ping0 -> ping1 -> ping2 -> ping1 climbing every half second with a click on each eighth.
// Run after make-sfx.mjs. Reads the three ping files and click, writes scan-loop.wav.
import fs from 'node:fs';

const SR = 44100;
const read = (n) => {
  const b = fs.readFileSync(`assets/sfx/${n}.wav`).subarray(44);
  const o = new Float32Array(b.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = b.readInt16LE(i * 2) / 32000;
  return o;
};
const T = 2.0, N = Math.round(SR * T);
const out = new Float32Array(N);
const put = (buf, t, g) => { const s0 = Math.round(t * SR); for (let i = 0; i < buf.length; i++) out[(s0 + i) % N] += buf[i] * g; };
const [p0, p1, p2, click] = ['ping0', 'ping1', 'ping2', 'click'].map(read);
[p0, p1, p2, p1].forEach((p, i) => put(p, i * 0.5, 0.5));
for (let k = 0; k < 8; k++) put(click, k * 0.25 + 0.25 / 2, 0.35);
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const g = 0.4 / peak;
const b = Buffer.alloc(44 + N * 2);
b.write('RIFF', 0); b.writeUInt32LE(36 + N * 2, 4); b.write('WAVEfmt ', 8);
b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * g)) * 32000), 44 + i * 2);
fs.writeFileSync('assets/sfx/scan-loop.wav', b);
console.log('scan-loop', (N / SR).toFixed(2) + 's');
