import { FilterMode, MipmapMode, PaintStyle, Skia, type SkFont, type SkImage } from '@shopify/react-native-skia';

import { iconURL } from './api';
import type { CatalogEntry } from './types';

/**
 * BIX POSTER: your whole garage as one wall poster. Every caught sprite sits in a grid (shinies on a gold plate),
 * and every car still missing is one grey pixel in a mosaic underneath. Same layout as the web app's poster.
 */
export type PosterInput = {
  name: string;
  caught: CatalogEntry[]; // already sorted for display
  shinyN: Set<number>;
  catalog: CatalogEntry[];
  caughtN: Set<number>;
  pct: number;
  levelLine: string;
  dateLine: string;
  fontData: Uint8Array | null;
  onProgress?: (p: number) => void;
};

const COLS = 10, CW = 112, CH = 60, W = 48 * 2 + COLS * CW;

export async function renderPoster(inp: PosterInput): Promise<string> {
  const { caught, catalog, caughtN, shinyN } = inp;
  const missing = catalog.length - caughtN.size;
  const rowsN = Math.max(1, Math.ceil(caught.length / COLS));
  const per = Math.floor((W - 96) / 7);
  const MOS = Math.ceil(catalog.length / per);
  const H = 200 + rowsN * CH + 40 + MOS * 7 + 90;

  const surface = Skia.Surface.MakeOffscreen(W, H);
  if (!surface) throw new Error('could not create poster surface');
  const c = surface.getCanvas();
  const paint = Skia.Paint();
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(color));
    c.drawRect(Skia.XYWHRect(x, y, w, h), paint);
  };
  const stroke = (color: string, lw: number, x: number, y: number, w: number, h: number) => {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(lw);
    paint.setColor(Skia.Color(color));
    c.drawRect(Skia.XYWHRect(x, y, w, h), paint);
    paint.setStyle(PaintStyle.Fill);
  };

  const tf = inp.fontData ? Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(inp.fontData)) : null;
  const font = (size: number): SkFont => Skia.Font(tf ?? undefined, size);
  const text = (s: string, x: number, y: number, size: number, color: string, align: 'l' | 'r' | 'c' = 'l') => {
    const f = font(size);
    const w = f.measureText(s).width;
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(color));
    c.drawText(s, align === 'l' ? x : align === 'r' ? x - w : x - w / 2, y, paint, f);
  };

  fill('#141C27', 0, 0, W, H);
  fill('#F0EEE7', 10, 10, W - 20, H - 20);
  stroke('#141C27', 4, 18, 18, W - 36, H - 36);
  stroke('#C9A227', 2, 24, 24, W - 48, H - 48);
  for (let i = 0; i < Math.ceil((W - 36) / 12); i++) {
    fill(i % 2 ? '#F0EEE7' : '#141C27', 18 + i * 12, 18, 12, 7);
    fill(i % 2 ? '#141C27' : '#F0EEE7', 18 + i * 12, 25, 12, 7);
  }
  text('CARBIX', 48, 84, 30, '#D8402F');
  text(`${inp.name.toUpperCase().slice(0, 16)}'S BIX`, 48, 150, 64, '#141C27');
  text(`${caughtN.size} OF ${catalog.length.toLocaleString()} CAUGHT  -  ${inp.pct.toFixed(1)}%  -  ${shinyN.size} SHINY  -  ${inp.dateLine}`, 48, 176, 11, '#5C7AA0');

  // the grid, six sprites loading at a time
  const GX = 48, GY = 200;
  let done = 0;
  const drawOne = async (e: CatalogEntry, i: number) => {
    const cx = GX + (i % COLS) * CW, cy = GY + Math.floor(i / COLS) * CH;
    const shiny = shinyN.has(e.n);
    fill(shiny ? '#FFF3C4' : '#FFFFFF', cx + 2, cy + 2, CW - 4, CH - 4);
    stroke(shiny ? '#C9A227' : '#D9D6CC', 2, cx + 2, cy + 2, CW - 4, CH - 4);
    try {
      const data = await Skia.Data.fromURI(iconURL(e));
      const img: SkImage | null = Skia.Image.MakeImageFromEncoded(data);
      if (img) {
        const sc = Math.min((CW - 14) / img.width(), (CH - 22) / img.height());
        const dw = img.width() * sc, dh = img.height() * sc;
        c.drawImageRectOptions(
          img, Skia.XYWHRect(0, 0, img.width(), img.height()),
          Skia.XYWHRect(cx + (CW - dw) / 2, cy + 6 + (CH - 22 - dh) / 2, dw, dh),
          FilterMode.Nearest, MipmapMode.None, paint,
        );
      }
    } catch {
      /* a sprite that will not load is left blank rather than aborting the poster */
    }
    text(String(e.model).toUpperCase().slice(0, 18), cx + CW / 2, cy + CH - 8, 6, '#141C27', 'c');
    done++;
    if (inp.onProgress && done % 10 === 0) inp.onProgress(done / Math.max(1, caught.length));
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (next < caught.length) {
        const i = next++;
        await drawOne(caught[i], i);
      }
    }),
  );

  // the mosaic of everything still out there
  const MY = GY + rowsN * CH + 24;
  text(`STILL OUT THERE - ${missing.toLocaleString()} CARS YOU HAVEN'T CAUGHT (ONE PIXEL EACH)`, 48, MY, 8, '#8F7318');
  catalog.forEach((e, i) => {
    const mx = 48 + (i % per) * 7, my = MY + 16 + Math.floor(i / per) * 7;
    fill(caughtN.has(e.n) ? (shinyN.has(e.n) ? '#C9A227' : '#5FA89B') : '#D9D6CC', mx, my, 6, 6);
  });

  fill('#33465F', 18, H - 52, W - 36, 34);
  text('CARBIX', 34, H - 31, 9, '#F0EEE7');
  text(inp.levelLine, W - 34, H - 31, 9, '#F0EEE7', 'r');

  surface.flush();
  const img = surface.makeImageSnapshot();
  return img.encodeToBase64();
}
