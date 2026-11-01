import { norm } from './catalog';
import { dateKeyET, streak as streakOf } from './store';
import type { Catch, Profile } from './types';
import { RTIER } from './xp';

/* Season quest ladder, ported 1:1 from the web app. Everything is a pure function of (garage, profile, now):
   progress is recomputed from the garage every time and only the integer cursor profile.questStep is stored. */

export type SeasonName = 'winter' | 'spring' | 'summer' | 'fall';
export const SEASON_EVENT_NAMES: Record<SeasonName, string> = {
  summer: 'SUNSET CIRCUIT', fall: 'HARVEST HIGHWAY', winter: 'FROSTLINE', spring: 'BLOOM RUN',
};

export type Season = { key: string; name: string; start: number; end: number; idx: number; event: SeasonName; next: SeasonName };

/* Real seasons, on the calendar people live by (Eastern Time): winter starts Dec 21 and ends when spring starts
   on Mar 20; summer starts Jun 21; fall Sep 22. Keys stay `YYYYQn` so everything already saved (quest cursors,
   icon packs, leaderboards) keeps its meaning: the winter that starts Dec 21 2026 is "2027Q1", shown as WINTER '26. */
const SEASON_NAMES = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
export function currentSeason(now = new Date()): Season {
  const d = dateKeyET(now);
  const yr = Number(d.slice(0, 4)), mo = Number(d.slice(5, 7)), day = Number(d.slice(8, 10));
  const onOrAfter = (m: number, dd: number) => mo > m || (mo === m && day >= dd);
  let q: number, keyYear = yr, label = yr, start: Date, end: Date;
  if (onOrAfter(12, 21)) { q = 0; keyYear = yr + 1; start = new Date(yr, 11, 21); end = new Date(yr + 1, 2, 20); }
  else if (onOrAfter(9, 22)) { q = 3; start = new Date(yr, 8, 22); end = new Date(yr, 11, 21); }
  else if (onOrAfter(6, 21)) { q = 2; start = new Date(yr, 5, 21); end = new Date(yr, 8, 22); }
  else if (onOrAfter(3, 20)) { q = 1; start = new Date(yr, 2, 20); end = new Date(yr, 5, 21); }
  else { q = 0; label = yr - 1; start = new Date(yr - 1, 11, 21); end = new Date(yr, 2, 20); }
  return {
    key: `${keyYear}Q${q + 1}`, name: `${SEASON_NAMES[q]} '${String(label).slice(2)}`,
    start: start.getTime(), end: end.getTime(), idx: q,
    event: SEASON_NAMES[q].toLowerCase() as SeasonName, next: SEASON_NAMES[(q + 1) % 4].toLowerCase() as SeasonName,
  };
}
/** Whole days until the next season starts. */
export const daysUntilNext = (s: Season, now = Date.now()) => Math.max(0, Math.ceil((s.end - now) / 864e5));

const SEASON_COLORS = [['Silver', 'White', 'Black', 'Grey'], ['Green', 'Yellow', 'White', 'Blue'], ['Green', 'Blue', 'Red', 'Yellow'], ['Orange', 'Brown', 'Red', 'Black']];
const SEASON_BRANDS = [['Toyota', 'Subaru', 'Volkswagen', 'Jeep'], ['Mazda', 'Honda', 'Hyundai', 'Kia'], ['BMW', 'Mercedes-Benz', 'Audi', 'Nissan'], ['Ford', 'Chevrolet', 'Dodge', 'Nissan']];

export type Chapter = { key: string; name: string; accent: string; from: number; to: number; desc: string };
export const SUMMER_CHAPTERS: Chapter[] = [
  { key: 'beach', name: 'BEACH BOUND', accent: '#5FA89B', from: 0, to: 12, desc: "Warm up the season at the water's edge — easy colors, easy brands, first Orbs in your pocket." },
  { key: 'road', name: 'ROAD TRIP', accent: '#E0863A', from: 13, to: 25, desc: 'Push out past the boardwalk — more brands, more countries, the ladder starts asking more of you.' },
  { key: 'golden', name: 'GOLDEN HOUR', accent: '#C9A227', from: 26, to: 37, desc: 'The light gets long and the rarities get real — Epic, Legendary, and the cars that make a season.' },
  { key: 'midnight', name: 'MIDNIGHT CRUISE', accent: '#8C6FB5', from: 38, to: 49, desc: 'The last stretch, lit by neon — one final sprint to the Sunset Circuit finale.' },
];
export const FALL_CHAPTERS: Chapter[] = [
  { key: 'leaves', name: 'FIRST LEAVES', accent: '#C0713A', from: 0, to: 12, desc: 'The leaves turn and the season opens — easy colors, easy brands, first Orbs in your pocket.' },
  { key: 'pumpkin', name: 'PUMPKIN RUN', accent: '#E0863A', from: 13, to: 25, desc: 'Hayrides, pumpkin patches and back roads — more brands, more countries, the ladder starts asking more.' },
  { key: 'moon', name: 'HARVEST MOON', accent: '#C9A227', from: 26, to: 37, desc: 'Long shadows and a big orange moon — Epic, Legendary, and the cars that make a season.' },
  { key: 'frost', name: 'FIRST FROST', accent: '#6FA3C8', from: 38, to: 49, desc: 'Cold mornings, clear skies — one last sprint to the Harvest Highway finale.' },
];
export const WINTER_CHAPTERS: Chapter[] = [
  { key: 'snowfall', name: 'FIRST SNOW', accent: '#9FC3E0', from: 0, to: 12, desc: 'The first flakes fall and the season opens — easy colors, easy brands, first Orbs in your pocket.' },
  { key: 'icebound', name: 'ICE ROAD', accent: '#6FA3C8', from: 13, to: 25, desc: 'Salt-white roads and frosted windshields — more brands, more countries, the ladder starts asking more.' },
  { key: 'aurora', name: 'AURORA NIGHTS', accent: '#8C6FB5', from: 26, to: 37, desc: 'Long nights and bright skies — Epic, Legendary, and the cars that make a season.' },
  { key: 'thaw', name: 'THE THAW', accent: '#5FA89B', from: 38, to: 49, desc: 'The ice cracks and the days get longer — one last sprint to the Frostline finale.' },
];
export const SPRING_CHAPTERS: Chapter[] = [
  { key: 'sprout', name: 'FIRST SPROUT', accent: '#7CB65B', from: 0, to: 12, desc: 'Green comes back and the season opens — easy colors, easy brands, first Orbs in your pocket.' },
  { key: 'bloom', name: 'FULL BLOOM', accent: '#E58CB5', from: 13, to: 25, desc: 'Blossoms on every street — more brands, more countries, the ladder starts asking more.' },
  { key: 'rain', name: 'APRIL SHOWERS', accent: '#5C9ED6', from: 26, to: 37, desc: 'Wet roads and bright reflections — Epic, Legendary, and the cars that make a season.' },
  { key: 'meadow', name: 'OPEN MEADOW', accent: '#C9A227', from: 38, to: 49, desc: 'Long evenings and open windows — one last sprint to the Bloom Run finale.' },
];
export const chaptersFor = (ev: SeasonName) => (ev === 'fall' ? FALL_CHAPTERS : ev === 'winter' ? WINTER_CHAPTERS : ev === 'spring' ? SPRING_CHAPTERS : SUMMER_CHAPTERS);
/** What finishing each chapter hands you, in plain words, for the quest screen. */
export const CHAPTER_REWARDS: Record<string, string> = {
  leaves: 'ACORN MAP PIN', pumpkin: 'PUMPKIN MAP PIN + HAYRIDE HERO TITLE', moon: 'EMBERS CATCH EFFECT + HARVEST GRADIENT', frost: 'GHOST MAP PIN + HARVEST MOON EFFECT + HARVEST HIGHWAY FRAME',
  beach: 'BEACH BALL PIN (COMING SOON)', road: 'ROAD ATLAS + ROAD TRIPPER TITLE', golden: 'SUNSET GRADIENT', midnight: 'SUNSET CIRCUIT FRAME',
  snowfall: 'SNOWFLAKE MAP PIN', icebound: 'MITTEN MAP PIN + ICE ROAD TRUCKER TITLE', aurora: 'SNOWFALL CATCH EFFECT + AURORA GRADIENT', thaw: 'SNOWMAN MAP PIN + AURORA EFFECT + FROSTLINE FRAME',
  sprout: 'TULIP MAP PIN', bloom: 'BUTTERFLY MAP PIN + BLOOM RUNNER TITLE', rain: 'PETAL DRIFT EFFECT + BLOOM GRADIENT', meadow: 'BEE MAP PIN + RAINBOW EFFECT + BLOOM RUN FRAME',
};

/* ---------- colour families ---------- */
const COLOR_FAMILY_KEYWORDS: Record<string, string[]> = {
  Red: ['red', 'rosso', 'rouge', 'rot', 'crimson', 'scarlet', 'burgundy', 'maroon', 'cherry', 'ruby', 'wine', 'merlot', 'cardinal'],
  Orange: ['orange', 'arancio', 'tangerine', 'papaya', 'mango', 'apricot', 'pumpkin'],
  Yellow: ['yellow', 'giallo', 'jaune', 'gelb', 'gold', 'champagne', 'amber', 'mustard', 'lemon', 'canary'],
  Green: ['green', 'verde', 'vert', 'grün', 'gruen', 'lime', 'olive', 'mint', 'emerald', 'teal', 'sage', 'forest'],
  Blue: ['blue', 'blu', 'azzurro', 'bleu', 'blau', 'navy', 'cobalt', 'turquoise', 'cyan', 'indigo', 'sapphire', 'aqua'],
  Brown: ['brown', 'marrone', 'braun', 'tan', 'beige', 'bronze', 'copper', 'sand', 'khaki', 'mocha', 'coffee', 'sienna', 'umber', 'rust', 'chocolate', 'taupe'],
  Black: ['black', 'nero', 'noir', 'schwarz', 'onyx', 'obsidian', 'jet'],
  White: ['white', 'bianco', 'blanc', 'weiss', 'weiß', 'pearl', 'cream', 'ivory'],
  Grey: ['grey', 'gray', 'grigio', 'gris', 'grau', 'gunmetal', 'charcoal', 'graphite', 'slate', 'nardo', 'titanium'],
  Silver: ['silver', 'argento', 'argent', 'chrome', 'platinum', 'steel'],
  Purple: ['purple', 'viola', 'violet', 'lilac', 'lavender', 'plum', 'amethyst'],
  Pink: ['pink', 'rosa', 'magenta', 'fuchsia', 'rose'],
};

function hexToHSL(hex: unknown) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function hueFamily({ h, s, l }: { h: number; s: number; l: number }): string | null {
  if (l > 0.92) return 'White';
  if (l < 0.12) return 'Black';
  if (s < 0.18) return l > 0.55 ? 'Silver' : 'Grey';
  if (h < 12 || h >= 345) return 'Red';
  if (h < 50) {
    // the warm band: tan, copper, sienna, sand and most browns live here too, so only a vivid, mid-light paint is Orange
    const vivid = s >= 0.6 && l >= 0.38 && l <= 0.72;
    if (h < 18) return vivid ? 'Red' : 'Brown';
    return vivid ? 'Orange' : 'Brown';
  }
  if (h < 70) return 'Yellow';
  if (h < 190) return 'Green';
  if (h < 260) return 'Blue';
  if (h < 320) return 'Purple';
  if (h < 345) return l > 0.6 ? 'Pink' : 'Purple';
  return null;
}

type AnyCar = Catch['car'];
export function carColorFamily(car: AnyCar | undefined): string | null {
  // whole words only: "Tangerine" is not "tan", "Titanium" is not "tan", "Rosso" is not "rose"
  const words = String((car && car.color) || '').toLowerCase().split(/[^a-z\u00c0-\u024f]+/);
  for (const fam in COLOR_FAMILY_KEYWORDS) if (COLOR_FAMILY_KEYWORDS[fam].some((kw) => words.includes(kw))) return fam;
  if (car && car.colorHex === '#8a92a8') return null;
  const hsl = hexToHSL(car && car.colorHex);
  return hsl ? hueFamily(hsl) : null;
}
export const colorMatchesFamily = (car: AnyCar, family: string) => !!family && carColorFamily(car) === family;

/* ---------- "since this quest started" helpers ---------- */
const REGION_RX: Record<string, RegExp> = {
  Asian: /JAPAN|KOREA|CHINA|INDIA/i,
  European: /GERMAN|ITALY|FRANCE|BRITAIN|ENGLAND|KINGDOM|SWEDEN|CZECH|SPAIN/i,
  American: /USA|AMERICA|UNITED STATES/i,
};

export type Progress = { have: number; need: number; timerFrom?: number | null; windowMs?: number };

export type Quest = {
  t: string; desc?: string; xp: number; orbs: number; badge?: boolean; cat: string; kind: string;
  n?: number; hrs?: number; tier?: string; cidx?: number; bidx?: number; timerMs?: number; altDesc?: string;
  /** For count quests: the catch rule, so the screen can list the cars that counted. */
  pred?: (g: Catch) => unknown;
  exclusive?: { track: string; tier: string };
  chapterMilestone?: { chapterKey: string; label: string; grant: GrantFn };
  test: (startTs: number) => Progress;
};
export type GrantFn = (p: Profile) => void;

export function questHelpers(garage: Catch[], profile: Pick<Profile, 'days'>, now: Date) {
  const since = (s: number) => garage.filter((g) => g.ts >= s);
  const sinceCount = (s: number, pred: (g: Catch) => unknown) => garage.filter((g) => g.ts >= s && pred(g)).length;
  const hasDupSince = (s: number) => {
    const seen = new Set<string>();
    for (const g of garage) {
      if (g.ts < s) continue;
      const k = norm(g.car.make + g.car.model);
      if (seen.has(k)) return true;
      seen.add(k);
    }
    return false;
  };
  const brandsSince = (s: number) => new Set(since(s).map((g) => g.car.make)).size;
  const bestRaritySince = (s: number) => since(s).reduce((m, g) => Math.max(m, RTIER[g.car.rarity] ?? -1), -1);
  const timedCount = (s: number, windowMs: number, need: number, pred: (g: Catch) => unknown): Progress => {
    const hits = garage.filter((g) => g.ts >= s && pred(g)).sort((a, b) => a.ts - b.ts);
    if (!hits.length) return { have: 0, need, timerFrom: null };
    let anchor = hits[0].ts, run = 1, best = 1;
    for (let i = 1; i < hits.length; i++) {
      if (hits[i].ts - anchor <= windowMs) { run++; best = Math.max(best, run); } else { anchor = hits[i].ts; run = 1; }
    }
    const last = hits[hits.length - 1];
    return { have: Math.min(best, need), need, timerFrom: best < need ? last.ts : null, windowMs };
  };
  const countriesSince = (s: number) => new Set(since(s).map((g) => String(g.car.country || '').toUpperCase()).filter(Boolean)).size;
  const distinctColorsSince = (s: number) => new Set(since(s).map((g) => carColorFamily(g.car)).filter(Boolean)).size;
  const daysSpanSince = (s: number, needCatches: number, needDays: number) => {
    const hits = since(s);
    return hits.length >= needCatches && new Set(hits.map((g) => dateKeyET(new Date(g.ts)))).size >= needDays;
  };
  const sameMakeDiffModelSince = (s: number) => {
    const byMake: Record<string, Set<string>> = {};
    for (const g of since(s)) (byMake[g.car.make] = byMake[g.car.make] || new Set()).add(norm(g.car.model));
    return Object.values(byMake).some((x) => x.size >= 2);
  };
  const regionsSince = (s: number) => {
    const found = new Set<string>();
    for (const g of since(s)) for (const r in REGION_RX) if (REGION_RX[r].test(String(g.car.country || ''))) found.add(r);
    return found.size;
  };
  const isElectrifiedSince = (s: number) =>
    sinceCount(s, (g) => /electric|hybrid|\bev\b|dual motor|single motor/i.test(g.car.engine || '')) > 0;
  const streak = () => streakOf(profile, now);
  return {
    since, sinceCount, hasDupSince, brandsSince, bestRaritySince, timedCount, countriesSince, distinctColorsSince,
    daysSpanSince, sameMakeDiffModelSince, regionsSince, isElectrifiedSince, streak,
  };
}

type Overrides = Record<string, { kind: string; value?: number }>;

export function buildQuests(
  garage: Catch[],
  profile: Pick<Profile, 'days' | 'questOverrides'> & { questStarts?: Record<number, number> },
  season: Season,
  now = new Date(),
): Quest[] {
  const h = questHelpers(garage, profile, now);
  const C = SEASON_COLORS[season.idx], B = SEASON_BRANDS[season.idx];
  const colorQ = (n: number, c: string, xp: number, orbs: number, badge?: boolean): Quest => ({
    t: `CATCH ${n} ${c.toUpperCase()} CARS`, xp, orbs, badge, cat: 'color', kind: 'color', n, cidx: C.indexOf(c), pred: (g) => colorMatchesFamily(g.car, c),
    test: (s) => ({ have: h.sinceCount(s, (g) => colorMatchesFamily(g.car, c)), need: n }),
  });
  const brandQ = (n: number, b: string, xp: number, orbs: number, badge?: boolean): Quest => ({
    t: `CATCH ${n} ${b.toUpperCase()}${n > 1 ? 'S' : ''}`, xp, orbs, badge, cat: 'brand', kind: 'singleBrand', n, bidx: B.indexOf(b), pred: (g) => g.car.make === b,
    test: (s) => ({ have: h.sinceCount(s, (g) => g.car.make === b), need: n }),
  });
  const timerQ = (n: number, hrs: number, b: string, xp: number, orbs: number): Quest => ({
    t: `CATCH ${n} ${b.toUpperCase()}S WITHIN ${hrs}H OF EACH OTHER`, xp, orbs, cat: 'timer', kind: 'timer', n, hrs,
    bidx: B.indexOf(b), timerMs: hrs * 3600000, test: (s) => h.timedCount(s, hrs * 3600000, n, (g) => g.car.make === b),
  });
  const rarityQ = (tier: string, xp: number, orbs: number, badge?: boolean): Quest => ({
    t: tier.toUpperCase() + (tier === 'Mythic' || tier === 'Legendary' ? ' — CATCH ONE' : ' OR BETTER'), xp, orbs, badge,
    cat: 'rarity', kind: 'rarity', tier,
    test: (s) => ({ have: h.bestRaritySince(s) >= RTIER[tier as keyof typeof RTIER] ? 1 : 0, need: 1 }),
  });
  const volumeQ = (n: number, xp: number, orbs: number, badge?: boolean): Quest => ({
    t: `CATCH ${n} CARS THIS QUEST`, xp, orbs, badge, cat: 'volume', kind: 'volume', pred: () => true,
    test: (s) => ({ have: h.sinceCount(s, () => true), need: n }),
  });
  const brandsQ = (n: number, xp: number, orbs: number, badge?: boolean): Quest => ({
    t: `${n} DIFFERENT BRANDS THIS QUEST`, xp, orbs, badge, cat: 'brand', kind: 'brandCount',
    test: (s) => ({ have: h.brandsSince(s), need: n }),
  });
  const streakQ = (n: number, xp: number, orbs: number): Quest => ({
    t: `REACH A ${n}-DAY STREAK`, xp, orbs, cat: 'streak', kind: 'streak', test: () => ({ have: h.streak(), need: n }),
  });
  const specialQ = (t: string, xp: number, orbs: number, badge: boolean, pred: (g: Catch) => unknown): Quest => ({
    t, xp, orbs, badge, cat: 'special', kind: 'special', test: (s) => ({ have: h.sinceCount(s, pred) > 0 ? 1 : 0, need: 1 }),
  });
  const dupQ = (xp: number, orbs: number, badge?: boolean): Quest => ({
    t: 'CATCH A DUPLICATE MODEL', xp, orbs, badge, cat: 'special', kind: 'dup', test: (s) => ({ have: h.hasDupSince(s) ? 1 : 0, need: 1 }),
  });
  const classQ = (n: number, label: string, rx: RegExp, xp: number, orbs: number, badge?: boolean): Quest => ({
    t: `CATCH ${n} ${label.toUpperCase()}${n > 1 ? 'S' : ''}`, xp, orbs, badge, cat: 'class', kind: 'bodyClass', pred: (g) => rx.test(g.car.class || ''),
    test: (s) => ({ have: h.sinceCount(s, (g) => rx.test(g.car.class || '')), need: n }),
  });
  const countryQ = (n: number, label: string, rx: RegExp, xp: number, orbs: number, badge?: boolean): Quest => ({
    t: `CATCH ${n} ${label.toUpperCase()} CAR${n > 1 ? 'S' : ''}`, xp, orbs, badge, cat: 'country', kind: 'origin', pred: (g) => rx.test(String(g.car.country || '')),
    test: (s) => ({ have: h.sinceCount(s, (g) => rx.test(String(g.car.country || ''))), need: n }),
  });
  const withExclusive = (q: Quest, track: string, tier: string) => Object.assign(q, { exclusive: { track, tier } });
  const withChapter = (q: Quest, chapterKey: string, label: string, grant: GrantFn) =>
    Object.assign(q, { chapterMilestone: { chapterKey, label, grant } });
  const evtQ = (t: string, desc: string, xp: number, orbs: number, test: (s: number) => Progress, extra?: Partial<Quest>): Quest =>
    Object.assign({ t, desc, xp, orbs, cat: 'event', kind: 'event', test }, extra || {});

  const classHas = (s: number, rx: RegExp) => h.since(s).some((g) => rx.test(g.car.class || ''));
  const varietyTest = (s: number): Progress => ({
    have: [classHas(s, /SEDAN/i), classHas(s, /SUV|OFFROAD/i), classHas(s, /SPORT|SUPER|MUSCLE|COUPE|HATCH/i)].filter(Boolean).length, need: 3,
  });
  const shinyTest = (s: number): Progress => {
    const shiny = h.sinceCount(s, (g) => g.shiny) > 0;
    const alt = h.sinceCount(s, (g) => (RTIER[g.car.rarity] ?? -1) >= RTIER.Uncommon);
    return { have: shiny ? 3 : Math.min(alt, 3), need: 3 };
  };
  const finalTest = (s: number): Progress => {
    const n = h.sinceCount(s, () => true), b = h.brandsSince(s);
    return { have: n >= 8 && b >= 4 ? 8 : Math.min(n, 7), need: 8 };
  };
  const colorsAny = (s: number, fams: string[]) => h.sinceCount(s, (g) => fams.some((f) => colorMatchesFamily(g.car, f)));
  const streakAlt = { badge: true, altDesc: "Can't spot 3 days running? Catch six cars across at least two separate days instead." };
  const streakTest = (s: number): Progress => ({ have: h.streak() >= 3 || h.daysSpanSince(s, 6, 2) ? 1 : 0, need: 1 });
  const rareTest = (s: number): Progress => ({ have: h.bestRaritySince(s) >= RTIER.Rare ? 1 : 0, need: 1 });
  const shinyAlt = { altDesc: 'Shinies are rare — three Uncommon-or-better catches clear this instead.' };
  const questStart40 = (s: number) => (profile.questStarts && profile.questStarts[40] != null ? profile.questStarts[40] : s);

  const summerEvt = (): Quest[] => [
    evtQ('BEACH COLORS', 'Catch three blue, white, or yellow cars.', 60, 12, (s) => ({ have: colorsAny(s, ['Blue', 'White', 'Yellow']), need: 3 })),
    evtQ('THREE-BRAND ROAD TRIP', 'Catch three different brands after this quest activates.', 65, 12, (s) => ({ have: h.brandsSince(s), need: 3 })),
    evtQ('SUMMER UTILITY', 'Catch an SUV, pickup, or van.', 55, 10, (s) => ({ have: h.sinceCount(s, (g) => /SUV|TRUCK|VAN|OFFROAD/i.test(g.car.class || '')), need: 1 })),
    evtQ('SUNSET PALETTE', 'Catch one red, orange, gold, pink, or purple car.', 60, 12, (s) => ({ have: colorsAny(s, ['Red', 'Orange', 'Yellow', 'Pink', 'Purple']), need: 1 })),
    evtQ('MILESTONE — COASTAL COLLECTION', 'Catch five cars during this chapter.', 90, 20, (s) => ({ have: h.sinceCount(s, () => true), need: 5 }), { badge: true }),
    evtQ('WORLD TOUR', 'Catch cars from three different manufacturer countries.', 80, 14, (s) => ({ have: h.countriesSince(s), need: 3 })),
    evtQ('ELECTRIC SUMMER', 'Catch an EV, hybrid, or plug-in hybrid.', 70, 14, (s) => ({ have: h.isElectrifiedSince(s) ? 1 : 0, need: 1 })),
    evtQ('DOUBLE TAKE', 'Catch the same model twice during this quest.', 75, 14, (s) => ({ have: h.hasDupSince(s) ? 1 : 0, need: 1 })),
    evtQ('COLOR CONTRAST', 'Catch two cars with different colors.', 55, 12, (s) => ({ have: h.distinctColorsSince(s), need: 2 })),
    evtQ('MILESTONE — ROAD TRIPPER', 'Reach a 3-day spotting streak.', 110, 25, streakTest, streakAlt),
    evtQ('GOLDEN VARIETY', 'Catch a sedan, an SUV, and a coupe or hatchback.', 100, 18, varietyTest),
    evtQ('FIVE-BRAND CRUISE', 'Catch five different brands after this quest activates.', 120, 18, (s) => ({ have: h.brandsSince(s), need: 5 })),
    evtQ('RARE SUMMER', 'Catch a Rare-or-better car.', 110, 20, rareTest),
    evtQ('GENERATION GAME', 'Catch two cars from the same brand but different models.', 90, 18, (s) => ({ have: h.sameMakeDiffModelSince(s) ? 1 : 0, need: 1 })),
    evtQ('MILESTONE — GOLDEN HOUR', 'Catch ten cars across quests 41–45.', 150, 30, (s) => ({ have: h.sinceCount(questStart40(s), () => true), need: 10 }), { badge: true }),
    evtQ('COAST-TO-COAST', 'Catch one car each from an Asian, a European, and an American brand.', 130, 22, (s) => ({ have: h.regionsSince(s), need: 3 })),
    evtQ('SUMMER SHINY', 'Catch a Shiny.', 150, 25, shinyTest, shinyAlt),
    evtQ('NIGHT COLORS', 'Catch a black, navy, silver, or purple car — any time of day, night spotting is never required.', 90, 18, (s) => ({ have: colorsAny(s, ['Black', 'Blue', 'Silver', 'Purple']), need: 1 })),
    evtQ('FINAL CRUISE', 'Catch eight cars after this quest activates, with at least four different brands among them.', 180, 30, finalTest),
    evtQ('SUNSET CIRCUIT FINALE', "The season's grand finale — reaching this quest means every Summer quest before it is already done.", 300, 50, () => ({ have: 1, need: 1 }), { badge: true }),
  ];
  const fallEvt = (): Quest[] => [
    evtQ('LEAF PEEPER', 'Catch three orange, red, or yellow cars.', 60, 12, (s) => ({ have: colorsAny(s, ['Orange', 'Red', 'Yellow']), need: 3 })),
    evtQ('BACK ROADS', 'Catch three different brands after this quest activates.', 65, 12, (s) => ({ have: h.brandsSince(s), need: 3 })),
    evtQ('HAYRIDE', 'Catch a pickup, SUV, or van — something that could haul a hay bale.', 55, 10, (s) => ({ have: h.sinceCount(s, (g) => /SUV|TRUCK|VAN|OFFROAD/i.test(g.car.class || '')), need: 1 })),
    evtQ('PUMPKIN PATCH', 'Catch one orange car.', 60, 12, (s) => ({ have: h.sinceCount(s, (g) => colorMatchesFamily(g.car, 'Orange')), need: 1 })),
    evtQ('MILESTONE — FIRST LEAVES', 'Catch five cars during this chapter.', 90, 20, (s) => ({ have: h.sinceCount(s, () => true), need: 5 }), { badge: true }),
    evtQ('HARVEST HAUL', 'Catch cars from three different manufacturer countries.', 80, 14, (s) => ({ have: h.countriesSince(s), need: 3 })),
    evtQ('CIDER RUN', 'Catch a brown, tan, bronze, or gold car.', 70, 14, (s) => ({
      have: h.sinceCount(s, (g) => colorMatchesFamily(g.car, 'Brown') || /GOLD|BRONZE|COPPER|CHAMPAGNE|TAN\b|BEIGE/i.test(String(g.car.color || ''))), need: 1,
    })),
    evtQ('TWIN PUMPKINS', 'Catch the same model twice during this quest.', 75, 14, (s) => ({ have: h.hasDupSince(s) ? 1 : 0, need: 1 })),
    evtQ('TRICK OR TREAT', 'Catch a black car AND an orange car.', 70, 14, (s) => ({
      have: [h.since(s).some((g) => colorMatchesFamily(g.car, 'Black')), h.since(s).some((g) => colorMatchesFamily(g.car, 'Orange'))].filter(Boolean).length, need: 2,
    })),
    evtQ('MILESTONE — PUMPKIN RUN', 'Reach a 3-day spotting streak.', 110, 25, streakTest, streakAlt),
    evtQ('HARVEST VARIETY', 'Catch a sedan, an SUV, and a coupe or hatchback.', 100, 18, varietyTest),
    evtQ('FOLIAGE TOUR', 'Catch five different brands after this quest activates.', 120, 18, (s) => ({ have: h.brandsSince(s), need: 5 })),
    evtQ('RARE HARVEST', 'Catch a Rare-or-better car.', 110, 20, rareTest),
    evtQ('FAMILY TREE', 'Catch two cars from the same brand but different models.', 90, 18, (s) => ({ have: h.sameMakeDiffModelSince(s) ? 1 : 0, need: 1 })),
    evtQ('MILESTONE — HARVEST MOON', 'Catch ten cars across quests 41–45.', 150, 30, (s) => ({ have: h.sinceCount(questStart40(s), () => true), need: 10 }), { badge: true }),
    evtQ('THANKSGIVING TABLE', 'Catch one car each from an Asian, a European, and an American brand.', 130, 22, (s) => ({ have: h.regionsSince(s), need: 3 })),
    evtQ('FALL SHINY', 'Catch a Shiny.', 150, 25, shinyTest, shinyAlt),
    evtQ('FIRST FROST', 'Catch a white, silver, or grey car.', 90, 18, (s) => ({ have: colorsAny(s, ['White', 'Silver', 'Grey']), need: 1 })),
    evtQ('BLACK FRIDAY RUSH', 'Catch eight cars after this quest activates, with at least four different brands among them.', 180, 30, finalTest),
    evtQ('HARVEST HIGHWAY FINALE', "The season's grand finale — reaching this quest means every Fall quest before it is already done.", 300, 50, () => ({ have: 1, need: 1 }), { badge: true }),
  ];

  const winterEvt = (): Quest[] => [
    evtQ('SNOW DAY', 'Catch three white, silver, or grey cars.', 60, 12, (s) => ({ have: colorsAny(s, ['White', 'Silver', 'Grey']), need: 3 })),
    evtQ('SALT ROADS', 'Catch three different brands after this quest activates.', 65, 12, (s) => ({ have: h.brandsSince(s), need: 3 })),
    evtQ('SNOW PLOW', 'Catch a pickup, SUV, or van — something that could push a snowbank.', 55, 10, (s) => ({ have: h.sinceCount(s, (g) => /SUV|TRUCK|VAN|OFFROAD/i.test(g.car.class || '')), need: 1 })),
    evtQ('ICE BLUE', 'Catch one blue car.', 60, 12, (s) => ({ have: h.sinceCount(s, (g) => colorMatchesFamily(g.car, 'Blue')), need: 1 })),
    evtQ('MILESTONE — FIRST SNOW', 'Catch five cars during this chapter.', 90, 20, (s) => ({ have: h.sinceCount(s, () => true), need: 5 }), { badge: true }),
    evtQ('WINTER WORLD', 'Catch cars from three different manufacturer countries.', 80, 14, (s) => ({ have: h.countriesSince(s), need: 3 })),
    evtQ('BLACK ICE', 'Catch one black car.', 70, 14, (s) => ({ have: h.sinceCount(s, (g) => colorMatchesFamily(g.car, 'Black')), need: 1 })),
    evtQ('TWIN FLAKES', 'Catch the same model twice during this quest.', 75, 14, (s) => ({ have: h.hasDupSince(s) ? 1 : 0, need: 1 })),
    evtQ('FIRE AND ICE', 'Catch a red car AND a white car.', 70, 14, (s) => ({
      have: [h.since(s).some((g) => colorMatchesFamily(g.car, 'Red')), h.since(s).some((g) => colorMatchesFamily(g.car, 'White'))].filter(Boolean).length, need: 2,
    })),
    evtQ('MILESTONE — ICE ROAD', 'Reach a 3-day spotting streak.', 110, 25, streakTest, streakAlt),
    evtQ('WINTER VARIETY', 'Catch a sedan, an SUV, and a coupe or hatchback.', 100, 18, varietyTest),
    evtQ('ALL-WHEEL TOUR', 'Catch five different brands after this quest activates.', 120, 18, (s) => ({ have: h.brandsSince(s), need: 5 })),
    evtQ('RARE FROST', 'Catch a Rare-or-better car.', 110, 20, rareTest),
    evtQ('SNOW SIBLINGS', 'Catch two cars from the same brand but different models.', 90, 18, (s) => ({ have: h.sameMakeDiffModelSince(s) ? 1 : 0, need: 1 })),
    evtQ('MILESTONE — AURORA NIGHTS', 'Catch ten cars across quests 41–45.', 150, 30, (s) => ({ have: h.sinceCount(questStart40(s), () => true), need: 10 }), { badge: true }),
    evtQ('POLAR EXPRESS', 'Catch one car each from an Asian, a European, and an American brand.', 130, 22, (s) => ({ have: h.regionsSince(s), need: 3 })),
    evtQ('WINTER SHINY', 'Catch a Shiny.', 150, 25, shinyTest, shinyAlt),
    evtQ('FIRST GREEN', 'Catch a green car — spring is on its way.', 90, 18, (s) => ({ have: h.sinceCount(s, (g) => colorMatchesFamily(g.car, 'Green')), need: 1 })),
    evtQ('THAW RUSH', 'Catch eight cars after this quest activates, with at least four different brands among them.', 180, 30, finalTest),
    evtQ('FROSTLINE FINALE', "The season's grand finale — reaching this quest means every Winter quest before it is already done.", 300, 50, () => ({ have: 1, need: 1 }), { badge: true }),
  ];
  const springEvt = (): Quest[] => [
    evtQ('FRESH PAINT', 'Catch three green, yellow, or white cars.', 60, 12, (s) => ({ have: colorsAny(s, ['Green', 'Yellow', 'White']), need: 3 })),
    evtQ('GARDEN ROUTE', 'Catch three different brands after this quest activates.', 65, 12, (s) => ({ have: h.brandsSince(s), need: 3 })),
    evtQ('HAUL THE MULCH', 'Catch a pickup, SUV, or van.', 55, 10, (s) => ({ have: h.sinceCount(s, (g) => /SUV|TRUCK|VAN|OFFROAD/i.test(g.car.class || '')), need: 1 })),
    evtQ('TULIP', 'Catch one red or pink car.', 60, 12, (s) => ({ have: colorsAny(s, ['Red', 'Pink']), need: 1 })),
    evtQ('MILESTONE — FIRST SPROUT', 'Catch five cars during this chapter.', 90, 20, (s) => ({ have: h.sinceCount(s, () => true), need: 5 }), { badge: true }),
    evtQ('WORLD IN BLOOM', 'Catch cars from three different manufacturer countries.', 80, 14, (s) => ({ have: h.countriesSince(s), need: 3 })),
    evtQ('RAINY DAY', 'Catch one blue or grey car.', 70, 14, (s) => ({ have: colorsAny(s, ['Blue', 'Grey']), need: 1 })),
    evtQ('TWIN BUDS', 'Catch the same model twice during this quest.', 75, 14, (s) => ({ have: h.hasDupSince(s) ? 1 : 0, need: 1 })),
    evtQ('SUN AND RAIN', 'Catch a yellow car AND a blue car.', 70, 14, (s) => ({
      have: [h.since(s).some((g) => colorMatchesFamily(g.car, 'Yellow')), h.since(s).some((g) => colorMatchesFamily(g.car, 'Blue'))].filter(Boolean).length, need: 2,
    })),
    evtQ('MILESTONE — FULL BLOOM', 'Reach a 3-day spotting streak.', 110, 25, streakTest, streakAlt),
    evtQ('SPRING VARIETY', 'Catch a sedan, an SUV, and a coupe or hatchback.', 100, 18, varietyTest),
    evtQ('ROAD TO SUMMER', 'Catch five different brands after this quest activates.', 120, 18, (s) => ({ have: h.brandsSince(s), need: 5 })),
    evtQ('RARE BLOOM', 'Catch a Rare-or-better car.', 110, 20, rareTest),
    evtQ('SAME ROOTS', 'Catch two cars from the same brand but different models.', 90, 18, (s) => ({ have: h.sameMakeDiffModelSince(s) ? 1 : 0, need: 1 })),
    evtQ('MILESTONE — APRIL SHOWERS', 'Catch ten cars across quests 41–45.', 150, 30, (s) => ({ have: h.sinceCount(questStart40(s), () => true), need: 10 }), { badge: true }),
    evtQ('THREE CONTINENTS', 'Catch one car each from an Asian, a European, and an American brand.', 130, 22, (s) => ({ have: h.regionsSince(s), need: 3 })),
    evtQ('SPRING SHINY', 'Catch a Shiny.', 150, 25, shinyTest, shinyAlt),
    evtQ('MEADOW GOLD', 'Catch a yellow or gold car.', 90, 18, (s) => ({ have: h.sinceCount(s, (g) => colorMatchesFamily(g.car, 'Yellow')), need: 1 })),
    evtQ('MEMORIAL DAY RUSH', 'Catch eight cars after this quest activates, with at least four different brands among them.', 180, 30, finalTest),
    evtQ('BLOOM RUN FINALE', "The season's grand finale — reaching this quest means every Spring quest before it is already done.", 300, 50, () => ({ have: 1, need: 1 }), { badge: true }),
  ];

  const ev = season.event;
  const arr: Quest[] = [
    colorQ(5, C[0], 15, 6),
    timerQ(2, 1, B[0], 40, 6),
    volumeQ(3, 20, 6),
    brandsQ(2, 25, 6),
    withExclusive(rarityQ('Uncommon', 30, 15, true), 'profile', 'legendary'),
    classQ(2, 'SUV', /SUV|OFFROAD/i, 35, 9),
    brandQ(2, B[1], 35, 9),
    specialQ('CATCH ONE AFTER DARK', 30, 9, false, (g) => g.car.nightCatch),
    volumeQ(6, 45, 9),
    withExclusive(dupQ(45, 20, true), 'lb', 'legendary'),
    colorQ(4, C[2], 50, 12),
    timerQ(3, 2, B[2], 70, 12),
    rarityQ('Rare', 60, 12),
    countryQ(2, 'GERMAN', /GERMAN/i, 65, 12),
    withExclusive(volumeQ(9, 80, 25, true), 'logo', 'legendary'),
    classQ(1, 'SUPERCAR', /SUPER|HYPER/i, 70, 15),
    streakQ(2, 60, 15),
    brandQ(3, B[3], 75, 15),
    rarityQ('Epic', 90, 15),
    withExclusive(specialQ('CATCH A SHINY', 80, 30, true, (g) => g.shiny), 'profile', 'mythic'),
    colorQ(6, C[0], 95, 18),
    timerQ(4, 3, B[0], 130, 18),
    streakQ(3, 110, 18),
    countryQ(2, 'JAPANESE', /JAPAN/i, 120, 18),
    withExclusive(rarityQ('Legendary', 150, 35, true), 'lb', 'mythic'),
    volumeQ(12, 140, 22),
    classQ(3, 'MUSCLE CAR', /MUSCLE/i, 130, 22),
    brandQ(5, B[1], 150, 22),
    brandsQ(6, 160, 22),
    withExclusive(rarityQ('Mythic', 250, 40, true), 'logo', 'mythic'),
    ...(ev === 'fall' ? fallEvt() : ev === 'winter' ? winterEvt() : ev === 'spring' ? springEvt() : summerEvt()),
  ];

  if (ev === 'fall') {
    withChapter(arr[12], 'leaves', 'FIRST LEAVES', (p) => grantOwnedCosmetic(p, 'mappin', 'map-marker-acorn'));
    withChapter(arr[25], 'pumpkin', 'PUMPKIN RUN', (p) => { grantOwnedCosmetic(p, 'mappin', 'map-marker-pumpkin'); grantComingSoon(p, 'deckBack', 'flannelback', 'FLANNEL'); grantSummerTitle(p, 'HAYRIDE HERO'); });
    withExclusive(arr[37], 'lb', 'harvest-gradient');
    withChapter(arr[37], 'moon', 'HARVEST MOON', (p) => grantOwnedCosmetic(p, 'effect', 'embers'));
    withExclusive(arr[49], 'profile', 'harvest-highway');
    withChapter(arr[49], 'frost', 'HARVEST HIGHWAY', (p) => { grantOwnedCosmetic(p, 'mappin', 'map-marker-ghost'); grantOwnedCosmetic(p, 'effect', 'harvestmoon'); grantComingSoon(p, 'catchEffect', 'leafstorm', 'LEAF STORM'); });
  } else if (ev === 'winter') {
    withChapter(arr[12], 'snowfall', 'FIRST SNOW', (p) => grantOwnedCosmetic(p, 'mappin', 'map-marker-snowflake'));
    withChapter(arr[25], 'icebound', 'ICE ROAD', (p) => { grantOwnedCosmetic(p, 'mappin', 'map-marker-mitten'); grantSummerTitle(p, 'ICE ROAD TRUCKER'); });
    withExclusive(arr[37], 'lb', 'aurora-gradient');
    withChapter(arr[37], 'aurora', 'AURORA NIGHTS', (p) => grantOwnedCosmetic(p, 'effect', 'snowfall'));
    withExclusive(arr[49], 'profile', 'frostline');
    withChapter(arr[49], 'thaw', 'FROSTLINE', (p) => { grantOwnedCosmetic(p, 'mappin', 'map-marker-snowman'); grantOwnedCosmetic(p, 'effect', 'aurora'); });
  } else if (ev === 'spring') {
    withChapter(arr[12], 'sprout', 'FIRST SPROUT', (p) => grantOwnedCosmetic(p, 'mappin', 'map-marker-tulip'));
    withChapter(arr[25], 'bloom', 'FULL BLOOM', (p) => { grantOwnedCosmetic(p, 'mappin', 'map-marker-butterfly'); grantSummerTitle(p, 'BLOOM RUNNER'); });
    withExclusive(arr[37], 'lb', 'bloom-gradient');
    withChapter(arr[37], 'rain', 'APRIL SHOWERS', (p) => grantOwnedCosmetic(p, 'effect', 'petals'));
    withExclusive(arr[49], 'profile', 'bloom-run');
    withChapter(arr[49], 'meadow', 'BLOOM RUN', (p) => { grantOwnedCosmetic(p, 'mappin', 'map-marker-bee'); grantOwnedCosmetic(p, 'effect', 'rainbow'); });
  } else {
    withChapter(arr[12], 'beach', 'FIRST SPLASH', (p) => grantComingSoon(p, 'mapPin', 'beachball', 'BEACH BALL'));
    withChapter(arr[25], 'road', 'ROAD TRIPPER', (p) => { grantComingSoon(p, 'deckBack', 'roadatlas', 'ROAD ATLAS'); grantSummerTitle(p, 'ROAD TRIPPER'); });
    withExclusive(arr[37], 'lb', 'sunset-gradient');
    withChapter(arr[37], 'golden', 'GOLDEN HOUR', () => {});
    withExclusive(arr[49], 'profile', 'sunset-circuit');
    withChapter(arr[49], 'midnight', 'SUNSET CIRCUIT', (p) => grantComingSoon(p, 'catchEffect', 'neoncoast', 'NEON COAST'));
  }

  const ov = ((profile.questOverrides || {}) as Record<string, Overrides>)[season.key] || {};
  Object.keys(ov).forEach((k) => {
    const step = +k, o = ov[k], q = arr[step];
    if (!q || o.kind === 'reset') return;
    const keep = q.exclusive ? { exclusive: q.exclusive } : {};
    if (o.kind === 'colorIdx' && q.kind === 'color') arr[step] = Object.assign(colorQ(q.n!, C[o.value!], q.xp, q.orbs, q.badge), keep);
    else if (o.kind === 'brandIdx' && q.kind === 'singleBrand') arr[step] = Object.assign(brandQ(q.n!, B[o.value!], q.xp, q.orbs, q.badge), keep);
    else if (o.kind === 'brandIdx' && q.kind === 'timer') arr[step] = Object.assign(timerQ(q.n!, q.hrs!, B[o.value!], q.xp, q.orbs), keep);
  });
  return arr;
}

/* ---------- permanent grants (additive-only, like the web app) ---------- */
export function grantOwnedCosmetic(p: Profile, track: string, tier: string) {
  const cos = (p.cosmetics = p.cosmetics || {}) as Record<string, any>;
  const o: string[] = (cos[track + 'Owned'] = cos[track + 'Owned'] || []);
  if (!o.includes(tier)) o.push(tier);
}
export function unlockExclusive(p: Profile, track: string, tier: string) {
  grantOwnedCosmetic(p, track, tier);
  (p.cosmetics as Record<string, any>)[track] = tier;
}
export function grantComingSoon(p: Profile, kind: string, id: string, name: string) {
  const cs = (p.comingSoon = (p.comingSoon || { mapPin: [], deckBack: [], catchEffect: [] })) as Record<string, { id: string; name: string }[]>;
  cs[kind] = cs[kind] || [];
  if (!cs[kind].some((x) => x.id === id)) cs[kind].push({ id, name });
}
export function grantSummerTitle(p: Profile, name: string) {
  const owned = (p.summerTitlesOwned = (p.summerTitlesOwned || []) as string[]);
  if (!owned.includes(name)) owned.push(name);
}

export type QuestEvent =
  | { type: 'progress'; have: number; need: number; title: string }
  | { type: 'complete'; step: number; total: number; xp: number; orbs: number; badge: boolean; exclusive?: { track: string; tier: string } }
  | { type: 'chapter'; label: string };

/** Advances the quest cursor as far as the garage allows. Mutates a COPY of the profile and returns it with the events to toast. */
export function advanceQuests(
  garage: Catch[], profileIn: Profile, now = new Date(), season = currentSeason(now),
): { profile: Profile; events: QuestEvent[]; quests: Quest[] } {
  const profile = JSON.parse(JSON.stringify(profileIn)) as Profile;
  const events: QuestEvent[] = [];
  if (profile.questSeason !== season.key) {
    profile.questSeason = season.key;
    profile.questStep = 0;
    profile.questStarts = {};
  }
  profile.questStep = (profile.questStep as number) || 0;
  profile.orbs = (profile.orbs as number) || 0;
  const starts = (profile.questStarts = (profile.questStarts || {}) as Record<number, number>);
  if (starts[profile.questStep as number] == null) starts[profile.questStep as number] = now.getTime();
  profile.questProgressStep = (profile.questProgressStep as number) ?? -1;
  profile.questProgressHave = (profile.questProgressHave as number) || 0;
  if (profile.questProgressStep !== profile.questStep) {
    profile.questProgressStep = profile.questStep;
    profile.questProgressHave = 0;
  }
  const quests = buildQuests(garage, { days: profile.days, questOverrides: profile.questOverrides, questStarts: starts }, season, now);
  while ((profile.questStep as number) < quests.length) {
    const step = profile.questStep as number;
    const q = quests[step];
    const { have, need } = q.test(starts[step]);
    if (have < need) {
      if (have > (profile.questProgressHave as number)) {
        profile.questProgressHave = have;
        events.push({ type: 'progress', have, need, title: q.t });
      }
      break;
    }
    profile.questStep = step + 1;
    profile.orbs = (profile.orbs as number) + q.orbs;
    profile.bonusXP = (profile.bonusXP || 0) + q.xp;
    starts[step + 1] = now.getTime();
    profile.questProgressStep = step + 1;
    profile.questProgressHave = 0;
    events.push({ type: 'complete', step: step + 1, total: quests.length, xp: q.xp, orbs: q.orbs, badge: !!q.badge, exclusive: q.exclusive });
    if (q.exclusive) unlockExclusive(profile, q.exclusive.track, q.exclusive.tier);
    if (q.chapterMilestone) {
      const cm = q.chapterMilestone;
      const badges = (profile.chapterBadges = (profile.chapterBadges || []) as string[]);
      if (!badges.includes(cm.label)) badges.push(cm.label);
      try { cm.grant(profile); } catch {}
      events.push({ type: 'chapter', label: cm.label });
    }
  }
  return { profile, events, quests };
}
