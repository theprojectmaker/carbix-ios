import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

/* Small pixel-art icons for the seasonal shop, drawn on a 16x16 grid with simple shape helpers. */

const INK = '#141C27';
type Grid = (string | null)[][];
const blank = (): Grid => Array.from({ length: 16 }, () => Array<string | null>(16).fill(null));

const px = (g: Grid, x: number, y: number, c: string) => {
  if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c;
};
const rect = (g: Grid, x: number, y: number, w: number, h: number, c: string) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, c);
};
/** Filled ellipse with an ink outline. */
const ell = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string, outline = true) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) px(g, x, y, c);
      else if (outline && d <= 1.55) if (!g[y][x]) px(g, x, y, INK);
    }
  }
};
const outline = (g: Grid) => {
  const o = g.map((r) => r.slice());
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (g[y][x]) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== INK);
      if (n) o[y][x] = INK;
    }
  }
  return o;
};

function draw(kind: string): Grid {
  const g = blank();
  switch (kind) {
    case 'pumpkin':
      ell(g, 8, 9, 6, 5, '#E0863A', false);
      for (const x of [5, 8, 11]) for (let y = 5; y <= 13; y++) if (g[y][x]) px(g, x, y, '#B85F1F');
      rect(g, 7, 3, 2, 3, '#4F8F52');
      px(g, 9, 3, '#4F8F52');
      break;
    case 'apple':
      ell(g, 6, 9, 4, 4, '#D9532B', false);
      ell(g, 10, 9, 4, 4, '#D9532B', false);
      rect(g, 7, 3, 1, 3, '#5A3A1A');
      rect(g, 8, 3, 3, 2, '#4F8F52');
      px(g, 5, 7, '#F6A08F');
      break;
    case 'acorn':
      ell(g, 8, 10, 4, 4, '#C99A5B', false);
      rect(g, 4, 5, 8, 4, '#8B5A2B');
      rect(g, 7, 3, 2, 2, '#5A3A1A');
      px(g, 6, 6, '#B07A3E');
      break;
    case 'candycorn':
      for (let y = 3; y <= 13; y++) {
        const half = Math.round(((y - 2) / 11) * 5);
        const c = y < 7 ? '#F4F1E6' : y < 10 ? '#E0863A' : '#F2D36B';
        rect(g, 8 - half, y, half * 2 + 1, 1, c);
      }
      break;
    case 'ghost':
      ell(g, 8, 7, 5, 5, '#F4F1FF', false);
      rect(g, 3, 7, 10, 6, '#F4F1FF');
      for (const x of [3, 6, 9]) rect(g, x, 13, 2, 1, '#F4F1FF');
      rect(g, 5, 6, 2, 2, INK);
      rect(g, 9, 6, 2, 2, INK);
      rect(g, 7, 10, 2, 1, '#8C6FB5');
      break;
    case 'leaf':
      for (let i = 0; i < 9; i++) rect(g, 3 + i, 12 - i, 3, 1, '#D9532B');
      for (let i = 0; i < 6; i++) rect(g, 4 + i, 11 - i, 2, 1, '#E0863A');
      rect(g, 3, 13, 3, 1, '#5A3A1A');
      break;
    case 'palm':
      rect(g, 7, 7, 2, 7, '#8B5A2B');
      for (const [dx, dy] of [[-5, 1], [-3, -1], [3, -1], [5, 1], [0, -2]]) {
        for (let t = 0; t < 4; t++) rect(g, 8 + Math.round((dx * t) / 4), 6 + Math.round((dy * t) / 4) + (t > 2 ? 1 : 0), 2, 1, '#4F8F52');
      }
      break;
    case 'surfboard':
      ell(g, 8, 8, 3, 7, '#5FC7E0', false);
      rect(g, 7, 2, 2, 12, '#F4F1E6');
      break;
    case 'flame':
      ell(g, 8, 10, 4, 5, '#D9532B', false);
      ell(g, 8, 11, 2, 3, '#F2D36B', false);
      rect(g, 7, 3, 2, 4, '#E0863A');
      break;
    case 'moon':
      ell(g, 8, 8, 6, 6, '#FFF1A8', false);
      ell(g, 11, 6, 4, 4, '#2B1B3F', false);
      break;
    case 'star':
      rect(g, 7, 1, 2, 14, '#FFD84D');
      rect(g, 1, 7, 14, 2, '#FFD84D');
      for (let i = 0; i < 5; i++) {
        px(g, 3 + i, 3 + i, '#F2D36B'); px(g, 12 - i, 3 + i, '#F2D36B');
        px(g, 3 + i, 12 - i, '#F2D36B'); px(g, 12 - i, 12 - i, '#F2D36B');
      }
      break;
    case 'ring':
      ell(g, 8, 8, 6, 6, '#8C6FB5', false);
      ell(g, 8, 8, 3, 3, '#1B1F27', false);
      break;
    default: // classic pin
      ell(g, 8, 6, 4, 4, '#C9A227', false);
      rect(g, 7, 9, 2, 4, '#C9A227');
      rect(g, 7, 5, 2, 2, '#1c2233');
  }
  return outline(g);
}

const KIND: Record<string, string> = {
  classic: 'classic', 'map-marker-pumpkin': 'pumpkin', 'map-marker-apple': 'apple', 'map-marker-acorn': 'acorn',
  'map-marker-candycorn': 'candycorn', 'map-marker-ghost': 'ghost', 'map-marker-mapleleaf': 'leaf',
  'map-marker-palmtree': 'palm', 'map-marker-surfboard': 'surfboard',
  standard: 'ring', leaffall: 'leaf', embers: 'flame', ghostparade: 'ghost', harvestmoon: 'moon', starburst: 'star',
};

/** Icon for a shop item id (map pin or catch effect). */
export function ShopIcon({ id, size = 56 }: { id: string; size?: number }) {
  const grid = useMemo(() => draw(KIND[id] ?? 'classic'), [id]);
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {grid.flatMap((row, y) => row.map((c, x) => (c ? <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c} /> : null)))}
    </Svg>
  );
}

/** Season header icon: leaf for fall, sun for summer, snowflake for winter, sprout for spring. */
export function SeasonGlyph({ season, size = 40 }: { season: string; size?: number }) {
  const kind = season === 'fall' ? 'leaf' : season === 'summer' ? 'star' : season === 'winter' ? 'ring' : 'palm';
  return <ShopIcon id={kind === 'leaf' ? 'leaffall' : kind === 'star' ? 'starburst' : kind === 'ring' ? 'standard' : 'map-marker-palmtree'} size={size} />;
}
