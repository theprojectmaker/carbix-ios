import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  friendAction, friendsGet, liveCatch, liveCreate, liveGet, liveJoin, liveLeave, raceCreate, raceGet, raceJoin, raceScore, raceStart,
  type LiveSession, type Race, type RaceInvite, type RaceMode, type RaceResult,
} from '@/engine/api';
import type { Car } from '@/engine/types';
import { catchXP } from '@/engine/xp';
import { useGame } from '@/state/game';

const KEY = 'motordex.native.racecode';
const LIVE_KEY = 'motordex.liveCode'; // same key the web app uses

type Ctx = {
  code: string;
  race: Race | null;
  error: string;
  busy: boolean;
  create: (mode: RaceMode, durationMin: number) => Promise<void>;
  join: (code: string) => Promise<void>;
  start: () => Promise<void>;
  leave: () => void;
  refresh: () => Promise<void>;
  /** Scores one new catch into the running race; returns a short message to show, if any. */
  scoreCatch: (car: Car, geo: { lat: number; lng: number } | null) => Promise<string>;
  live: boolean;
  liveCode: string;
  liveSession: LiveSession | null;
  createLive: () => Promise<void>;
  joinLive: (code: string) => Promise<void>;
  leaveLive: () => void;
  shareCatch: (car: Car, photo: string | null) => void;
  /** Friends' race invites that have not been answered; drives the dot on the header race key. */
  invites: RaceInvite[];
  dismissInvite: (code: string) => void;
  inviteFriend: (friend: string) => Promise<boolean>;
};

const RaceCtx = createContext<Ctx | null>(null);

export function RaceProvider({ children }: { children: React.ReactNode }) {
  const g = useGame();
  const [code, setCode] = useState('');
  const [race, setRace] = useState<Race | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef('');
  const [liveCode, setLiveCode] = useState('');
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const liveRef = useRef('');
  const [invites, setInvites] = useState<RaceInvite[]>([]);
  const seenInv = useRef(new Set<string>());

  // friends' race invites: check on open and every 25 s
  useEffect(() => {
    let live = true;
    const poll = async () => {
      const st = await friendsGet(g.profile.token);
      if (!live || !st) return;
      setInvites(st.invites);
      for (const i of st.invites) {
        const k = i.from + i.code;
        if (!seenInv.current.has(k)) {
          seenInv.current.add(k);
          g.notify(`${i.from.toUpperCase()} INVITED YOU TO A RACE`);
        }
      }
    };
    poll();
    const id = setInterval(poll, 25000);
    return () => { live = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.profile.token]);

  const dismissInvite = useCallback((c: string) => {
    setInvites((l) => l.filter((i) => i.code !== c));
    friendAction(g.profile.token, g.profile.name, { action: 'dismiss', code: c }).catch(() => {});
  }, [g.profile.token, g.profile.name]);

  const inviteFriend = useCallback(async (friend: string) => {
    if (!codeRef.current) return false;
    const j = await friendAction(g.profile.token, g.profile.name, { action: 'invite', friend, code: codeRef.current });
    return !!j.ok;
  }, [g.profile.token, g.profile.name]);

  const apply = useCallback((r: RaceResult, newCode?: string) => {
    if (r.race) setRace(r.race);
    if (!r.ok && r.error && !r.eliminated && !r.duplicate) setError(r.error);
    else setError('');
    if (newCode !== undefined) {
      codeRef.current = newCode;
      setCode(newCode);
      AsyncStorage.setItem(KEY, newCode).catch(() => {});
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(async (c) => {
        if (!c) return;
        codeRef.current = c;
        setCode(c);
        const r = await raceGet(c, g.profile.token);
        if (r.ok && r.race && r.race.you?.in) setRace(r.race);
        else {
          codeRef.current = '';
          setCode('');
          AsyncStorage.removeItem(KEY).catch(() => {});
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LIVE_KEY)
      .then(async (c) => {
        if (!c) return;
        liveRef.current = c;
        setLiveCode(c);
        const j = await liveGet(c);
        if (j.ok && j.live) setLiveSession(j.live);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!liveCode) return;
    const id = setInterval(async () => {
      const j = await liveGet(liveCode);
      if (j.ok && j.live) setLiveSession(j.live);
    }, 5000);
    return () => clearInterval(id);
  }, [liveCode]);

  const setLive = useCallback((c: string, s: LiveSession | null) => {
    liveRef.current = c;
    setLiveCode(c);
    setLiveSession(s);
    if (c) AsyncStorage.setItem(LIVE_KEY, c).catch(() => {});
    else AsyncStorage.removeItem(LIVE_KEY).catch(() => {});
  }, []);

  const createLive = useCallback(async () => {
    setBusy(true);
    const j = await liveCreate(g.profile.token, g.profile.name);
    if (j.ok && j.live) { setLive(j.live.code, j.live); setError(''); } else setError(j.error ?? 'Could not start a session.');
    setBusy(false);
  }, [g.profile.token, g.profile.name, setLive]);

  const joinLive = useCallback(async (c: string) => {
    setBusy(true);
    const clean = c.trim().toUpperCase();
    const j = await liveJoin(g.profile.token, g.profile.name, clean);
    if (j.ok && j.live) { setLive(clean, j.live); setError(''); } else setError(j.error ?? 'Could not join.');
    setBusy(false);
  }, [g.profile.token, g.profile.name, setLive]);

  const leaveLive = useCallback(() => {
    if (liveRef.current) liveLeave(g.profile.token, g.profile.name, liveRef.current).catch(() => {});
    setLive('', null);
  }, [g.profile.token, g.profile.name, setLive]);

  const shareCatch = useCallback((car: Car, photo: string | null) => {
    if (!liveRef.current) return;
    liveCatch(g.profile.token, g.profile.name, liveRef.current, car as Record<string, unknown>, photo)
      .then((j) => { if (j.ok && j.live) setLiveSession(j.live); })
      .catch(() => {});
  }, [g.profile.token, g.profile.name]);

  const refresh = useCallback(async () => {
    if (!codeRef.current) return;
    const r = await raceGet(codeRef.current, g.profile.token);
    if (r.race) setRace(r.race);
  }, [g.profile.token]);

  // poll while a race is open
  useEffect(() => {
    if (!code) return;
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [code, refresh]);

  const create = useCallback(async (mode: RaceMode, durationMin: number) => {
    setBusy(true);
    const r = await raceCreate(g.profile.token, g.profile.name, mode, durationMin);
    apply(r, r.ok && r.race ? r.race.code : undefined);
    setBusy(false);
  }, [g.profile.token, g.profile.name, apply]);

  const join = useCallback(async (c: string) => {
    setBusy(true);
    const clean = c.trim().toUpperCase();
    const r = await raceJoin(g.profile.token, g.profile.name, clean);
    apply(r, r.ok ? clean : undefined);
    setBusy(false);
  }, [g.profile.token, g.profile.name, apply]);

  const start = useCallback(async () => {
    setBusy(true);
    apply(await raceStart(g.profile.token, g.profile.name, codeRef.current));
    setBusy(false);
  }, [g.profile.token, g.profile.name, apply]);

  const leave = useCallback(() => {
    codeRef.current = '';
    setCode('');
    setRace(null);
    setError('');
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  const scoreCatch = useCallback(async (car: Car, geo: { lat: number; lng: number } | null) => {
    if (!codeRef.current) return '';
    const r = await raceScore(g.profile.token, g.profile.name, codeRef.current, catchXP(car), car as Record<string, unknown>, geo);
    if (r.race) setRace(r.race);
    if (r.eliminated) return "YOU'VE BEEN CUT — SPECTATING";
    if (r.duplicate) return 'YOU ALREADY CAUGHT ONE — FIND A DIFFERENT CAR';
    if (!r.ok) return r.error ?? '';
    const ticked = r.ticked?.length ? ` · TICKED ${r.ticked.length}` : '';
    return `RACE +${catchXP(car)} XP${ticked}`;
  }, [g.profile.token, g.profile.name]);

  const value = useMemo<Ctx>(
    () => ({
      code, race, error, busy, create, join, start, leave, refresh, scoreCatch, live: !!race && race.status === 'running',
      liveCode, liveSession, createLive, joinLive, leaveLive, shareCatch,
      invites, dismissInvite, inviteFriend,
    }),
    [code, race, error, busy, create, join, start, leave, refresh, scoreCatch, liveCode, liveSession, createLive, joinLive, leaveLive, shareCatch, invites, dismissInvite, inviteFriend],
  );
  return <RaceCtx.Provider value={value}>{children}</RaceCtx.Provider>;
}

export function useRace(): Ctx {
  const v = useContext(RaceCtx);
  if (!v) throw new Error('useRace outside RaceProvider');
  return v;
}
