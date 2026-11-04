import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts } from '@/theme/theme';

const INK = '#141C27';
export const RACE_GREEN = '#35C46A';
export const RACE_GREEN_DK = '#1E8F4B';

/** m:ss, or h:mm:ss past an hour */
export function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Whether you are in a race that is waiting to start or running, and/or in a live catch session. */
export function useRaceStatus() {
  const r = useRace();
  const raceOn = !!r.race && (r.race.status === 'running' || r.race.status === 'lobby');
  const liveOn = !!r.liveSession;
  return { active: raceOn || liveOn, raceOn, liveOn, race: r.race, liveSession: r.liveSession };
}

/** Where the flag and the pill lead: the race control page while something is on, the lobby page otherwise. */
export function openRace() {
  play('whoosh');
  router.push('/race');
}
export function openRaceControl() {
  play('whoosh');
  router.push('/race-live');
}

/** 0 -> 1 -> 0 on a loop while `on`; stays 0 when reduce-motion is set. Runs on the UI thread. */
export function usePulse(on: boolean, ms = 850): SharedValue<number> {
  const g = useGame();
  const p = useSharedValue(0);
  const run = on && !g.settings.reduceMotion;
  useEffect(() => {
    if (run) p.set(withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true));
    else { cancelAnimation(p); p.set(0); }
    return () => cancelAnimation(p);
  }, [run, ms, p]);
  return p;
}

/** A ticking "now", once a second, only while `on`. */
export function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

/**
 * The strip under the header while a race or live session is on: a green pill in the right corner with the time left.
 * Tap it to open race control.
 */
export function RacePill() {
  const { active, raceOn, liveOn, race, liveSession } = useRaceStatus();
  const pulse = usePulse(active, 700);
  const dot = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * pulse.get(), transform: [{ scale: 0.8 + 0.4 * pulse.get() }] }));
  if (!active) return null;
  let text: string;
  if (raceOn && race) {
    text = race.status === 'lobby' ? `LOBBY ${race.code}` : 'RACE LIVE';
  } else {
    text = `LIVE ${liveSession?.players.length ?? 1} HERE`;
  }
  void liveOn;
  return (
    <View style={{ alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2 }}>
      <Pressable onPress={openRaceControl} accessibilityRole="button" accessibilityLabel={`Race: ${text}. Open race control`} hitSlop={8}>
        {({ pressed }) => (
          <View style={{ paddingBottom: pressed ? 0 : 3, marginTop: pressed ? 3 : 0, backgroundColor: INK }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: RACE_GREEN, borderWidth: 2, borderColor: INK, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Animated.View style={[{ width: 10, height: 10, backgroundColor: '#fff', borderWidth: 2, borderColor: INK }, dot]} />
              <Text style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 21, color: INK, letterSpacing: 1 }}>{text}</Text>
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}
