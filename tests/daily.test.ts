import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { CATALOG } from '../src/engine/data';
import { cotd, dailyChallenges, evalChallenges, nextCombo, spotlightColor, catchBonuses } from '../src/engine/daily';
import { normalizeProfile } from '../src/engine/store';
import type { Car, Catch } from '../src/engine/types';

const html = fs.readFileSync('../motordex/public/index.html', 'utf8');
const slice = (from: string, to: string) => {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  assert.ok(a > 0 && b > a, `${from} -> ${to}`);
  return html.slice(a, b);
};

function web(day: string) {
  const ctx: any = { Intl, Math, Set, Object, Array, JSON, String, Number, parseInt, parseFloat, RegExp, console, window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('../motordex/public/catalog.js', 'utf8'), ctx);
  const code = [
    slice('const RMAP=', '/* the researched catalog is the authority'),
    `const dateKeyET=()=>${JSON.stringify(day)};`,
    slice('const CH_POOL=[', '/* ---------- notifications'),
    slice('const SPOTLIGHT_COLORS=', 'function spotlightColor(){'),
    slice('function spotlightColor(){', 'function spotMiles'),
    'globalThis.__o={cotd:cotd().n,spot:spotlightColor(),ch:dailyChallenges().list.map(c=>c.id)};',
  ].join('\n');
  vm.runInContext(code, ctx);
  return ctx.__o as { cotd: number; spot: string; ch: string[] };
}

test('car of the day, spotlight and daily challenges equal the web app on many dates', () => {
  for (const day of ['2026-10-18', '2026-10-19', '2026-12-31', '2027-02-14', '2026-07-04', '2026-03-09']) {
    const w = web(day);
    assert.equal(cotd(CATALOG, day).n, w.cotd, day);
    assert.equal(spotlightColor(day), w.spot, day);
    assert.equal(JSON.stringify(dailyChallenges(day).list.map((c) => c.id)), JSON.stringify(w.ch), day);
  }
});

test('challenge progress pays its XP exactly once', () => {
  const now = new Date('2026-10-18T15:00:00Z');
  const day = '2026-10-18';
  const first = dailyChallenges(day).list[0];
  const car: any = { make: 'X', model: 'Y', rarity: 'Common', class: 'SPORT SUV SEDAN HATCH', country: 'JAPAN', color: 'red', yearRange: '1995', horsepower: 600, drive: 'AWD', engine: 'V8 turbo' };
  const g: Catch[] = [0, 1, 2].map((i) => ({ id: i + 1, ts: now.getTime() - i * 1000, car } as Catch));
  const r1 = evalChallenges(g, normalizeProfile(null), now);
  const r2 = evalChallenges(g, r1.profile, now);
  assert.equal(r1.profile.bonusXP || 0, r1.won.reduce((a, c) => a + c.xp, 0));
  assert.ok(first.id);
  assert.equal(r2.won.length, 0);
  assert.equal(r2.profile.bonusXP, r1.profile.bonusXP);
});

test('bonus stack and combo chain', () => {
  const car: Car = { make: 'A', model: 'B', rarity: 'Rare' };
  const b = catchBonuses(CATALOG, car, { shiny: true, firstToday: true, hit: null, comboN: 3 });
  assert.deepEqual(b.map((x) => x.xp), [17, 25, 13]);
  assert.equal(b[0].orbs, 5);
  assert.equal(nextCombo({ ts: 1000, n: 2 }, 1000 + 599999).n, 3);
  assert.equal(nextCombo({ ts: 1000, n: 2 }, 1000 + 600000).n, 1);
});
