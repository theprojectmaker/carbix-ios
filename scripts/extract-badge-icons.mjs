// Turns the web app's BADGE_ICONS pixel SVGs into rect data for react-native-svg.
import fs from 'node:fs';
const html = fs.readFileSync('../motordex/public/index.html', 'utf8');
const a = html.indexOf('const BADGE_ICONS={');
const b = html.indexOf('};', a) + 2;
const body = html.slice(a, b);
const out = {};
for (const m of body.matchAll(/([A-Z]+):'(<svg[\s\S]*?<\/svg>)'/g)) {
  out[m[1]] = [...m[2].matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[0-9A-Fa-f]+)"\/>/g)].map((r) => [+r[1], +r[2], +r[3], +r[4], r[5]]);
}
fs.writeFileSync('src/data/badgeIcons.json', JSON.stringify(out));
console.log(Object.keys(out).join(','));
