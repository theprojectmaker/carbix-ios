import type { Car, CatalogEntry, Rarity } from './types';
import { RTIER, STAT_BOUNDS } from './xp';

const RMAP: Record<string, Rarity> = {
  C: 'Common', U: 'Uncommon', R: 'Rare', E: 'Epic', L: 'Legendary', M: 'Mythic',
};

const MOTO_MAKES = new Set([
  'Harley-Davidson', 'Ducati', 'KTM', 'Aprilia', 'Triumph', 'Royal Enfield', 'Indian', 'Husqvarna',
  'Moto Guzzi', 'MV Agusta', 'Buell', 'Vespa', 'Piaggio', 'Zero', 'Benelli', 'Bimota', 'Norton',
  'Victory', 'Ural', 'CFMOTO', 'SSR', 'Boss Hoss', 'Confederate', 'Janus', 'Lance', 'Kymco', 'SYM',
  'Bajaj', 'Polaris', 'Kawasaki', 'Yamaha', 'Can-Am', 'Arctic Cat', 'Ski-Doo', 'Sea-Doo', 'Gas Gas', 'Beta',
]);
const MOTO_ENG = /\d{2,4}\s*cc|v-?twin|parallel twin|boxer twin|flat[- ]twin|2-stroke/i;
const MOTO_ODD = new Set(['Suzuki|Madura']);

type Cat = Pick<CatalogEntry, 'make' | 'model' | 'eng'>;
const isMoto = (c: Cat) =>
  MOTO_MAKES.has(c.make) ||
  MOTO_ODD.has(`${c.make}|${c.model}`) ||
  (MOTO_ENG.test(c.eng || '') && c.make !== 'Morgan');
const isNotCar = (c: Cat) => /^None\b/i.test(c.eng || '');

/** Same normalisation as the web app, so catches match the same catalog rows. */
export const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export function buildCatalog(raw: string[], hidden: number[]): CatalogEntry[] {
  const hide = new Set(hidden);
  return raw
    .map((s, i): CatalogEntry => {
      const [make, model, cls, r, years, low, high, hp, top, zts, eng] = s.split('|');
      return {
        n: i + 1, make, model, cls, rarity: RMAP[r], years: years || null,
        low: +low || null, high: +high || null, hp: +hp || null, top: +top || null,
        zts: zts || null, eng: eng || null,
      };
    })
    .filter((c) => !hide.has(c.n) && !isMoto(c) && !isNotCar(c));
}

const POPULAR_MAKES = [
  'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Hyundai', 'Kia', 'Volkswagen', 'Subaru', 'Mazda',
  'Jeep', 'Ram', 'GMC', 'BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Dodge', 'Chrysler', 'Buick', 'Acura',
  'Volvo', 'Mitsubishi', 'Cadillac',
];
const RTIER_LOCAL: Record<string, number> = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5 };
/** Low score = more popular (drives which car is "the people's car" / "the unicorn"). */
export const popularityScore = (c: Pick<CatalogEntry, 'make' | 'rarity'>) => {
  const mk = POPULAR_MAKES.indexOf(c.make);
  return (mk >= 0 ? mk : 99) * 10 + (RTIER_LOCAL[c.rarity] ?? 3);
};

const COMMERCIAL_MAKES = new Set([
  'Freightliner', 'Kenworth', 'Peterbilt', 'Mack', 'Western Star', 'Autocar', 'Oshkosh', 'International',
  'Hino', 'Blue Bird', 'Nikola', 'Eagle', 'Isuzu', 'Bollinger', 'Canoo', 'Lordstown', 'BYD', 'Vanderhall',
]);
const KNOWN_MAKES = new Set([
  'Tesla', 'Porsche', 'Lincoln', 'Mini', 'Land Rover', 'Genesis', 'Infiniti', 'Fiat', 'Alfa Romeo', 'Suzuki',
  'Saturn', 'Pontiac', 'Oldsmobile', 'Plymouth', 'Mercury', 'Saab', 'Jaguar', 'Mitsubishi', 'Rivian',
  'Polestar', 'Smart', 'Scion', 'Geo', 'Daewoo', 'Datsun', 'Peugeot', 'Renault', 'Opel', 'Citroen',
  'Holden', 'Maserati',
]);
const CLASS_PENALTY: Record<string, number> = {
  CLASSIC: 900, HYPER: 700, SUPER: 600, MUSCLE: 140, LUXURY: 120, VAN: 60, OFFROAD: 40, TRUCK: 30,
  SPORT: 20, SEDAN: 0, SUV: 0, HATCH: 0,
};
const VAN_MODEL = /^E-[1-5]\d0$|econoline|transit|savana|promaster|sprinter|city express|astro|\bnv\s?\d|cargo/i;
const FLEET_WORDS =
  /\b(chassis|cutaway|incomplete|stripped|conventional|forward control|walk-in|low speed vehicle|medium duty|heavy duty|ton)\b/i;
const FLEET_CODE = /^\d{3,5}[A-Z]{0,2}$/;

export function everydayScore(c: CatalogEntry, now = new Date().getFullYear()): number {
  const yrs = String(c.years || '');
  const start = parseInt((yrs.match(/\b(1[89]\d\d|20\d\d)\b/) || [])[1]) || 1990;
  const end = /present|current/i.test(yrs)
    ? now
    : parseInt((yrs.match(/-\s*(1[89]\d\d|20\d\d)/) || [])[1]) || start;
  let s = 0;
  s += Math.max(0, now - end) * 11;
  if (start < 1980 && end < now) s += (1980 - start) * 7;
  s += COMMERCIAL_MAKES.has(c.make)
    ? 2600
    : POPULAR_MAKES.includes(c.make)
      ? POPULAR_MAKES.indexOf(c.make) * 7
      : KNOWN_MAKES.has(c.make)
        ? 260
        : 900;
  s += (RTIER[c.rarity] ?? 3) * 130;
  s += CLASS_PENALTY[c.cls] ?? 60;
  if (FLEET_WORDS.test(c.model)) s += 3000;
  else if (FLEET_CODE.test(c.model)) s += 500;
  if (VAN_MODEL.test(c.model)) s += 420;
  return s;
}

/** #1 is the most everyday car; de-clumped so one brand can't hold a long run. The id `n` never changes. */
export function buildDisplayRank(catalog: CatalogEntry[], now?: number): Map<number, number> {
  const sorted = [...catalog].sort((a, b) => everydayScore(a, now) - everydayScore(b, now) || a.n - b.n);
  const out: CatalogEntry[] = [];
  const hold = new Map<string, CatalogEntry[]>();
  const MAXRUN = 2;
  let lastMake = '';
  let run = 0;
  const take = (c: CatalogEntry) => {
    if (c.make === lastMake) run++;
    else {
      lastMake = c.make;
      run = 1;
    }
    out.push(c);
  };
  for (const c of sorted) {
    if (c.make === lastMake && run >= MAXRUN) {
      if (!hold.has(c.make)) hold.set(c.make, []);
      hold.get(c.make)!.push(c);
      continue;
    }
    take(c);
    for (const [mk, q] of [...hold]) {
      if (!q.length || (mk === lastMake && run >= MAXRUN)) continue;
      take(q.shift()!);
      if (!q.length) hold.delete(mk);
    }
  }
  for (const q of hold.values()) for (const c of q) out.push(c);
  const rank = new Map<number, number>();
  out.forEach((c, i) => rank.set(c.n, i + 1));
  return rank;
}

export function catalogMatchIn(catalog: CatalogEntry[], car: Pick<Car, 'make' | 'model'>): CatalogEntry | null {
  const m = norm(car.make);
  const mo = norm(car.model);
  let best: CatalogEntry | null = null;
  let bestLen = 0;
  for (const c of catalog) {
    const cm0 = norm(c.make);
    if (!(cm0.includes(m) || m.includes(cm0))) continue;
    const cm = norm(c.model);
    if (cm === mo) return c;
    if ((mo.includes(cm) || cm.includes(mo)) && cm.length > bestLen) {
      best = c;
      bestLen = cm.length;
    }
  }
  return best;
}

/** Drops implausible numbers, then lets the researched catalog win on the fields it knows. */
export function fixStatsWith(catalog: CatalogEntry[], car: Car): Car {
  for (const k of Object.keys(STAT_BOUNDS)) {
    const [lo, hi] = STAT_BOUNDS[k];
    const n = Number(car[k]);
    car[k] = Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : 0;
  }
  const z = parseFloat(String(car.zeroToSixty));
  if (!Number.isFinite(z) || z < 1.5 || z > 30) car.zeroToSixty = '';
  const e = catalogMatchIn(catalog, car);
  if (e) {
    if (e.hp) car.horsepower = e.hp;
    if (e.top) car.topSpeedMph = e.top;
    if (e.zts) car.zeroToSixty = e.zts;
    if (e.eng && !car.engine) car.engine = e.eng;
    if (e.years && !car.yearRange) car.yearRange = e.years;
    if (e.rarity) car.rarity = e.rarity;
  }
  car.powerToWeight = car.horsepower && car.weightLbs ? (car.horsepower / car.weightLbs).toFixed(3) : '';
  return car;
}
