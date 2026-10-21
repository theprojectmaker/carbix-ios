import type { Car } from './types';

/** Great Neck NY daylight table (month -> [sunriseH, sunsetH]); same numbers as the web app. */
const SUN_TABLE = [[7, 17], [7, 17], [6, 19], [6, 19], [6, 20], [5, 20], [6, 20], [6, 20], [7, 19], [7, 18], [7, 17], [7, 16]];

export function lightContext(d = new Date()): 'night' | 'golden' | 'day' {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(d)) % 24;
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'numeric' }).format(d)) - 1;
  const [sr, ss] = SUN_TABLE[month];
  if (h < sr || h >= ss + 1) return 'night';
  if (h === sr || h === ss) return 'golden';
  return 'day';
}

export const CRYPTIDS = [
  'PT CRUISER', 'AZTEK', 'MULTIPLA', 'HHR', 'CROSSCABRIOLET', 'ELEMENT', 'CUBE', 'PROWLER', 'SSR', 'X-90',
  'THUNDERBIRD RETRO', 'GREMLIN', 'PACER', 'EDSEL', 'AMPHICAR', 'ISETTA',
];
export const isCryptid = (car: Pick<Car, 'model'>) =>
  CRYPTIDS.some((c) => String(car.model || '').toUpperCase().includes(c));

/** Stamps the scan-time context onto a fresh catch (golden hour, night, twin spot, clean shot, cryptid). */
export function stampCatchContext(car: Car, now = new Date()): Car {
  const lc = lightContext(now);
  if (lc === 'golden') car.golden = true;
  if (lc === 'night') car.nightCatch = true;
  if (Number(car.duplicatesInFrame) >= 2) car.twinSpot = true;
  if (car.box && car.box.w > 0) {
    const cx = car.box.x + car.box.w / 2;
    const cy = car.box.y + car.box.h / 2;
    const area = car.box.w * car.box.h;
    if (Math.abs(cx - 0.5) < 0.12 && Math.abs(cy - 0.5) < 0.18 && area > 0.22 && area < 0.85) car.cleanShot = true;
  }
  if (isCryptid(car)) car.cryptid = true;
  return car;
}
