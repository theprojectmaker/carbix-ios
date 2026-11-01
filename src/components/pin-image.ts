import { Skia, type SkCanvas } from '@shopify/react-native-skia';

import { PIN_H, PIN_W, RARITY_HEX, renderPin, shapeForPinId } from '@/engine/pin-art';

export type PinBitmap = { uri: string; w: number; h: number; anchorX: number };

const cache = new Map<string, PinBitmap>();
const INK = '#141C27';

/** A 3x5 pixel digit font (plus a plus sign), one string per row: '#' is lit. */
const DIGITS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...'],
};

function rect(c: SkCanvas, paint: ReturnType<typeof Skia.Paint>, color: string, x: number, y: number, w: number, h: number, s: number) {
  paint.setColor(Skia.Color(color));
  c.drawRect(Skia.XYWHRect(x * s, y * s, w * s, h * s), paint);
}

function drawBase(c: SkCanvas, paint: ReturnType<typeof Skia.Paint>, pinId: string, rarity: string, oy: number, s: number) {
  const shape = shapeForPinId(pinId);
  if (shape) {
    for (const p of renderPin(shape, RARITY_HEX[rarity.toLowerCase()] || '#B3A98D')) rect(c, paint, p.c, p.x, p.y + oy, 1, 1, s);
    return;
  }
  // the classic teardrop, as pixel rows
  const color = RARITY_HEX[rarity.toLowerCase()] || '#B3A98D';
  const OUT = ['....########....'.slice(0, 16), '', ''];
  void OUT;
  const path = (d: string, col: string) => {
    paint.setColor(Skia.Color(col));
    const p = Skia.Path.MakeFromSVGString(d);
    if (p) { p.transform(Skia.Matrix().translate(0, oy * s).scale(s, s)); c.drawPath(p, paint); }
  };
  path('M4 0h8v1h2v2h1v6h-1v2h-2v2h-2v3h-1v3h-1v2h-1v-2h-1v-3h-1v-3H5v-2H3V9H2V3h1V1h2z', INK);
  path('M5 1h6v1h2v2h1v4h-1v2h-2v2H8v3H7v-3H5v-2H3V4h1V2h1z', color);
  rect(c, paint, '#1c2233', 6, 5 + oy, 4, 4, s);
  rect(c, paint, '#f5f3ea', 7, 6 + oy, 2, 2, s);
}

/**
 * A map pin as ONE small PNG data URI, cached per (shape, rarity, count). With a count (2 or more) the pin gets a gold
 * pixel badge at its top-right corner, so a cluster is the very same icon you equipped, just with a number on it.
 */
export function pinBitmap(pinId: string, rarity: string, count = 1, scale = 3): PinBitmap | null {
  const key = `${pinId}|${rarity}|${count}|${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const label = count > 99 ? '99+' : String(count);
    const showBadge = count > 1;
    const textW = label.length * 4 - 1;
    const badgeW = showBadge ? textW + 4 : 0;
    const badgeH = showBadge ? 9 : 0;
    const W = PIN_W + Math.ceil(badgeW * 0.55);
    const oy = showBadge ? 4 : 0;
    const H = PIN_H + oy;
    const surface = Skia.Surface.MakeOffscreen(W * scale, H * scale);
    if (!surface) return null;
    const c = surface.getCanvas();
    const paint = Skia.Paint();
    drawBase(c, paint, pinId, rarity, oy, scale);
    if (showBadge) {
      const bx = W - badgeW;
      rect(c, paint, INK, bx, 0, badgeW, badgeH, scale);
      rect(c, paint, '#E8C547', bx + 1, 1, badgeW - 2, badgeH - 2, scale);
      let x = bx + 2;
      for (const ch of label) {
        const rows = DIGITS[ch];
        if (rows) rows.forEach((row, ry) => row.split('').forEach((v, rx) => { if (v === '#') rect(c, paint, INK, x + rx, 2 + ry, 1, 1, scale); }));
        x += 4;
      }
    }
    const b64 = surface.makeImageSnapshot().encodeToBase64();
    const out: PinBitmap = { uri: 'data:image/png;base64,' + b64, w: W, h: H, anchorX: 8 / W };
    cache.set(key, out);
    return out;
  } catch {
    return null;
  }
}
