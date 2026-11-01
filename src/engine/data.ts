import hidden from '../data/hidden.json';
import raw from '../data/catalogRaw.json';
import { buildCatalog, buildDisplayRank, catalogMatchIn, fixStatsWith } from './catalog';
import type { Car, CatalogEntry } from './types';

/** The bundled 4,652-car catalog (motorcycles, trailers and fleet chassis already filtered out). */
const ALL: CatalogEntry[] = buildCatalog(raw as string[], hidden as number[]);
export const CATALOG: CatalogEntry[] = ALL.filter((c) => c.rarity !== 'Grail');
/** The hidden tab: one-offs and tiny runs (15 or fewer built). Matched on scan, hidden from the grid until caught. */
export const GRAIL_CATALOG: CatalogEntry[] = ALL.filter((c) => c.rarity === 'Grail');
export const GRAIL_NS = new Set(GRAIL_CATALOG.map((c) => c.n));
export const CATALOG_BY_N = new Map(ALL.map((c) => [c.n, c]));
export const DISPLAY_RANK = buildDisplayRank(CATALOG);
export const dexRank = (n: number) => DISPLAY_RANK.get(n) || n;
export const catalogMatch = (car: Pick<Car, 'make' | 'model'>) => catalogMatchIn(ALL, car);
export const fixStats = (car: Car) => fixStatsWith(ALL, car);

/** Average power and top speed per body class, for "vs class" bars on the car page. */
export const CLASS_STATS = (() => {
  const acc: Record<string, { hp: number; hpN: number; top: number; topN: number }> = {};
  for (const c of CATALOG) {
    const a = (acc[c.cls] = acc[c.cls] || { hp: 0, hpN: 0, top: 0, topN: 0 });
    if (c.hp) { a.hp += c.hp; a.hpN++; }
    if (c.top) { a.top += c.top; a.topN++; }
  }
  const out: Record<string, { hp: number; top: number }> = {};
  for (const [k, a] of Object.entries(acc)) out[k] = { hp: a.hpN ? a.hp / a.hpN : 0, top: a.topN ? a.top / a.topN : 0 };
  return out;
})();

/** Cars of the same body class with similar power, closest first. */
export function similarCars(e: CatalogEntry, n = 12): CatalogEntry[] {
  if (!e.hp) return [];
  const hp = e.hp;
  return CATALOG.filter((c) => c.n !== e.n && c.cls === e.cls && c.hp && Math.abs(c.hp - hp) <= hp * 0.2)
    .sort((a, b) => Math.abs((a.hp ?? 0) - hp) - Math.abs((b.hp ?? 0) - hp))
    .slice(0, n);
}
