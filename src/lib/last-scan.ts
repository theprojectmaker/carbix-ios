import type { Box } from '@/lib/car-finder';

/**
 * The most recent scan's photo, kept so a catch can be re-identified ("not this car?") from the same full-size
 * picture instead of the small thumbnail that is saved with the catch. One slot, overwritten by the next scan.
 */
export type LastScan = { uri: string; width: number; height: number; where: Box | null; at: number };
let last: LastScan | null = null;

export const rememberScan = (s: LastScan) => { last = s; };
export const lastScan = (): LastScan | null => (last && Date.now() - last.at < 30 * 60 * 1000 ? last : null);
