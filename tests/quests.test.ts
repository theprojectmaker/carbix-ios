import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { advanceQuests, buildQuests, currentSeason } from '../src/engine/quests';
import { normalizeProfile } from '../src/engine/store';
import type { Catch } from '../src/engine/types';

const html = fs.readFileSync('../motordex/public/index.html', 'utf8');
const slice = (from: string, to: string) => {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  assert.ok(a > 0 && b > a, `markers ${from} -> ${to}`);
  return html.slice(a, b);
};

/** The web app's own quest code, evaluated with stubbed UI hooks, as the source of truth. */
function webEngine(now: number) {
  const code = [
    slice('const DATEFMT_ET=', '\nconst dateKeyET'),
    'const dateKeyET=(d)=>DATEFMT_ET.format(d===undefined?new Date():d);',
    slice('const RTIER=', '\nconst popularityScore'),
    slice('const norm=(s)=>', '/* popularity'),
    slice('function streak(){', '/* ---------- CATALOG'),
    slice('const SEASON_THEMES=', 'const seasonProgress'),
    slice('const hasDupSince=', 'const colorMatchesFamily=(car,family)=>!!family&&carColorFamily(car)===family;') +
      'const colorMatchesFamily=(car,family)=>!!family&&carColorFamily(car)===family;',
    slice('const seasonEventKey=', 'const seasonEventName'),
    slice('const SUMMER_CHAPTERS=', 'let QUESTS=[], questsSeasonKey=null;'),
    'let QUESTS=[], questsSeasonKey=null;',
    slice('function unlockExclusive(', 'function checkQuests()'),
    slice('function checkQuests()', '/* a node\'s badge'),
    slice('function grantOwnedCosmetic(', '/* Coming Soon: real'),
    slice('const SEASON_COLORS=', '/* Sunset Circuit chapters'),
  ].join('\n');
  const ctx: any = {
    Intl, Math, Object, Array, Set, Number, String, JSON, console, parseInt, parseFloat, RegExp,
    save() {}, toastMini() {}, pushNotification() {}, syncOrbBadge() {}, pushProfile() {}, applyCosmetics() {},
    EXCLUSIVE_LABEL: new Proxy({}, { get: () => 'X' }), trackLabel: () => 'T',
    garage: [] as Catch[], profile: {} as any,
  };
  class FakeDate extends Date {
    constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(now); }
    static now() { return now; }
  }
  ctx.Date = FakeDate;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

let maxStep = 0;
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

function randomGarage(now: number, n: number): Catch[] {
  const makes = ['Toyota', 'Ford', 'Chevrolet', 'Dodge', 'Nissan', 'BMW', 'Honda', 'Subaru', 'Jeep', 'Mazda', 'Audi'];
  const rars = ['Common', 'Common', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const colors = ['Red', 'Gecko Green', 'Orange', 'Black', 'White', 'Navy Blue', 'Silver', 'Tan', 'Rosso Corsa', 'Grey'];
  const classes = ['SEDAN', 'SUV', 'TRUCK', 'SPORT', 'SUPER', 'MUSCLE', 'HATCH'];
  const countries = ['USA', 'Germany', 'Japan', 'Italy', 'Korea', 'UK'];
  const out: Catch[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: i + 1, ts: now + Math.floor(rnd() * 4 * 86400000), shiny: rnd() < 0.08,
      car: {
        make: pick(makes), model: pick(['A', 'B', 'C', 'D', 'E']), rarity: pick(rars) as any, color: pick(colors),
        class: pick(classes), country: pick(countries), engine: pick(['2.0L I4', 'electric motor', 'V8', 'hybrid V6']),
        nightCatch: rnd() < 0.1,
      },
    } as Catch);
  }
  return out;
}

for (const iso of ['2026-10-18T15:00:00Z', '2026-07-20T15:00:00Z']) {
  let maxStep = 0;
test(`quest ladder matches the web app (${iso})`, () => {
    const now = new Date(iso).getTime();
    for (const size of [0, 3, 12, 40, 150, 400]) {
      for (let trial = 0; trial < 6; trial++) {
        const garage = randomGarage(now, size);
        const days = [...new Set(garage.map((g) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(g.ts))))];
        const base = normalizeProfile({ username: 'q', days });
        const web = webEngine(now);
        web.garage = JSON.parse(JSON.stringify(garage));
        web.profile = JSON.parse(JSON.stringify(base));
        vm.runInContext('checkQuests()', web);
        const mine = advanceQuests(garage, base, new Date(now));
        const keys = ['questStep', 'orbs', 'bonusXP', 'questSeason', 'chapterBadges', 'comingSoon', 'summerTitlesOwned'];
        for (const k of keys) {
          assert.equal(JSON.stringify((mine.profile as any)[k] ?? null), JSON.stringify(web.profile[k] ?? null), `${k} (size ${size}, trial ${trial})`);
        }
        maxStep = Math.max(maxStep, mine.profile.questStep as number);
        assert.equal(JSON.stringify(mine.profile.cosmetics ?? {}), JSON.stringify(web.profile.cosmetics ?? {}), 'cosmetics');
      }
    }
    assert.ok(maxStep >= 4, `random garages only reached quest ${maxStep}`);
  });
}

test('the ladder has 50 quests and rebuilds per season', () => {
  const now = new Date('2026-10-18T15:00:00Z');
  const s = currentSeason(now);
  assert.equal(s.event, 'fall');
  const p = normalizeProfile(null);
  assert.equal(buildQuests([], p, s, now).length, 50);
  assert.equal(buildQuests([], p, currentSeason(new Date('2026-07-20T15:00:00Z')), now).length, 50);
});
