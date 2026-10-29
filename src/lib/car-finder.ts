import { requireOptionalNativeModule } from 'expo-modules-core';

/** A box as fractions of the image: x, y from the top-left corner, then width and height. */
export type Box = { x: number; y: number; w: number; h: number };

type Native = { salientBox: (path: string) => Promise<(Box & { confidence: number }) | null> };
let native: Native | null | undefined;

/**
 * Where the car is, found on the phone in a few milliseconds (Apple Vision saliency, see modules/car-finder).
 * Returns null in Expo Go, on Android, or when nothing in the picture stands out. Boxes that cover almost the
 * whole frame or almost nothing are not useful and come back null too.
 */
export async function findCar(uri: string): Promise<Box | null> {
  if (native === undefined) {
    try {
      native = requireOptionalNativeModule<Native>('CarFinder');
    } catch {
      native = null;
    }
  }
  if (!native) return null;
  try {
    const b = await native.salientBox(uri);
    if (!b) return null;
    const area = b.w * b.h;
    if (!(area > 0.04 && area < 0.92) || b.confidence < 0.1) return null;
    return { x: clamp01(b.x), y: clamp01(b.y), w: Math.min(b.w, 1 - clamp01(b.x)), h: Math.min(b.h, 1 - clamp01(b.y)) };
  } catch {
    return null;
  }
}

/** The box grown by `pad` on each side (as a fraction of its own size), kept inside the image. */
export function padBox(b: Box, pad: number): Box {
  const x = Math.max(0, b.x - b.w * pad);
  const y = Math.max(0, b.y - b.h * pad);
  const x2 = Math.min(1, b.x + b.w * (1 + pad));
  const y2 = Math.min(1, b.y + b.h * (1 + pad));
  return { x, y, w: x2 - x, h: y2 - y };
}

/** A box given relative to a crop, expressed relative to the full image the crop came from. */
export function uncrop(inner: Box, crop: Box): Box {
  return { x: crop.x + inner.x * crop.w, y: crop.y + inner.y * crop.h, w: inner.w * crop.w, h: inner.h * crop.h };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
