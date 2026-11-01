import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play } from '@/lib/sfx';
import { currentSeason, daysUntilNext } from '@/engine/quests';
import { useInbox } from '@/lib/inbox';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts, palette } from '@/theme/theme';
import { Plate } from './plate';
import { BellIcon, RaceIcon, SeasonIcon } from './pixel-icons';
import { RACE_GREEN, RacePill, usePulse, useRaceStatus } from './race-pill';

const INK = '#141C27';

/** The web app's red header band: the "cart" with the wordmark and your level, plus quest and shop keys. */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const g = useGame();
  const invites = useRace().invites.length;
  const unread = useInbox().unread;
  const { active } = useRaceStatus();
  const pulse = usePulse(active, 800);
  return (
    <View>
    <View
      style={{
        backgroundColor: palette.red, borderBottomWidth: 4, borderBottomColor: INK,
        paddingTop: insets.top + 8, paddingBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: 'rgba(255,255,255,.18)' }} />
      <Pressable style={{ flex: 1 }} onPress={() => { play('tab'); router.push('/settings'); }} accessibilityRole="button" accessibilityLabel="Settings">
        <Plate color={palette.navyDk} depth={2} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, gap: 8 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: '#fff', letterSpacing: 1, flex: 1, textShadowColor: 'rgba(0,0,0,.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 }}>
            <Text style={{ color: palette.gold }}>› </Text>CARBIX
          </Text>
          <View style={{ backgroundColor: palette.gold, borderWidth: 2, borderColor: INK, paddingHorizontal: 6, paddingVertical: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 15, color: INK }}>LV.{g.level}</Text>
          </View>
        </Plate>
      </Pressable>
      <HBtn
        dot={invites > 0 && !active}
        icon={<RaceIcon />}
        a11y={active ? 'Race in progress, open race control' : invites ? `Races, ${invites} invite` : 'Races'}
        onPress={() => router.push(active ? '/race-live' : '/race')}
        glow={active ? pulse : undefined}
      />
      <HBtn icon={<SeasonIcon />} badge={String(daysUntilNext(currentSeason()))} a11y={`Quests and shop, ${daysUntilNext(currentSeason())} days left in the season`} onPress={() => router.push('/season')} />
      <HBtn dot={unread > 0} icon={<BellIcon />} a11y={unread ? `Inbox, ${unread} new` : 'Inbox'} onPress={() => router.push('/notifications')} />
    </View>
    <RacePill />
    </View>
  );
}

/** `glow` set = a race is on: the key turns green and a ring around it pulses with that value. */
function HBtn({ icon, onPress, a11y, dot, badge, glow }: { icon: React.ReactNode; onPress: () => void; a11y: string; dot?: boolean; badge?: string; glow?: SharedValue<number> }) {
  const ring = useAnimatedStyle(() => ({ opacity: glow ? 0.2 + 0.8 * glow.get() : 0, transform: [{ scale: glow ? 1 + 0.16 * glow.get() : 1 }] }));
  return (
    <Pressable onPress={() => { play('whoosh'); onPress(); }} accessibilityRole="button" accessibilityLabel={a11y}>
      {({ pressed }) => (
        <View>
        {glow ? <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, borderWidth: 3, borderColor: '#9CF0BA' }, ring]} /> : null}
        <Plate color={glow ? RACE_GREEN : palette.navyDk} depth={2} pressed={pressed} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
          {dot ? <View style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: palette.gold, borderWidth: 3, borderColor: INK }} /> : null}
          {badge ? <View style={{ position: 'absolute', bottom: -5, right: -5, minWidth: 20, paddingHorizontal: 3, height: 16, backgroundColor: palette.gold, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.utilityBold, fontSize: 13, color: INK }}>{badge}</Text></View> : null}
        </Plate>
        </View>
      )}
    </Pressable>
  );
}
