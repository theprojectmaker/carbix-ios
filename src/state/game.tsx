import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { mergeCloud, pullGarage, pushGarage, pushPublicRow } from '@/engine/api';
import { publicRow, withRollovers } from '@/engine/publish';
import { catalogMatch, CATALOG } from '@/engine/data';
import {
  dateKeyET as todayKey, KEYS, loadAll, markDay, normalizeGarage, normalizeProfile, saveAll, shinyRoll, streak, totalXp,
} from '@/engine/store';
import type { Car, Catch, Profile } from '@/engine/types';
import { play, setSfxVolume } from '@/lib/sfx';
import { catchBonuses, evalChallenges, nextCombo } from '@/engine/daily';
import { trophyCheck } from '@/engine/extras';
import { advanceQuests, type QuestEvent } from '@/engine/quests';
import { buyItem, equipItem, type Track } from '@/engine/shop';
import { levelFor, rankFor, xpForLevel } from '@/engine/xp';

export type Settings = { cool: boolean; sfx: number; haptics: boolean; theme: 'light' | 'dark'; callshot: boolean };
const SETTINGS_KEY = 'motordex.native.settings';
const DEFAULT_SETTINGS: Settings = { cool: true, sfx: 1, haptics: true, theme: 'light', callshot: false };

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
  quests: () => ReturnType<typeof questsView>;
  addCatch: (car: Car, photo: string | null, geo?: { lat: number; lng: number } | null) => Catch;
  removeCatch: (id: number) => void;
  setSettings: (s: Partial<Settings>) => void;
  setUsername: (name: string) => void;
  toggleStar: (n: number) => boolean;
  patchProfile: (fn: (p: Profile) => Profile) => void;
  restore: (garage: Catch[], profile: Profile) => void;
  linkAccount: (token: string) => Promise<{ ok: boolean; added: number }>;
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
          setGarage(m.garage);
          setProfile(m.profile);
        }
      }
    })();
  }, []);

  useEffect(() => {
    setSfxVolume(settings.sfx);
  }, [settings.sfx]);

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
      pushPublicRow(publicRow(gg, rolled)).catch(() => {});
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
    setProfile((p) => ({ ...p, username: clean, displayName: clean, name: '@' + clean }));
  }, []);

  const toggleStar = useCallback((n: number) => {
    const cur = ((latest.current.profile.stars as number[]) || []);
    const on = !cur.includes(n);
    const next = on ? [...cur, n] : cur.filter((x) => x !== n);
    setProfile((p) => ({ ...p, stars: next }));
    play(on ? 'star-on' : 'star-off');
    return on;
  }, []);

  const patchProfile = useCallback((fn: (p: Profile) => Profile) => {
    const next = fn(latest.current.profile);
    latest.current = { ...latest.current, profile: next };
    setProfile(next);
  }, []);

  const restore = useCallback((g: Catch[], p: Profile) => {
    setGarage(normalizeGarage(g));
    setProfile(normalizeProfile(p));
  }, []);

  const linkAccount = useCallback(async (token: string) => {
    const base = { ...latest.current.profile, token, googleLinked: true, lastCloudSave: 0 };
    const r = await pullGarage(token);
    if (!r.ok) return { ok: false, added: 0 };
    const before = latest.current.garage.length;
    const m = r.data ? mergeCloud(latest.current.garage, base, r.data) : { garage: latest.current.garage, profile: base };
    setGarage(m.garage);
    setProfile({ ...m.profile, token, googleLinked: true });
    return { ok: true, added: m.garage.length - before };
  }, []);

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
      toast, notify: flash, shopBuy, shopEquip, quests: () => questsView(garage, profile), caughtNs: caught, addCatch, removeCatch, setSettings, setUsername, toggleStar, patchProfile, restore, linkAccount, syncState,
    };
  }, [ready, garage, profile, settings, toast, flash, shopBuy, shopEquip, addCatch, removeCatch, setSettings, setUsername, toggleStar, patchProfile, restore, linkAccount, syncState]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): Game {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGame outside GameProvider');
  return v;
}

export { KEYS };
