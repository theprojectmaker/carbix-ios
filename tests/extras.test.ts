import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { CATALOG } from '../src/engine/data';
import { examQuestions, lineagePlaques, marqueMedals, SETS, setProgress } from '../src/engine/extras';
import type { Catch } from '../src/engine/types';

const html = fs.readFileSync('../motordex/public/index.html', 'utf8');
const slice = (from: string, to: string) => {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  assert.ok(a > 0 && b > a, `${from} -> ${to}`);
  return html.slice(a, b);
};

function web(day: string, garage: Catch[]) {
  const ctx: any = { Intl, Math, Set, Map, Object, Array, JSON, String, Number, parseInt, parseFloat, RegExp, console, window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('../motordex/public/catalog.js', 'utf8'), ctx);
  ctx.garage = JSON.parse(JSON.stringify(garage));
  const code = [
    slice('const RMAP=', '/* the researched catalog is the authority'),
    slice('const norm=(s)=>', '/* popularity'),
    slice('function catalogMatch(car){', 'const catchesFor='),
    `const dateKeyET=()=>${JSON.stringify(day)};`,
    slice('function dayRand(salt){', 'function openExam'),
    slice('const SETS=[', 'function openSets'),
    slice('function marqueMedals(){', '/* Marque medallions pay'),
    slice('function lineagePlaques(){', 'function seasonCheck'),
    'globalThis.__o={exam:examQuestions().map(q=>({c:q.c.n,o:q.opts.map(x=>x.n)})),sets:setProgress(),med:marqueMedals(),lin:lineagePlaques()};',
  ].join('\n');
  vm.runInContext(code, ctx);
  return JSON.parse(JSON.stringify(ctx.__o));
}

const mkGarage = (): Catch[] => {
  const picks = CATALOG.filter((c) => c.make === 'Porsche' || c.make === 'Ferrari' || c.make === 'Tesla').slice(0, 30);
  return picks.map((c, i) => ({ id: i + 1, ts: 1, car: { make: c.make, model: c.model, rarity: c.rarity } } as Catch));
};

test('exam questions equal the web exam on several days', () => {
  for (const day of ['2026-10-18', '2026-11-02', '2027-01-01']) {
    const w = web(day, []);
    const mine = examQuestions(day).map((q) => ({ c: q.c.n, o: q.opts.map((x) => x.n) }));
    assert.equal(JSON.stringify(mine), JSON.stringify(w.exam), day);
  }
});

test('collection sets, marque medals and lineage plaques equal the web app', () => {
  const g = mkGarage();
  const w = web('2026-10-18', g);
  assert.equal(JSON.stringify(setProgress(g)), JSON.stringify(w.sets));
  assert.equal(SETS.length, w.sets.length);
  assert.equal(JSON.stringify(marqueMedals(g)), JSON.stringify(w.med));
  assert.equal(JSON.stringify(lineagePlaques(g)), JSON.stringify(w.lin));
});
