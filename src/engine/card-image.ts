import { FilterMode, MipmapMode, PaintStyle, Skia, type SkFont, type SkImage } from '@shopify/react-native-skia';

import { iconURL } from './api';
import { catalogMatch } from './data';
import type { Catch } from './types';
import { catchXP, TIER_COLOR } from './xp';

/**
 * One catch as a shareable PNG (720x1040): tier-coloured frame, name plate, the photo you took (or the sprite),
 * the three headline stats, the catch date and a Carbix footer. Same look as the in-app card, drawn offscreen
 * with Skia so it can go straight to the share sheet.
 */
export async function renderCardImage(g: Catch, fontData: Uint8Array | null, spotter: string): Promise<string> {
  const W = 720, H = 1040, P = 28;
  const tier = TIER_COLOR[g.car.rarity] ?? '#B3A98D';
  const dark = ['Common', 'Legendary'].includes(g.car.rarity) ? '#141C27' : '#ffffff';
  const surface = Skia.Surface.MakeOffscreen(W, H);
  if (!surface) throw new Error('could not create card surface');
  const c = surface.getCanvas();
  const paint = Skia.Paint();
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(color));
    c.drawRect(Skia.XYWHRect(x, y, w, h), paint);
  };
  const tf = fontData ? Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(fontData)) : null;
  const font = (size: number): SkFont => Skia.Font(tf ?? undefined, size);
  const text = (s: string, x: number, y: number, size: number, color: string, align: 'l' | 'r' | 'c' = 'l', maxW = W) => {
    const f = font(size);
    let str = s;
    while (str.length > 3 && f.measureText(str).width > maxW) str = str.slice(0, -2);
    if (str !== s) str = str.slice(0, -1) + '…';
    const w = f.measureText(str).width;
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(color));
    c.drawText(str, align === 'l' ? x : align === 'r' ? x - w : x - w / 2, y, paint, f);
  };

  // frame and plate
  fill('#141C27', 0, 0, W, H);
  fill(tier, 8, 8, W - 16, H - 16);
  fill('#141C27', P, P, W - 2 * P, H - 2 * P);
  fill(tier, P + 6, P + 6, W - 2 * P - 12, 92);
  text(String(g.car.model).toUpperCase(), P + 22, P + 70, 54, dark, 'l', W - 2 * P - 260);
  text(String(g.car.make).toUpperCase(), W - P - 22, P + 46, 22, dark, 'r');
  text(g.car.rarity.toUpperCase(), W - P - 22, P + 82, 22, dark, 'r');

  // picture: the photo you took, else the sprite
  const px = P + 6, py = P + 110, pw = W - 2 * P - 12, ph = Math.round(pw * 9 / 16);
  fill('#0a0d14', px, py, pw, ph);
  let img: SkImage | null = null;
  try {
    if (g.photo && g.photo.startsWith('data:')) {
      img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(g.photo.slice(g.photo.indexOf(',') + 1)));
    } else {
      const e = catalogMatch(g.car);
      if (e) img = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(iconURL(e)));
    }
  } catch {
    img = null;
  }
  if (img) {
    const iw = img.width(), ih = img.height();
    const isPhoto = !!(g.photo && g.photo.startsWith('data:'));
    const s = isPhoto ? Math.max(pw / iw, ph / ih) : Math.min((pw * 0.86) / iw, (ph * 0.86) / ih);
    const dw = iw * s, dh = ih * s;
    const dx = px + (pw - dw) / 2, dy = py + (ph - dh) / 2;
    c.save();
    c.clipRect(Skia.XYWHRect(px, py, pw, ph), 0, true);
    c.drawImageRectOptions(img, Skia.XYWHRect(0, 0, iw, ih), Skia.XYWHRect(dx, dy, dw, dh), isPhoto ? FilterMode.Linear : FilterMode.Nearest, MipmapMode.None, paint);
    c.restore();
  }
  // corner brackets
  const bl = 26, bt = 5;
  for (const [cx, cy, sx, sy] of [[px + 10, py + 10, 1, 1], [px + pw - 10, py + 10, -1, 1], [px + 10, py + ph - 10, 1, -1], [px + pw - 10, py + ph - 10, -1, -1]] as const) {
    fill('#ffffff', sx > 0 ? cx : cx - bl, cy - (sy > 0 ? 0 : bt), bl, bt);
    fill('#ffffff', cx - (sx > 0 ? 0 : bt), sy > 0 ? cy : cy - bl, bt, bl);
  }
  if (g.shiny) { fill('#FFD84D', px + pw - 112, py + 14, 98, 30); text('SHINY', px + pw - 63, py + 36, 22, '#7A5A10', 'c'); }

  // headline stats
  const e = catalogMatch(g.car);
  const hp = g.car.horsepower || e?.hp || 0;
  const top = g.car.topSpeedMph || e?.top || 0;
  const zts = g.car.zeroToSixty || e?.zts || '';
  const cells: [string, string][] = [[hp ? String(hp) : '-', 'POWER HP'], [top ? String(top) : '-', 'TOP MPH'], [zts ? String(zts).replace(/s$/, '') : '-', '0-60 SEC']];
  const cw = (pw - 12) / 3, cy0 = py + ph + 12;
  cells.forEach(([v, l], i) => {
    const x = px + i * (cw + 6);
    fill('#1e2736', x, cy0, cw, 110);
    text(v, x + cw / 2, cy0 + 62, 48, '#ffffff', 'c', cw - 10);
    text(l, x + cw / 2, cy0 + 94, 18, '#aab4cc', 'c');
  });

  // body: rarity strip and spec lines
  const by = cy0 + 130;
  fill(tier, P + 6, by, W - 2 * P - 12, 44);
  text(`${g.car.rarity.toUpperCase()}  +${catchXP(g.car) + (g.shiny ? 100 : 0)} XP`, P + 22, by + 31, 24, dark);
  const lines = [
    [`${String(g.car.class || e?.cls || '').toUpperCase()}${g.car.country ? '  -  ' + String(g.car.country).toUpperCase() : ''}`, g.car.yearRange || e?.years || ''],
    ['ENGINE', String(g.car.engine || e?.eng || '-')],
    ['DRIVE', String(g.car.drive || '-')],
    ['COLOR', String(g.car.color || '-').toUpperCase()],
    ['CAUGHT', new Date(g.ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()],
    ['SPOTTER', spotter.toUpperCase()],
  ];
  lines.forEach(([k, v], i) => {
    const y = by + 86 + i * 40;
    text(String(k), P + 22, y, 20, '#8e98b8', 'l', 240);
    text(String(v), W - P - 22, y, 22, '#ffffff', 'r', W - 2 * P - 300);
  });

  // footer
  fill(tier, P + 6, H - P - 58, W - 2 * P - 12, 52);
  text('CARBIX', P + 22, H - P - 22, 30, dark);
  text('SPOT REAL CARS. FILL YOUR BIX.', W - P - 22, H - P - 22, 18, dark, 'r');

  const snap = surface.makeImageSnapshot();
  const b64 = snap.encodeToBase64();
  if (!b64) throw new Error('could not encode the card');
  return b64;
}
