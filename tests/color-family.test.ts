import assert from 'node:assert/strict';
import test from 'node:test';
import { carColorFamily } from '../src/engine/quests';

const car = (color: string, colorHex?: string) => ({ make: 'X', model: 'Y', rarity: 'Common', color, colorHex }) as any;

test('warm neutrals and browns are not Orange', () => {
  assert.notEqual(carColorFamily(car('Sand', '#d2b48c')), 'Orange');      // tan
  assert.notEqual(carColorFamily(car('Sienna', '#8b4513')), 'Orange');    // saddle brown
  assert.notEqual(carColorFamily(car('Copper', '#b87333')), 'Orange');
  assert.notEqual(carColorFamily(car('Cream', '#f3e5c0')), 'Orange');
  assert.notEqual(carColorFamily(car('Burnt Umber', '#8a3324')), 'Orange');
  assert.equal(carColorFamily(car('Rosso Corsa', '#d40000')), 'Red');
});

test('real oranges still count', () => {
  assert.equal(carColorFamily(car('Papaya', '#ff8700')), 'Orange');
  assert.equal(carColorFamily(car('Orange', '#8a92a8')), 'Orange');
  assert.equal(carColorFamily(car('Lava Orange', '#e8761c')), 'Orange');
  assert.equal(carColorFamily(car('Tangerine Scream', '#f28c28')), 'Orange');
});

test('a named colour wins over the hex', () => {
  assert.equal(carColorFamily(car('Red', '#ff8700')), 'Red');
  assert.equal(carColorFamily(car('Midnight Blue', '#1a1a2e')), 'Blue');
});
