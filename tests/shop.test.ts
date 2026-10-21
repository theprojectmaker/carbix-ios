import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { buyItem, CATCH_EFFECTS, effectEntries, equipItem, mapPinEntries, MAP_PIN_STYLES, ownedTiers } from '../src/engine/shop';
import { normalizeProfile } from '../src/engine/store';

test('shop item lists equal the web app data', () => {
  const html = fs.readFileSync('../motordex/public/index.html', 'utf8');
  const a = html.indexOf('const MAP_PIN_STYLES=');
  const b = html.indexOf('const EFFECT_SWATCH=');
  assert.ok(a > 0 && b > a);
  const ctx: any = {};
  vm.createContext(ctx);
  vm.runInContext(html.slice(a, b) + '\nglobalThis.__o={MAP_PIN_STYLES,CATCH_EFFECTS};', ctx);
  const web = ctx.__o;
  const strip = (arr: any[]) => JSON.stringify(arr.map((t) => ({ id: t.id, name: t.name, price: t.price, season: t.season ?? null, marker: t.marker ?? null })));
  assert.equal(strip(MAP_PIN_STYLES), strip(web.MAP_PIN_STYLES));
  assert.equal(strip(CATCH_EFFECTS), strip(web.CATCH_EFFECTS));
});

test('buying spends Orbs once, owns and wears the item', () => {
  const p = normalizeProfile({ orbs: 100 });
  const r = buyItem(p, 'mappin', 'map-marker-acorn');
  assert.ok(r.ok);
  assert.equal(r.profile.orbs, 60);
  assert.deepEqual(ownedTiers(r.profile, 'mappin'), ['map-marker-acorn']);
  assert.equal((r.profile.cosmetics as any).mappin, 'map-marker-acorn');
  assert.equal(p.orbs, 100, 'input is not mutated');
  const again = buyItem(r.profile, 'mappin', 'map-marker-acorn');
  assert.ok(!again.ok);
  assert.equal(again.profile.orbs, 60);
});

test('not enough Orbs and unknown items are refused', () => {
  const p = normalizeProfile({ orbs: 10 });
  assert.match(buyItem(p, 'effect', 'embers').message, /NEED 55/);
  assert.ok(!buyItem(p, 'effect', 'nope').ok);
});

test('equip needs ownership, except the free defaults', () => {
  const p = normalizeProfile({ orbs: 0 });
  assert.ok(!equipItem(p, 'effect', 'starburst').ok);
  const std = equipItem(p, 'effect', 'standard');
  assert.ok(std.ok);
  const classic = equipItem(buyItem(normalizeProfile({ orbs: 99 }), 'mappin', 'map-marker-ghost').profile, 'mappin', 'classic');
  assert.equal((classic.profile.cosmetics as any).mappin, 'classic');
});

test('seasonal items show only in their season, or forever once owned', () => {
  const p = normalizeProfile({ orbs: 0 });
  assert.ok(mapPinEntries(p, 'fall').some((e) => e.id === 'map-marker-ghost'));
  assert.ok(!mapPinEntries(p, 'winter').some((e) => e.id === 'map-marker-ghost'));
  const owner = buyItem(normalizeProfile({ orbs: 90 }), 'effect', 'embers').profile;
  assert.ok(effectEntries(owner, 'winter').some((e) => e.id === 'embers' && e.owned && e.equipped));
  assert.ok(effectEntries(p, 'winter').every((e) => e.id !== 'embers'));
});
