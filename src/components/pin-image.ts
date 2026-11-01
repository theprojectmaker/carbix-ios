import { Skia } from '@shopify/react-native-skia';

import { PIN_H, PIN_W, RARITY_HEX, renderPin, shapeForPinId } from '@/engine/pin-art';

const cache = new Map<string, string>();

/**
 * A map pin as a small PNG data URI, drawn once per (shape, rarity) and cached. The Map puts hundreds of these on
 * screen; one bitmap per marker is cheap where a view of 150 SVG rectangles per marker froze the whole app.
 */
export function pinImageURI(pinId: string, rarity: string, scale = 3): string | null {
  const shape = shapeForPinId(pinId);
  if (!shape) return null;
  const key = `${pinId}|${rarity}|${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const surface = Skia.Surface.MakeOffscreen(PIN_W * scale, PIN_H * scale);
    if (!surface) return null;
    const c = surface.getCanvas();
    const paint = Skia.Paint();
    for (const p of renderPin(shape, RARITY_HEX[rarity.toLowerCase()] || '#B3A98D')) {
      paint.setColor(Skia.Color(p.c));
      c.drawRect(Skia.XYWHRect(p.x * scale, p.y * scale, scale, scale), paint);
    }
    const b64 = surface.makeImageSnapshot().encodeToBase64();
    const uri = 'data:image/png;base64,' + b64;
    cache.set(key, uri);
    return uri;
  } catch {
    return null;
  }
}

/** The classic teardrop in a rarity colour, same idea. */
export function classicPinURI(color: string, scale = 3): string | null {
  const key = `classic|${color}|${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const surface = Skia.Surface.MakeOffscreen(16 * scale, 21 * scale);
    if (!surface) return null;
    const c = surface.getCanvas();
    const paint = Skia.Paint();
    const path = (d: string, col: string) => { paint.setColor(Skia.Color(col)); const p = Skia.Path.MakeFromSVGString(d); if (p) { p.transform(Skia.Matrix().scale(scale, scale)); c.drawPath(p, paint); } };
    path('M4 0h8v1h2v2h1v6h-1v2h-2v2h-2v3h-1v3h-1v2h-1v-2h-1v-3h-1v-3H5v-2H3V9H2V3h1V1h2z', '#141C27');
    path('M5 1h6v1h2v2h1v4h-1v2h-2v2H8v3H7v-3H5v-2H3V4h1V2h1z', color);
    paint.setColor(Skia.Color('#1c2233')); c.drawRect(Skia.XYWHRect(6 * scale, 5 * scale, 4 * scale, 4 * scale), paint);
    paint.setColor(Skia.Color('#f5f3ea')); c.drawRect(Skia.XYWHRect(7 * scale, 6 * scale, 2 * scale, 2 * scale), paint);
    const uri = 'data:image/png;base64,' + surface.makeImageSnapshot().encodeToBase64();
    cache.set(key, uri);
    return uri;
  } catch {
    return null;
  }
}
