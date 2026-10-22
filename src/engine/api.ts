import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Car, CatalogEntry, Catch, Profile } from './types';

/** The live Carbix backend (domain kept as motordex.pages.dev; Pages projects can't be renamed). */
export const API_ORIGIN = 'https://motordex.pages.dev';
/** The website page that does Google sign-in in Safari and hands the account back with carbix://signed-in?code=... */
export const GOOGLE_SIGNIN_URL = API_ORIGIN + '/app-signin.html';
export const ICON_V = 8;

export const iconURL = (c: Pick<CatalogEntry, 'n' | 'make' | 'model' | 'years'>) =>
  `${API_ORIGIN}/api/icon?n=${c.n}&make=${encodeURIComponent(c.make)}&model=${encodeURIComponent(c.model)}` +
  `&years=${encodeURIComponent(c.years || '')}&v=${ICON_V}`;

type Json = Record<string, any>;

async function postJSON(path: string, body: unknown, timeoutMs = 60000): Promise<Json> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(API_ORIGIN + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    return (await r.json()) as Json;
  } finally {
    clearTimeout(t);
  }
}

async function getJSON(path: string, timeoutMs = 20000): Promise<Json> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(API_ORIGIN + path, { signal: ctl.signal });
    return (await r.json()) as Json;
  } finally {
    clearTimeout(t);
  }
}

/** Sends one photo to the server-side vehicle ID. The AI keys never leave the server. */
export async function identify(imageBase64: string, mimeType = 'image/jpeg'): Promise<
  { ok: true; car: Car } | { ok: false; error: string }
> {
  try {
    const j = await postJSON('/api/identify', { imageBase64, mimeType });
    if (j.ok && j.car) return { ok: true, car: j.car as Car };
    return { ok: false, error: String(j.error || 'Could not identify that.') };
  } catch {
    return { ok: false, error: 'Network error — check your connection and try again.' };
  }
}

export async function research(make: string, model: string, years?: string): Promise<Json | null> {
  try {
    const j = await postJSON('/api/research', { make, model, years });
    return j.ok ? j : null;
  } catch {
    return null;
  }
}

const LAST_LINK = 'motordex.native.lastlink';
const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Codes are single-use. If this phone already spent this very code in the last 10 minutes (a deep link and a typed code can
 *  both fire), hand back the same account instead of "already used". */
export async function redeemLinkCode(code: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const c = cleanCode(code);
  if (c.length !== 6) return { ok: false, error: 'Enter the 6-character code (letters and numbers).' };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const j = await postJSON('/api/link', { action: 'redeem', code: c }, 20000);
      if (j.ok && j.token) {
        AsyncStorage.setItem(LAST_LINK, JSON.stringify({ c, token: String(j.token), at: Date.now() })).catch(() => {});
        return { ok: true, token: String(j.token) };
      }
      try {
        const last = JSON.parse((await AsyncStorage.getItem(LAST_LINK)) || 'null') as { c: string; token: string; at: number } | null;
        if (last && last.c === c && Date.now() - last.at < 10 * 60 * 1000) return { ok: true, token: last.token };
      } catch {
        /* no memo */
      }
      if (attempt === 0 && String(j.error || '').toLowerCase().includes('expired')) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return { ok: false, error: String(j.error || "That code didn't work.") };
    }
    return { ok: false, error: 'Code expired or already used. Get a fresh one.' };
  } catch {
    return { ok: false, error: 'No connection. Check your internet and try again.' };
  }
}

export async function pullGarage(token: string): Promise<{ ok: boolean; data: Json | null }> {
  try {
    const j = await getJSON('/api/garage?token=' + encodeURIComponent(token));
    return { ok: !!j.ok, data: j.ok ? (j.data ?? null) : null };
  } catch {
    return { ok: false, data: null };
  }
}

export async function pushGarage(profile: Profile, garage: Catch[]): Promise<boolean> {
  try {
    const p = profile;
    const j = await postJSON('/api/garage', {
      token: p.token,
      data: {
        garage,
        profile: {
          username: p.username, displayName: p.displayName, lic: p.lic, issued: p.issued,
          friends: p.friends, stars: p.stars, days: p.days, bonusXP: p.bonusXP || 0, avatar: p.avatar || 0,
          targets: p.targets || 0, title: p.title || '', examDay: p.examDay || '', examLast: p.examLast || 0,
          examPerfect: p.examPerfect || 0, bestCombo: p.bestCombo || 0, shieldWeek: p.shieldWeek || '',
          rival: p.rival || '', spinDay: p.spinDay || '', spinLast: p.spinLast || 0, setsDone: p.setsDone || {},
          orbs: p.orbs || 0, questStep: p.questStep || 0, cosmetics: p.cosmetics || {},
          consumables: p.consumables || {}, questOverrides: p.questOverrides || {},
          nativeIcons: p.nativeIcons || {}, chapterBadges: p.chapterBadges || [],
          comingSoon: p.comingSoon || {}, summerTitlesOwned: p.summerTitlesOwned || [],
        },
      },
    });
    return !!j.ok;
  } catch {
    return false;
  }
}

export async function fetchFeed(): Promise<Json | null> {
  try {
    return await getJSON('/api/feed');
  } catch {
    return null;
  }
}

/** Merges a cloud save into local state. A pull may only ever add progress, never subtract it. */
export function mergeCloud(garage: Catch[], profile: Profile, d: Json): { garage: Catch[]; profile: Profile } {
  const have = new Set(garage.map((g) => g.id));
  const g2 = [...garage];
  if (Array.isArray(d.garage)) for (const g of d.garage as Catch[]) if (g && !have.has(g.id)) { g2.push(g); have.add(g.id); }
  g2.sort((a, b) => b.ts - a.ts);
  const p = (d.profile || {}) as Json;
  const out: Profile = { ...profile };
  if (p.username) { out.username = p.username; out.name = '@' + p.username; }
  if (p.displayName && (out.displayName === out.username || !out.displayName)) out.displayName = p.displayName;
  if (p.lic) out.lic = p.lic;
  if (p.issued) out.issued = p.issued;
  out.friends = [...new Set([...(out.friends || []), ...(p.friends || [])])];
  out.stars = [...new Set([...((out.stars as string[]) || []), ...(p.stars || [])])];
  out.days = [...new Set([...(out.days || []), ...(p.days || [])])];
  for (const k of ['bonusXP', 'targets', 'examPerfect', 'bestCombo', 'orbs', 'questStep']) {
    if (Number(p[k]) > Number(out[k] || 0)) out[k] = Number(p[k]);
  }
  if (p.avatar && !out.avatar) out.avatar = p.avatar;
  if (p.title && !out.title) out.title = p.title;
  if (p.rival && !out.rival) out.rival = p.rival;
  if (p.setsDone) out.setsDone = Object.assign({}, p.setsDone, out.setsDone || {});
  if (p.cosmetics) {
    const cos = { ...((out.cosmetics as Json) || {}) };
    for (const track of ['profile', 'lb', 'logo', 'mappin', 'effect']) {
      const key = track + 'Owned';
      cos[key] = [...new Set([...(cos[key] || []), ...(p.cosmetics[key] || [])])];
      if (!cos[track] && p.cosmetics[track]) cos[track] = p.cosmetics[track];
    }
    out.cosmetics = cos;
  }
  // the rest of what the web's pullCloud carries, so a signed-in account comes over complete
  if (p.consumables) {
    const c = { ...((out.consumables as Json) || {}) };
    for (const k of Object.keys(p.consumables)) if (Number(p.consumables[k]) > Number(c[k] || 0)) c[k] = Number(p.consumables[k]);
    out.consumables = c as Profile["consumables"];
  }
  if (p.questOverrides) {
    const q = { ...((out.questOverrides as Json) || {}) };
    for (const sk of Object.keys(p.questOverrides)) q[sk] = Object.assign({}, p.questOverrides[sk], q[sk] || {});
    out.questOverrides = q;
  }
  if (p.nativeIcons) {
    const n = (out.nativeIcons as Json) || { owned: [], equipped: null };
    out.nativeIcons = { owned: [...new Set([...(n.owned || []), ...(p.nativeIcons.owned || [])])], equipped: n.equipped || p.nativeIcons.equipped || null };
  }
  if (p.examDay && (!out.examDay || p.examDay > out.examDay)) { out.examDay = p.examDay; out.examLast = Number(p.examLast) || 0; }
  if (p.spinDay && (!out.spinDay || p.spinDay > out.spinDay)) { out.spinDay = p.spinDay; out.spinLast = Number(p.spinLast) || 0; }
  if (p.shieldWeek && (!out.shieldWeek || p.shieldWeek > out.shieldWeek)) out.shieldWeek = p.shieldWeek;
  if (p.chapterBadges) out.chapterBadges = [...new Set([...((out.chapterBadges as string[]) || []), ...p.chapterBadges])];
  if (p.summerTitlesOwned) out.summerTitlesOwned = [...new Set([...((out.summerTitlesOwned as string[]) || []), ...p.summerTitlesOwned])];
  if (p.comingSoon) {
    const cs = { mapPin: [], deckBack: [], catchEffect: [], ...((out.comingSoon as Json) || {}) } as Json;
    for (const kind of ['mapPin', 'deckBack', 'catchEffect']) {
      const have = cs[kind] || [];
      const seen = new Set(have.map((x: Json) => x.id));
      cs[kind] = have.concat((p.comingSoon[kind] || []).filter((x: Json) => !seen.has(x.id)));
    }
    out.comingSoon = cs;
  }
  return { garage: g2, profile: out };
}

export async function fetchLeaderboard(): Promise<Json[]> {
  try {
    const j = await getJSON('/api/profile');
    return j.ok && Array.isArray(j.profiles) ? (j.profiles as Json[]) : [];
  } catch {
    return [];
  }
}

/** Publishes the public numbers other spotters see on the board (no photos, no location). */
export async function pushPublicRow(row: Record<string, unknown>): Promise<boolean> {
  try {
    const j = await postJSON('/api/profile', row, 15000);
    return !!j.ok;
  } catch {
    return false;
  }
}

/* ---------- friends ---------- */
export type RaceInvite = { from: string; code: string; ts: number };
export type FriendState = { friends: string[]; incoming: { name: string }[]; outgoing: string[]; invites: RaceInvite[] };
export async function friendsGet(token: string): Promise<FriendState | null> {
  try {
    const j = await getJSON('/api/friends?token=' + encodeURIComponent(token), 15000);
    if (!j.ok) return null;
    return { friends: j.friends || [], incoming: j.incoming || [], outgoing: j.outgoing || [], invites: j.invites || [] };
  } catch {
    return null;
  }
}
export async function friendAction(token: string, name: string, body: Json): Promise<Json> {
  try {
    return await postJSON('/api/friends', { token, name, ...body }, 15000);
  } catch {
    return { ok: false, error: 'Network error — try again.' };
  }
}

/* ---------- live races ---------- */
export type RaceMode = 'xp' | 'scavenger' | 'elimination';
export type RacePlayer = { name: string; xp: number; caught: number; host?: boolean; you?: boolean; boxes?: string[]; out?: boolean };
export type Race = {
  code: string;
  mode: RaceMode;
  durationMin: number;
  status: 'lobby' | 'running' | 'finished';
  startTs: number | null;
  endTs: number | null;
  winnerName: string | null;
  finishedBy: string | null;
  players: RacePlayer[];
  catches: { name: string; make: string; model: string; rarity: string; xp: number; ts: number }[];
  you: { host: boolean; in: boolean } | null;
  sheet?: { id: string; label: string; hard?: boolean }[];
  nextCutTs?: number | null;
};
export type RaceResult = { ok: boolean; race?: Race; error?: string; ticked?: string[]; duplicate?: boolean; eliminated?: boolean };

async function racePost(body: Json): Promise<RaceResult> {
  try {
    const j = await postJSON('/api/race', body, 20000);
    return { ok: !!j.ok, race: j.race as Race | undefined, error: j.error, ticked: j.ticked, duplicate: j.duplicate, eliminated: j.eliminated };
  } catch {
    return { ok: false, error: 'Network error — try again.' };
  }
}

export const raceCreate = (token: string, name: string, mode: RaceMode, durationMin: number) =>
  racePost({ action: 'create', token, name, mode, durationMin });
export const raceJoin = (token: string, name: string, code: string) => racePost({ action: 'join', token, name, code });
export const raceStart = (token: string, name: string, code: string) => racePost({ action: 'start', token, name, code });
export const raceScore = (token: string, name: string, code: string, xp: number, car: Json, geo: { lat: number; lng: number } | null) =>
  racePost({ action: 'score', token, name, code, xp, car, geo });

export async function raceGet(code: string, token: string): Promise<RaceResult> {
  try {
    const j = await getJSON(`/api/race?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`, 15000);
    return { ok: !!j.ok, race: j.race as Race | undefined, error: j.error };
  } catch {
    return { ok: false, error: 'Network error — try again.' };
  }
}

/* ---------- live sessions (casual "see what friends catch", no timer, no score) ---------- */
export type LiveSession = {
  code: string;
  host: string;
  players: { name: string; joinedTs: number; lastRarity: string | null }[];
  catches: { name: string; photo?: string | null; rarity: string; make: string; model: string; ts: number }[];
  jackpotTs?: number;
};
export type LiveResult = { ok: boolean; live?: LiveSession; error?: string };

async function livePost(body: Json): Promise<LiveResult> {
  try {
    const j = await postJSON('/api/live', body, 20000);
    return { ok: !!j.ok, live: j.live as LiveSession | undefined, error: j.error };
  } catch {
    return { ok: false, error: 'Network error — try again.' };
  }
}
export const liveCreate = (token: string, name: string) => livePost({ action: 'create', token, name });
export const liveJoin = (token: string, name: string, code: string) => livePost({ action: 'join', token, name, code });
export const liveLeave = (token: string, name: string, code: string) => livePost({ action: 'leave', token, name, code });
export const liveCatch = (token: string, name: string, code: string, car: Json, photo: string | null) =>
  livePost({ action: 'catch', token, name, code, car, photo });
export async function liveGet(code: string): Promise<LiveResult> {
  try {
    const j = await getJSON('/api/live?code=' + encodeURIComponent(code), 15000);
    return { ok: !!j.ok, live: j.live as LiveSession | undefined, error: j.error };
  } catch {
    return { ok: false, error: 'Network error — try again.' };
  }
}

/* ---------- clubs (20-spotter teams) and the weekly league ---------- */
export type Club = { code: string; name: string; members: { name: string }[] | string[]; count: number };
export async function clubPost(token: string, name: string, body: Json): Promise<{ ok: boolean; club?: Club; error?: string }> {
  try {
    const j = await postJSON('/api/clubs', { token, name, ...body }, 15000);
    return { ok: !!j.ok, club: j.club as Club | undefined, error: j.error };
  } catch {
    return { ok: false, error: 'Network error — try again.' };
  }
}
export async function clubGet(code: string): Promise<{ ok: boolean; club?: Club; error?: string }> {
  try {
    const j = await getJSON('/api/clubs?code=' + encodeURIComponent(code), 15000);
    return { ok: !!j.ok, club: j.club as Club | undefined, error: j.error };
  } catch {
    return { ok: false, error: 'Network error — try again.' };
  }
}
export type LeagueMember = Record<string, any>;
export type League = {
  week: string; endsTs: number; tiers: string[]; myDivision: string | null; myTier: string | null;
  divisions: { id: string; tier: string; members: LeagueMember[]; up: number; down: number }[];
  prev: { week: string; myTier: string; myRank: number; myXp: number; myMoved: string } | null;
};
export async function leagueGet(token: string): Promise<League | null> {
  try {
    const j = await getJSON('/api/league?token=' + encodeURIComponent(token), 15000);
    return j.ok ? (j.league as League) : null;
  } catch {
    return null;
  }
}

/* ---------- username + password accounts ---------- */
export async function usernameAvailable(name: string): Promise<{ ok: boolean; available?: boolean; error?: string }> {
  try {
    const j = await getJSON('/api/account?name=' + encodeURIComponent(name), 15000);
    return { ok: !!j.ok, available: j.available, error: j.error };
  } catch {
    return { ok: false, error: 'NETWORK ERROR. TRY AGAIN.' };
  }
}
export async function accountAuth(
  action: 'register' | 'login', username: string, password: string, token: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    const j = await postJSON('/api/account', { action, username, password, token }, 20000);
    return { ok: !!j.ok, token: j.token, error: j.error };
  } catch {
    return { ok: false, error: 'NETWORK ERROR. TRY AGAIN.' };
  }
}
