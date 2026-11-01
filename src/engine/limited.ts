import limited from '../data/limited.json';
import { norm } from './catalog';
import { catalogMatch } from './data';
import type { Car } from './types';

/** How many were built, by "make|model" (normalised the same way the catalog matches names). */
const BUILT = new Map<string, number>(
  Object.entries(limited as Record<string, number>).map(([k, v]) => {
    const [make, ...rest] = k.split('|');
    return [norm(make) + '|' + norm(rest.join('|')), v];
  }),
);

export type LimitedInfo = {
  built: number;
  /** 15 or fewer exist: the GRAIL end of the Bix */
  grail: boolean;
  /** the badge text: "ONE OF ONE", "1 OF 4", "ONLY 200 BUILT" */
  label: string;
};

export const GRAIL_MAX = 15;
export const LIMITED_MAX = 1000;

export function builtOf(make: string, model: string): number | undefined {
  return BUILT.get(norm(make) + '|' + norm(model));
}

/** Production badge for a car, or null when it is not a limited run (or the number is not known). */
export function limitedInfo(car: Pick<Car, 'make' | 'model'>): LimitedInfo | null {
  const e = catalogMatch(car);
  const built = (e && builtOf(e.make, e.model)) ?? builtOf(car.make, car.model);
  if (!built || built > LIMITED_MAX) return null;
  const grail = built <= GRAIL_MAX;
  return { built, grail, label: built === 1 ? 'ONE OF ONE' : grail ? `1 OF ${built}` : `ONLY ${built} BUILT` };
}
