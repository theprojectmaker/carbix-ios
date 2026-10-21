// Pulls the car catalog + generations out of the live web app source into JSON the native app bundles.
import fs from 'node:fs'; import vm from 'node:vm';
const src = '../motordex/public/';
const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ['catalog.js', 'generations.js']) vm.runInContext(fs.readFileSync(src + f, 'utf8'), ctx);
const w = ctx.window;
fs.writeFileSync('src/data/catalogRaw.json', JSON.stringify(w.CATALOG_RAW));
fs.writeFileSync('src/data/hidden.json', JSON.stringify(w.CATALOG_HIDDEN || []));
fs.writeFileSync('src/data/generations.json', JSON.stringify(ctx.GENERATIONS || w.GENERATIONS || {}));
console.log('cars', w.CATALOG_RAW.length, 'hidden', (w.CATALOG_HIDDEN || []).length);
