import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { CATALOG, DISPLAY_RANK, catalogMatch, fixStats } from '../src/engine/data';
import { mergeCloud } from '../src/engine/api';
import { dexBitsDecode, dexBitsEncode, markDay, normalizeGarage, normalizeProfile, parseBackup, streak, totalXp } from '../src/engine/store';
import { catchXP, levelFor, rankFor, xpForLevel } from '../src/engine/xp';
import type { Car, Catch } from '../src/engine/types';

const car = (o: Partial<Car> = {}): Car => ({ make: 'Toyota', model: 'Camry', rarity: 'Common', ...o });

test('catalog size after the same filters the web app applies', () => {
  assert.equal(CATALOG.length, 2843); // 4,652 raw rows, minus bikes/trailers/hidden
});

test('web parity: the catalog + display rank equal what index.html computes', () => {
  const html = fs.readFileSync('../motordex/public/index.html', 'utf8');
  const a = html.indexOf('const RMAP=');
  const b = html.indexOf('/* the researched catalog is the authority');
  const c = html.indexOf('const POPULAR_MAKES=');
  const d = html.indexOf('let POPULAR_ONE=null');
  assert.ok(a > 0 && b > a && c > b && d > c);
  const ctx: any = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('../motordex/public/catalog.js', 'utf8'), ctx);
  const code = html.slice(a, b) + html.slice(c, d) +
    '\nglobalThis.__out={ids:CATALOG.map(x=>x.n),rank:[...DISPLAY_RANK]};';
  vm.runInContext(code, ctx);
  assert.equal(JSON.stringify(CATALOG.map((x) => x.n)), JSON.stringify(ctx.__out.ids));
  assert.equal(JSON.stringify([...DISPLAY_RANK]), JSON.stringify(ctx.__out.rank));
});

test('catchXP follows the web rules', () => {
  assert.equal(catchXP(car()), 3);
  assert.equal(catchXP(car({ rarity: 'Rare', colorRarity: 'Rare' })), 25 + 13);
  assert.equal(catchXP(car({ rarity: 'Epic', twinSpot: true, cleanShot: true })), 65 + 25 + 10);
  assert.equal(catchXP(car({ rarity: 'Common', barnFind: true })), 5); // 3 * 1.5 rounded
  assert.equal(catchXP(car({ rarity: 'Uncommon', xpBoosted: true })), 16);
  assert.equal(catchXP(car({ xpOverride: 99 })), 99);
  assert.equal(catchXP(car({ model: 'Civic Type R' })), 3 + 5);
});

test('levels: ~5 commons reach level 2, 100 is the cap', () => {
  assert.equal(xpForLevel(2), 120);
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(119), 1);
  assert.equal(levelFor(120), 2);
  assert.equal(levelFor(10 ** 9), 100);
  assert.equal(rankFor(1), 'ROOKIE');
  assert.equal(rankFor(70), 'BIX KING');
  assert.equal(rankFor(100), 'BIX GOD');
});

test('catalogMatch folds accents and fixStats lets the catalog win', () => {
  const hit = catalogMatch({ make: 'Lamborghini', model: 'Huracán' });
  assert.ok(hit && /huracan/i.test(hit.model));
  const c = car({ make: 'Acura', model: 'Integra Type S', horsepower: 9999 });
  fixStats(c);
  assert.equal(c.horsepower, 320);
  assert.equal(c.rarity, 'Rare');
});

test('saves: self-heal bad rarity and duplicate ids', () => {
  const g = normalizeGarage([
    { id: 1, ts: 1, car: car({ rarity: 'Bogus' as any }) },
    { id: 1, ts: 2, car: car() },
    null,
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].car.rarity, 'Common');
});

test('profile keeps its identity and migrates old vault tiers', () => {
  const p = normalizeProfile({ username: 'sam', token: 'abc12345', cosmetics: { profile: 'gold', profileOwned: ['iron', 'diamond'] } });
  assert.equal(p.name, '@sam');
  assert.equal(p.token, 'abc12345');
  assert.equal((p.cosmetics as any).profile, 'rare');
  assert.deepEqual((p.cosmetics as any).profileOwned, ['common', 'epic']);
});

test('streak counts consecutive Eastern days', () => {
  const p = normalizeProfile(null);
  const now = new Date('2026-10-18T15:00:00Z');
  for (const d of ['2026-10-18', '2026-10-17', '2026-10-16', '2026-10-13']) markDay(p, d);
  assert.equal(streak(p, now), 3);
});

test('bix bitfield round-trips', () => {
  const s = dexBitsEncode([1, 2, 9, 4000], 4652);
  assert.deepEqual([...dexBitsDecode(s)].sort((a, b) => a - b), [1, 2, 9, 4000]);
});

test('web backup files import; cloud merge only adds progress', () => {
  const backup = JSON.stringify({ when: 'x', app: 'motordex', profile: { username: 'ann', bonusXP: 50 }, garage: [{ id: 5, ts: 5, car: car() }] });
  const b = parseBackup(backup)!;
  assert.equal(b.profile.username, 'ann');
  assert.equal(totalXp(b.garage, b.profile), 53);
  const local: Catch[] = [{ id: 9, ts: 9, car: car() }];
  const m = mergeCloud(local, normalizeProfile({ bonusXP: 100 }), { garage: [{ id: 5, ts: 5, car: car() }], profile: { bonusXP: 10, days: ['2026-10-01'] } });
  assert.equal(m.garage.length, 2);
  assert.equal(m.profile.bonusXP, 100);
  assert.deepEqual(m.profile.days, ['2026-10-01']);
});
