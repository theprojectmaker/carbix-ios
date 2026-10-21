import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts, palette } from '@/theme/theme';
import { Plate } from './plate';
import { RaceIcon, SeasonIcon } from './pixel-icons';

const INK = '#141C27';

/** The web app's red header band: the "cart" with the wordmark and your level, plus quest and shop keys. */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const g = useGame();
  const invites = useRace().invites.length;
  return (
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
      <HBtn dot={invites > 0} icon={<RaceIcon />} a11y={invites ? `Races, ${invites} invite` : 'Races'} onPress={() => router.push('/race')} />
      <HBtn icon={<SeasonIcon />} a11y="Quests and shop" onPress={() => router.push('/season')} />
    </View>
  );
}

function HBtn({ icon, onPress, a11y, dot }: { icon: React.ReactNode; onPress: () => void; a11y: string; dot?: boolean }) {
  return (
    <Pressable onPress={() => { play('click'); onPress(); }} accessibilityRole="button" accessibilityLabel={a11y}>
      {({ pressed }) => (
        <Plate color={palette.navyDk} depth={2} pressed={pressed} style={{ width: 46, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
          {dot ? <View style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: palette.gold, borderWidth: 3, borderColor: INK }} /> : null}
        </Plate>
      )}
    </Pressable>
  );
}
