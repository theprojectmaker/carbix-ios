import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { badgeList } from '../src/engine/badges';
import { normalizeProfile } from '../src/engine/store';
import type { Catch } from '../src/engine/types';
import { levelFor, totalXpFor } from '../src/engine/xp';

const html = fs.readFileSync('../motordex/public/index.html', 'utf8');
const slice = (from: string, to: string) => {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  assert.ok(a > 0 && b > a, `${from} -> ${to}`);
  return html.slice(a, b);
};

let seed = 99;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

function randomGarage(n: number): Catch[] {
  const makes = ['Ferrari', 'Toyota', 'Ford', 'BMW', 'Tesla', 'Honda', 'Porsche', 'Jeep'];
  const out: Catch[] = [];
  for (let i = 0; i < n; i++) {
    const make = pick(makes);
    out.push({
      id: i + 1, ts: Date.UTC(2026, 9, 1) + Math.floor(rnd() * 20 * 86400000), shiny: rnd() < 0.1,
      geo: rnd() < 0.6 ? { lat: 40.7 + rnd() * 0.3, lng: -74 + rnd() * 0.3 } : null,
      car: {
        make, model: pick(['GT', 'S', 'X', 'Civic', 'Camry', 'M3']), rarity: pick(['Common', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']) as any,
        class: pick(['SEDAN', 'SUV', 'SUPER', 'TRUCK', 'MUSCLE']), country: pick(['Germany', 'Japan', 'Italy', 'USA']),
        horsepower: pick([150, 320, 560, 900]), topSpeedMph: pick([120, 165, 210]), zeroToSixty: pick(['7.1s', '4.2s', '2.9s']),
        yearRange: pick(['1965-1970', '1995', '2012-2020', '2024-present']), engine: pick(['V8', 'electric motor', '2.0L I4']),
        colorRarity: pick(['Common', 'Uncommon', 'Rare', undefined]) as any,
      },
    } as Catch);
  }
  return out;
}

function web(garage: Catch[], profile: any, level: number, now: number) {
  const ctx: any = { Intl, Math, Set, Map, Object, Array, JSON, String, Number, parseInt, parseFloat, RegExp, console, window: {} };
  class FakeDate extends Date {
    constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(now); }
    static now() { return now; }
  }
  ctx.Date = FakeDate;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('../motordex/public/catalog.js', 'utf8'), ctx);
  ctx.garage = JSON.parse(JSON.stringify(garage));
  ctx.profile = JSON.parse(JSON.stringify(profile));
  const code = [
    slice('const RMAP=', '/* the researched catalog is the authority'),
    slice('const DATEFMT_ET=', '\nconst dateKeyET'),
    'const dateKeyET=(d)=>DATEFMT_ET.format(d===undefined?new Date():d);',
    slice('const TIERS =', 'const TIER_XP'),
    slice('const RTIER=', '\nconst popularityScore'),
    slice('const POPULAR_MAKES=', 'const RTIER='),
    slice('const popularityScore=', '/* Big rigs and buses'),
    slice('const norm=(s)=>', '/* popularity'),
    slice('function streak(){', '/* ---------- CATALOG'),
    slice('function popularExtremes(){', '/* ---------- ACHIEVEMENTS'),
    'let POPULAR_ONE=null, RAREST_ONE=null;',
    slice('function catalogMatch(car){', 'const catchesFor='),
    slice('function spotMiles(){', 'function spotMileage'),
    slice('function zonesExplored(){', '/* ---------- SEASONS, ERA MONTHS'),
    slice('function garageValueRaw(){', 'function garageValue()'),
    `const level=()=>${level};`,
    slice('function badgeStats(){', 'function applySetTab'),
    'globalThis.__out=badgeList().map(b=>({nm:b.nm,ok:b.ok,prog:b.prog}));',
  ].join('\n');
  vm.runInContext(code, ctx);
  return ctx.__out as { nm: string; ok: boolean; prog?: number }[];
}

test('badge list matches the web app badge for badge', () => {
  for (const size of [0, 1, 6, 30, 120]) {
    const garage = randomGarage(size);
    const profile = normalizeProfile({ username: 'q', days: ['2026-10-18', '2026-10-17'], questStep: 7, friends: ['@a'], avatar: 3, targets: 2, setsDone: { A: 1 } });
    const now = new Date('2026-10-18T15:00:00Z');
    const lv = levelFor(totalXpFor(garage, profile));
    const w = web(garage, profile, lv, now.getTime());
    const mine = badgeList(garage, profile, now);
    assert.equal(mine.length, w.length, `count at size ${size}`);
    for (let i = 0; i < w.length; i++) {
      assert.equal(mine[i].nm, w[i].nm);
      assert.equal(mine[i].ok, w[i].ok, `${w[i].nm} at size ${size}`);
      if (w[i].prog !== undefined) assert.ok(Math.abs(mine[i].prog - (w[i].prog as number)) < 1e-9, `${w[i].nm} prog at size ${size}`);
    }
  }
});

test('there are about 200 badges and the first catch earns CATCH 1', () => {
  const garage = randomGarage(1);
  const b = badgeList(garage, normalizeProfile(null));
  assert.ok(b.length > 190);
  assert.ok(b.find((x) => x.nm === 'CATCH 1')!.ok);
});
