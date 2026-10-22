import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { mergeCloud, pullGarage, pushGarage, pushPublicRow, redeemLinkCode } from '@/engine/api';
import { publicRow, withRollovers } from '@/engine/publish';
import { catalogMatch, CATALOG } from '@/engine/data';
import {
  dateKeyET as todayKey, KEYS, loadAll, markDay, normalizeGarage, newProfile, normalizeProfile, saveAll, shinyRoll, streak, totalXp,
} from '@/engine/store';
import type { Car, Catch, Profile } from '@/engine/types';
import { googleSignInCode } from '@/lib/google-signin';
import { play, setSfxVolume, setSilentMute } from '@/lib/sfx';
import { catchBonuses, evalChallenges, nextCombo } from '@/engine/daily';
import { trophyCheck } from '@/engine/extras';
import { advanceQuests, type QuestEvent } from '@/engine/quests';
import { buyIcon, equipIcon } from '@/engine/appicons';
import { buyItem, equipItem, type Track } from '@/engine/shop';
import { currentSeason } from '@/engine/quests';
import { wearIcon } from '@/lib/appicon';
import { levelFor, rankFor, xpForLevel } from '@/engine/xp';

export type Settings = { cool: boolean; sfx: number; haptics: boolean; theme: 'light' | 'dark'; callshot: boolean; silentMute: boolean; feedShare: boolean };
const SETTINGS_KEY = 'motordex.native.settings';
const DEFAULT_SETTINGS: Settings = { cool: true, sfx: 1, haptics: true, theme: 'light', callshot: false, silentMute: true, feedShare: true };

type Game = {
  ready: boolean;
  garage: Catch[];
  profile: Profile;
  settings: Settings;
  xp: number;
  level: number;
  rank: string;
  nextLevelXp: number;
  prevLevelXp: number;
  streak: number;
  bixPct: number;
  caughtNs: Set<number>;
  toast: string;
  notify: (msg: string) => void;
  shopBuy: (track: Track, id: string) => boolean;
  shopEquip: (track: Track, id: string) => void;
  iconBuy: (seasonKey: string, id: string) => Promise<{ ok: boolean; message: string }>;
  iconWear: (owned: string | null) => Promise<{ ok: boolean; message: string }>;
  quests: () => ReturnType<typeof questsView>;
  addCatch: (car: Car, photo: string | null, geo?: { lat: number; lng: number } | null) => Catch;
  removeCatch: (id: number) => void;
  setSettings: (s: Partial<Settings>) => void;
  setUsername: (name: string) => void;
  toggleStar: (n: number) => boolean;
  patchProfile: (fn: (p: Profile) => Profile) => void;
  restore: (garage: Catch[], profile: Profile) => void;
  linkAccount: (token: string) => Promise<{ ok: boolean; added: number }>;
  recalcScore: () => void;
  googleSignIn: () => Promise<{ ok: boolean; error?: string }>;
  syncState: string;
};

function questsView(garage: Catch[], profile: Profile) {
  return advanceQuests(garage, profile);
}

function describe(e: QuestEvent): string {
  if (e.type === 'progress') return `${e.have}/${e.need} — ${e.title}`;
  if (e.type === 'complete') return `QUEST ${e.step} COMPLETE — +${e.xp} XP · +${e.orbs} ORBS`;
  return e.label.includes('—') || e.label.includes('+') || e.label.includes('×') ? e.label : `CHAPTER COMPLETE - ${e.label}`;
}

const Ctx = createContext<Game | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [garage, setGarage] = useState<Catch[]>([]);
  const [profile, setProfile] = useState<Profile>(() => normalizeProfile(null));
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [syncState, setSyncState] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((events: QuestEvent[]) => {
    if (!events.length) return;
    setToast(events.map(describe).join(' | '));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);
  const latest = useRef({ garage, profile });
  useEffect(() => {
    latest.current = { garage, profile };
  }, [garage, profile]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadAll(AsyncStorage);
      try {
        const s = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) || 'null');
        if (s) setSettingsState({ ...DEFAULT_SETTINGS, ...s });
      } catch {}
      const q = advanceQuests(loaded.garage, loaded.profile);
      latest.current = { garage: loaded.garage, profile: q.profile };
      setGarage(loaded.garage);
      setProfile(q.profile);
      setReady(true);
      if (loaded.profile.googleLinked) {
        const r = await pullGarage(loaded.profile.token);
        if (r.ok && r.data) {
          const m = mergeCloud(loaded.garage, loaded.profile, r.data);
          latest.current = { garage: m.garage, profile: m.profile };
          setGarage(m.garage);
          setProfile(m.profile);
        }
      }
    })();
  }, []);

  useEffect(() => {
    setSfxVolume(settings.sfx);
  }, [settings.sfx]);

  useEffect(() => {
    setSilentMute(settings.silentMute !== false);
  }, [settings.silentMute]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const shopBuy = useCallback((track: Track, id: string) => {
    const r = buyItem(latest.current.profile, track, id);
    if (r.ok) {
      latest.current = { ...latest.current, profile: r.profile };
      setProfile(r.profile);
    }
    flash(r.ok ? 'BOUGHT — ' + r.message : r.message);
    return r.ok;
  }, [flash]);

  const shopEquip = useCallback((track: Track, id: string) => {
    const r = equipItem(latest.current.profile, track, id);
    if (r.ok) {
      latest.current = { ...latest.current, profile: r.profile };
      setProfile(r.profile);
    }
    flash(r.message);
  }, [flash]);

  /** Both icon calls RETURN what happened so the shop can print it on its own screen (the shop is a pop-up and hides toasts). */
  const iconWear = useCallback(async (owned: string | null) => {
    const r = equipIcon(latest.current.profile, owned);
    if (!r.ok) return { ok: false, message: r.message };
    latest.current = { ...latest.current, profile: r.profile };
    setProfile(r.profile);
    const w = await wearIcon(owned ? owned.split('::')[1] : null);
    return w.ok
      ? { ok: true, message: 'HOME SCREEN ICON IS NOW ' + w.detail }
      : { ok: false, message: 'SAVED, BUT THE HOME SCREEN DID NOT CHANGE. ' + w.detail };
  }, []);

  const iconBuy = useCallback(async (seasonKey: string, id: string) => {
    const r = buyIcon(latest.current.profile, seasonKey, currentSeason().key, id);
    if (!r.ok) return { ok: false, message: r.message };
    latest.current = { ...latest.current, profile: r.profile };
    setProfile(r.profile);
    const w = await wearIcon(id);
    return {
      ok: true,
      message: w.ok ? r.message + '. HOME SCREEN ICON IS NOW ' + w.detail : r.message + ', BUT THE HOME SCREEN DID NOT CHANGE. ' + w.detail,
    };
  }, []);

  // publish the public leaderboard row (numbers only) shortly after anything changes
  const pubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publish = useCallback(() => {
    if (pubTimer.current) clearTimeout(pubTimer.current);
    pubTimer.current = setTimeout(() => {
      const { garage: gg, profile: pp } = latest.current;
      const rolled = withRollovers(pp);
      const a = rolled.seasonBase as { key: string } | undefined;
      const b = pp.seasonBase as { key: string } | undefined;
      const c = (rolled.weekBase as { key: string } | undefined)?.key;
      const d = (pp.weekBase as { key: string } | undefined)?.key;
      if (a?.key !== b?.key || c !== d) setProfile(rolled);
      // The server keeps the HIGHER of old and new numbers, so one inflated push (an old merge, a bad import) sticks forever.
      // reset:true tells it this push is deliberate. Done once after this update, and any time RECALCULATE MY SCORE is pressed.
      const reset = gg.length > 0 && rolled.scoreFix !== 'v2';
      pushPublicRow({ ...publicRow(gg, rolled), ...(reset ? { reset: true } : {}) })
        .then((ok) => {
          if (ok && reset) {
            const np = { ...latest.current.profile, scoreFix: 'v2' };
            latest.current = { ...latest.current, profile: np };
            setProfile(np);
          }
        })
        .catch(() => {});
    }, 2500);
  }, []);

  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { garage: g, profile: p } = latest.current;
      saveAll(AsyncStorage, g, p).catch(() => {});
    }, 300);
    if (cloudTimer.current) clearTimeout(cloudTimer.current);
    cloudTimer.current = setTimeout(async () => {
      const { garage: g, profile: p } = latest.current;
      if (!p.googleLinked) return;
      const ok = await pushGarage(p, g);
      setSyncState(ok ? 'SAVED' : 'OFFLINE — SAVED ON THIS DEVICE ONLY');
    }, 3000);
  }, []);

  useEffect(() => {
    if (ready) {
      persist();
      publish();
    }
  }, [garage, profile, ready, persist, publish]);

  const addCatch = useCallback((car: Car, photo: string | null, geo?: { lat: number; lng: number } | null) => {
    const now = Date.now();
    const entry: Catch = { id: now, ts: now, car, photo, geo: geo ?? null, shiny: shinyRoll() };
    const p0 = latest.current.profile;
    const nextGarage = [entry, ...latest.current.garage];
    const np: Profile = { ...latest.current.profile, days: [...latest.current.profile.days] };
    const firstToday = !np.days.includes(todayKey());
    markDay(np);
    const combo = nextCombo(np.combo as { ts: number; n: number } | undefined, now);
    np.combo = combo;
    const hitN = catalogMatch(car);
    const starred = !!hitN && ((np.stars as number[]) || []).includes(hitN.n);
    if (starred) np.targets = ((np.targets as number) || 0) + 1;
    const bonuses = catchBonuses(CATALOG, car, { shiny: !!entry.shiny, firstToday, hit: hitN, comboN: combo.n, starred });
    for (const b of bonuses) {
      np.bonusXP = (np.bonusXP || 0) + b.xp;
      if (b.orbs) np.orbs = ((np.orbs as number) || 0) + b.orbs;
    }
    const ch = evalChallenges(nextGarage, np);
    const r0 = advanceQuests(nextGarage, ch.profile);
    const tr = trophyCheck(nextGarage, r0.profile);
    const r = { ...r0, profile: tr.profile };
    latest.current = { garage: nextGarage, profile: r.profile };
    setGarage(nextGarage);
    setProfile(r.profile);
    const lines = [...bonuses.filter((b) => b.label !== 'SHINY').map((b) => b.label), ...ch.won.map((c) => c.label + ' +' + c.xp + ' XP'), ...tr.events];
    if (entry.shiny) lines.unshift('SHINY - +17 XP, +5 ORBS');
    if (levelFor(totalXp(nextGarage, r.profile)) > levelFor(totalXp(latest.current.garage.slice(1), p0))) play('levelup');
    else if (r.events.some((e) => e.type === 'complete') || ch.won.length) play('streak');
    if (lines.length) say([...lines.map((l) => ({ type: 'chapter', label: l }) as QuestEvent), ...r.events]);
    else say(r.events);
    return entry;
  }, [say]);

  const removeCatch = useCallback((id: number) => {
    play('trash');
    setGarage((g) => g.filter((c) => c.id !== id));
  }, []);

  const setSettings = useCallback((s: Partial<Settings>) => {
    setSettingsState((cur) => {
      const next = { ...cur, ...s };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setUsername = useCallback((name: string) => {
    const clean = name.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    if (!clean) return;
    // update the ref in the same breath: patchProfile reads it, and a stale copy used to wipe the new name
    const next = { ...latest.current.profile, username: clean, displayName: clean, name: '@' + clean };
    latest.current = { ...latest.current, profile: next };
    setProfile(next);
  }, []);

  const toggleStar = useCallback((n: number) => {
    const cur = ((latest.current.profile.stars as number[]) || []);
    const on = !cur.includes(n);
    const next = on ? [...cur, n] : cur.filter((x) => x !== n);
    const withStars = { ...latest.current.profile, stars: next };
    latest.current = { ...latest.current, profile: withStars };
    setProfile(withStars);
    play(on ? 'star-on' : 'star-off');
    return on;
  }, []);

  const recalcScore = useCallback(() => {
    const np = { ...latest.current.profile, scoreFix: '' };
    latest.current = { ...latest.current, profile: np };
    setProfile(np);
  }, []);

  const patchProfile = useCallback((fn: (p: Profile) => Profile) => {
    const next = fn(latest.current.profile);
    latest.current = { ...latest.current, profile: next };
    setProfile(next);
  }, []);

  const restore = useCallback((g: Catch[], p: Profile) => {
    const ng = normalizeGarage(g);
    const np = normalizeProfile(p);
    latest.current = { garage: ng, profile: np };
    setGarage(ng);
    setProfile(np);
  }, []);

  const linkAccount = useCallback(async (token: string) => {
    try {
    const r = await pullGarage(token, true);
    if (!r.ok) return { ok: false, added: 0 };
    const before = latest.current.garage.length;
    // Signing in means BECOMING that account: start from a clean slate and take the cloud save as is. Merging it into
    // whatever this phone had (test scans, a placeholder "spotter") is what inflated XP and kept the wrong name.
    // The old local copy is kept under one key in case it is ever wanted back.
    const hasCloud = !!(r.data && Array.isArray((r.data as { garage?: unknown }).garage));
    if (hasCloud && latest.current.garage.length) {
      AsyncStorage.setItem('motordex.native.prelink', JSON.stringify({ at: Date.now(), garage: latest.current.garage, profile: latest.current.profile })).catch(() => {});
    }
    const fresh = normalizeProfile({ ...newProfile(), token, googleLinked: true, lastCloudSave: 0, onboarded: true, termsAccepted: latest.current.profile.termsAccepted });
    const base = hasCloud ? fresh : { ...latest.current.profile, token, googleLinked: true, lastCloudSave: 0 };
    const merged = r.data ? mergeCloud(hasCloud ? [] : latest.current.garage, base, r.data) : { garage: latest.current.garage, profile: base };
    const m = { garage: normalizeGarage(merged.garage), profile: merged.profile };
    // the ref must hold the linked account BEFORE anything else reads it (the sign-in screens call patchProfile right after);
    // otherwise the old local profile gets written back over the account that was just linked
    let linked = { ...m.profile, token, googleLinked: true, scoreFix: '' };
    // a save pushed by a brand-new device can carry the placeholder name; the public profile row knows the real one
    if (r.name && (!linked.username || linked.username === 'spotter')) {
      const nm = String(r.name).replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
      if (nm) linked = { ...linked, username: nm, displayName: nm, name: '@' + nm };
    }
    latest.current = { garage: m.garage, profile: linked };
    setGarage(m.garage);
    setProfile(linked);
    return { ok: true, added: m.garage.length - before };
    } catch {
      return { ok: false, added: 0 };
    }
  }, []);

  /** Google sign-in in a pop-up sheet; no code to type. Returns an on-screen error message if anything fails. */
  const googleSignIn = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const s = await googleSignInCode();
      if (!s.ok) return { ok: false, error: s.error };
      const r = await redeemLinkCode(s.code);
      if (!r.ok) return { ok: false, error: r.error.toUpperCase() };
      const res = await linkAccount(r.token);
      if (!res.ok) return { ok: false, error: 'SIGNED IN, BUT YOUR GARAGE DID NOT DOWNLOAD. CHECK YOUR CONNECTION AND TRY AGAIN.' };
      patchProfile((p) => ({ ...p, onboarded: true, googleLinked: true, termsAccepted: p.termsAccepted || new Date().toISOString() }));
      play('levelup');
      return { ok: true };
    } catch {
      return { ok: false, error: 'SOMETHING WENT WRONG SIGNING IN. TRY AGAIN.' };
    }
  }, [linkAccount, patchProfile]);

  const value = useMemo<Game>(() => {
    const xp = totalXp(garage, profile);
    const level = levelFor(xp);
    const caught = new Set<number>();
    for (const g of garage) {
      const h = catalogMatch(g.car);
      if (h) caught.add(h.n);
    }
    return {
      ready, garage, profile, settings, xp, level, rank: rankFor(level),
      nextLevelXp: xpForLevel(level + 1), prevLevelXp: xpForLevel(level),
      streak: streak(profile), bixPct: CATALOG.length ? (caught.size / CATALOG.length) * 100 : 0,
      toast, notify: flash, shopBuy, shopEquip, iconBuy, iconWear, quests: () => questsView(garage, profile), caughtNs: caught, addCatch, removeCatch, setSettings, setUsername, toggleStar, patchProfile, restore, linkAccount, recalcScore, googleSignIn, syncState,
    };
  }, [ready, garage, profile, settings, toast, flash, shopBuy, shopEquip, iconBuy, iconWear, addCatch, removeCatch, setSettings, setUsername, toggleStar, patchProfile, restore, linkAccount, recalcScore, googleSignIn, syncState]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): Game {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGame outside GameProvider');
  return v;
}

export { KEYS };
