/* Winter '26 + Spring '27 map pins from the app's shared pixel masks (carbix-ota2/src/engine/pin-art.ts), so the
   website serves exactly what the app draws. Output: ../pixel-dex/badge-icons/map-marker-<shape>-<rarity>.png + season-pins-preview.png
   Run: node --import tsx make-season-pins.mjs [shape,shape...]   (needs tsx from carbix-ota2/node_modules) */
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { PIN_H, PIN_W, PIN_SHAPES, RARITY_HEX, renderPin } from '../src/engine/pin-art';

const only = process.argv[2] ? process.argv[2].split(',') : ['snowflake', 'pinetree', 'snowman', 'mitten', 'cocoa', 'sled', 'tulip', 'butterfly', 'bee', 'umbrella'];
const parse = (c) => c.match(/\d+/g).map(Number);
const S = 6, W = PIN_W, H = PIN_H;
const sheet = new PNG({ width: 6 * S * W + 7 * 10, height: only.length * S * H + (only.length + 1) * 10 });
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 44; sheet.data[i + 1] = 56; sheet.data[i + 2] = 84; sheet.data[i + 3] = 255; }
let n = 0;
only.forEach((name, row) => {
  const shape = PIN_SHAPES[name];
  if (!shape) throw new Error('no shape ' + name);
  Object.entries(RARITY_HEX).forEach(([rar, col], ci) => {
    const png = new PNG({ width: W, height: H });
    for (const p of renderPin(shape, col)) {
      const [r, g, b] = parse(p.c), i = (p.y * W + p.x) * 4;
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
    }
    writeFileSync(`../pixel-dex/badge-icons/map-marker-${name}-${rar}.png`, PNG.sync.write(png));
    n++;
    const ox = 10 + ci * (S * W + 10), oy = 10 + row * (S * H + 10);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 4; if (!png.data[si + 3]) continue;
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
        const di = ((oy + y * S + dy) * sheet.width + (ox + x * S + dx)) * 4;
        sheet.data[di] = png.data[si]; sheet.data[di + 1] = png.data[si + 1]; sheet.data[di + 2] = png.data[si + 2]; sheet.data[di + 3] = 255;
      }
    }
  });
});
writeFileSync('../pixel-dex/season-pins-preview.png', PNG.sync.write(sheet));
console.log('wrote', n, 'pins + season-pins-preview.png');
