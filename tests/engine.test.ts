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
  assert.equal(CATALOG.length, 3123); // 4,920 raw rows, minus 51 hidden-shelf Grail cars, minus bikes/trailers/hidden
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

import { BINGO_LINES, applyBingo, bingoBoard, bingoState, hiloCorrect, hiloRound, hiloPick, HILO_STATS } from '../src/engine/games';
import { newProfile } from '../src/engine/store';

test('bingo: the board is the same all day, centre is free, nine distinct squares', () => {
  const a = bingoBoard('2026-11-02');
  const b = bingoBoard('2026-11-02');
  assert.deepEqual(a.map((t) => t.id), b.map((t) => t.id));
  assert.equal(a.length, 9);
  assert.equal(a[4].id, 'free');
  assert.equal(new Set(a.map((t) => t.id)).size, 9);
  assert.notDeepEqual(a.map((t) => t.id), bingoBoard('2026-11-03').map((t) => t.id));
});

test('bingo: lines are detected from today\'s catches and paid once', () => {
  const day = '2026-11-02';
  const board = bingoBoard(day);
  // a car that satisfies every square: fabricate catches that each satisfy one task
  const ts = new Date('2026-11-02T15:00:00Z').getTime();
  const mk = (i: number): Catch => ({ id: i, ts, car: { make: 'X', model: 'Y', rarity: 'Common' } as Car } as Catch);
  const empty = bingoState([mk(1)], day);
  assert.equal(empty.done[4], true); // free square needs any catch today
  assert.equal(empty.lines.length, 0);
  const p0 = newProfile();
  const first = applyBingo(p0, { ...empty, mask: 1 }, day); // pretend row 0 completed
  assert.equal(first.xp, 10);
  const again = applyBingo(first.profile, { ...empty, mask: 1 }, day);
  assert.equal(again.xp, 0);
  const full = applyBingo(first.profile, { ...empty, mask: 1 | (1 << 8) }, day);
  assert.equal(full.xp, 50);
  assert.equal(full.orbs, 25);
  assert.equal(BINGO_LINES.length, 8);
  assert.ok(board.every((t) => typeof t.test === 'function'));
});

test('higher or lower: rounds never tie, XP is capped at 60 a day', () => {
  for (let i = 0; i < 40; i++) {
    const left = hiloPick();
    const { stat, right } = hiloRound(left);
    assert.notEqual(HILO_STATS[stat].get(left), HILO_STATS[stat].get(right));
  }
  let p = newProfile();
  let total = 0;
  for (let i = 1; i <= 40; i++) { const r = hiloCorrect(p, i, '2026-11-02'); p = r.profile; total += r.xp; }
  assert.equal(total, 60);
  assert.equal(p.hiloBest, 40);
});

import { shinyChance, shinyRollPity, SHINY_HARD_PITY } from '../src/engine/store';
import { battleDeal, battleRound, finishBattle, BATTLE_STATS } from '../src/engine/games';

test('shiny hunt: base odds, climbing soft pity, guaranteed at the hard pity', () => {
  assert.equal(shinyChance(0), 1 / 50);
  assert.equal(shinyChance(59), 1 / 50);
  assert.ok(shinyChance(70) > shinyChance(60));
  assert.equal(shinyChance(SHINY_HARD_PITY - 1), 1);
  assert.equal(shinyRollPity(SHINY_HARD_PITY - 1, () => 0.999).shiny, true);
  assert.deepEqual(shinyRollPity(5, () => 0.999), { shiny: false, pity: 6 });
  assert.deepEqual(shinyRollPity(40, () => 0), { shiny: true, pity: 0 });
});

test('card battle: a deal has five cards a side and five stats; 0-60 is won by the lower number', () => {
  const b = battleDeal([]);
  assert.equal(b.mine.length, 5);
  assert.equal(b.theirs.length, 5);
  assert.equal(b.stats.length, 5);
  const [a, c] = b.mine;
  for (const k of ['hp', 'top', 'zts', 'value'] as const) {
    const va = BATTLE_STATS[k].get(a)!, vc = BATTLE_STATS[k].get(c)!;
    const r = battleRound(k, a, c);
    if (va === vc) assert.equal(r, 0);
    else assert.equal(r, (BATTLE_STATS[k].lowerWins ? va < vc : va > vc) ? 1 : -1);
  }
  let p = newProfile();
  let paid = 0;
  for (let i = 0; i < 5; i++) { const f = finishBattle(p, true, '2026-12-03'); p = f.profile; paid += f.xp; }
  assert.equal(paid, 60); // only the first three wins a day pay
  assert.equal(p.battleStreak, 5);
  assert.equal(finishBattle(p, false, '2026-12-03').profile.battleStreak, 0);
});

import { shinyHour, shinyHourOn, SHINY_BASE } from '../src/engine/store';
test('shiny hour: one hour a day, same for everyone, doubles the base odds', () => {
  const w = shinyHourOn('2026-12-03');
  assert.equal(w.endTs - w.startTs, 3600e3);
  const h = new Date(w.startTs).getUTCHours();
  assert.ok(h >= 15 && h <= 22);
  assert.equal(shinyHour(w.startTs + 60e3).live, true);
  assert.equal(shinyHour(w.endTs + 60e3).live, false);
  assert.ok(shinyHour(w.endTs + 60e3).startTs > w.endTs); // the next one is tomorrow's
  assert.equal(shinyChance(0, 2), SHINY_BASE * 2);
  assert.equal(shinyChance(0), SHINY_BASE);
});

import { brandChase } from '../src/engine/games';
test('brand chase: picks the brand closest to done and lists what is missing', () => {
  const mk = (n: number, make: string): never => ({ n, make, model: 'M' + n, rarity: 'common' }) as never;
  const cat = [mk(1, 'A'), mk(2, 'A'), mk(3, 'A'), mk(4, 'A'), mk(5, 'B'), mk(6, 'B'), mk(7, 'B')];
  assert.equal(brandChase(new Set(), cat), null);
  const r = brandChase(new Set([1, 2, 3, 5]), cat)!;
  assert.equal(r.make, 'A');
  assert.deepEqual(r.missing.map((e) => e.n), [4]);
  assert.equal(brandChase(new Set([1, 2, 3, 4, 5, 6, 7]), cat), null); // nothing left to chase
});
