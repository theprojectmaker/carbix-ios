import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { RACE_GREEN, clock, useNow, usePulse, useRaceStatus } from '@/components/race-pill';
import { shinyHour } from '@/engine/store';
import { play } from '@/lib/sfx';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
const GOLD = '#FFD84D';

function Banner({ color, fg, dot, title, sub, onPress, pulse }: { color: string; fg: string; dot: string; title: string; sub: string; onPress?: () => void; pulse: ReturnType<typeof usePulse> }) {
  const d = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * pulse.get(), transform: [{ scale: 0.8 + 0.45 * pulse.get() }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.15 + 0.5 * pulse.get() }));
  return (
    <Pressable onPress={onPress ? () => { play('tab'); onPress(); } : undefined} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}>
      <View style={{ backgroundColor: INK, paddingBottom: 3 }}>
        <View style={{ backgroundColor: color, borderWidth: 3, borderColor: INK, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#ffffff' }, glow]} />
          <Animated.View style={[{ width: 14, height: 14, backgroundColor: dot, borderWidth: 3, borderColor: INK }, d]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 24, color: fg, letterSpacing: 1 }} numberOfLines={1}>{title}</Text>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: fg, opacity: 0.85, letterSpacing: 1 }} numberOfLines={1}>{sub}</Text>
          </View>
          {onPress ? <Text style={{ fontFamily: fonts.display, fontSize: 26, color: fg }}>›</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** The live strip at the top of Home: the race or live session you are in, and Shiny Hour while it is on (or coming). */
export function LiveBanner() {
  const { raceOn, liveOn, race, liveSession } = useRaceStatus();
  const now = useNow(true);
  const sh = shinyHour(now);
  const pulse = usePulse(true, 800);
  const items: React.ReactNode[] = [];

  if (raceOn && race) {
    const running = race.status === 'running';
    items.push(
      <Banner
        key="race"
        pulse={pulse}
        color={RACE_GREEN}
        fg={INK}
        dot="#fff"
        title={running ? 'RACE LIVE' : `RACE LOBBY  ${race.code}`}
        sub={running ? `${race.players.length} SPOTTERS  -  TAP FOR RACE CONTROL` : 'WAITING FOR THE HOST TO START'}
        onPress={() => router.push('/race-live')}
      />,
    );
  } else if (liveOn && liveSession) {
    items.push(
      <Banner
        key="live"
        pulse={pulse}
        color={RACE_GREEN}
        fg={INK}
        dot="#fff"
        title={`LIVE SESSION  ${liveSession.code}`}
        sub={`${liveSession.players.length} HERE  -  ${liveSession.catches.length} CATCHES  -  TAP TO OPEN`}
        onPress={() => router.push('/race-live')}
      />,
    );
  }

  if (sh.live) {
    items.push(
      <Banner
        key="shiny"
        pulse={pulse}
        color={GOLD}
        fg="#5a3f00"
        dot="#fff"
        title="SHINY HOUR IS LIVE"
        sub={`2X SHINY ODDS  -  ${clock(sh.endTs - now)} LEFT  -  GO SCAN`}
        onPress={() => router.navigate('/')}
      />,
    );
  } else if (sh.startTs - now < 3 * 3600e3) {
    const mins = Math.max(1, Math.round((sh.startTs - now) / 60000));
    items.push(
      <View key="shiny-soon" style={{ backgroundColor: '#1E2833', borderWidth: 3, borderColor: INK, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: GOLD }}>SHINY HOUR STARTS SOON</Text>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: palette.wht }}>IN {mins >= 60 ? `${Math.floor(mins / 60)}H ${mins % 60}M` : `${mins} MIN`}</Text>
      </View>,
    );
  }

  if (!items.length) return null;
  return <View style={{ gap: 8 }}>{items}</View>;
}
