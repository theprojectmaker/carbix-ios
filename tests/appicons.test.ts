import assert from 'node:assert/strict';
import test from 'node:test';

import { buyIcon, equipIcon, iconEquipped, iconOwned } from '../src/engine/appicons';
import { newProfile } from '../src/engine/store';

const rich = () => ({ ...newProfile(), orbs: 200 });

test('buying a fall icon spends orbs, owns it under the website id, and wears it', () => {
  const r = buyIcon(rich(), '2026Q4', '2026Q4', 'maple');
  assert.equal(r.ok, true);
  assert.equal(r.profile.orbs, 140);
  assert.equal(iconOwned(r.profile, '2026Q4', 'maple'), true);
  assert.equal(iconEquipped(r.profile), '2026Q4::maple');
  assert.equal(buyIcon(r.profile, '2026Q4', '2026Q4', 'maple').ok, false);
});

test('icons cannot be bought out of season, without orbs, or when the build lacks them', () => {
  assert.equal(buyIcon(rich(), '2026Q3', '2026Q4', 'beach').ok, false);
  assert.equal(buyIcon({ ...newProfile(), orbs: 10 }, '2026Q4', '2026Q4', 'frost').ok, false);
  assert.equal(buyIcon(rich(), '2026Q4', '2026Q4', 'nope').ok, false);
});

test('owned icons can be switched and reset, unowned ones cannot', () => {
  const bought = buyIcon(rich(), '2026Q4', '2026Q4', 'pumpkin').profile;
  assert.equal(equipIcon(bought, null).ok, true);
  assert.equal(iconEquipped(equipIcon(bought, null).profile), null);
  assert.equal(iconEquipped(equipIcon(equipIcon(bought, null).profile, '2026Q4::pumpkin').profile), '2026Q4::pumpkin');
  assert.equal(equipIcon(bought, '2026Q4::frost').ok, false);
});
