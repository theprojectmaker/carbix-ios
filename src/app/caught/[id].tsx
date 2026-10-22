import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Animated, Easing, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarCard } from '@/components/car-card';
import { CatchSparks } from '@/components/catch-sparks';
import { Screen } from '@/components/screen';
import { Btn } from '@/components/ui';
import { CATALOG, catalogMatch } from '@/engine/data';
import { catchXP } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const FLAVOR = ['CAUGHT', 'NICE FIND', 'ADDED TO THE BIX', 'SPOTTED IN THE WILD', 'LOGGED', 'ONE FOR THE COLLECTION', 'GOT IT', 'NEW ENTRY'];
const ordinal = (n: number) => (n === 0 ? 'NEW TO YOUR BIX' : n === 1 ? 'SECOND TIME CAUGHT' : n === 2 ? 'THIRD TIME CAUGHT' : `CAUGHT ${n + 1}x TOTAL`);

/**
 * The CAUGHT screen: heading, what it earned, the card popping in with sparks, and where to next.
 * It is a full-screen modal, where the system sometimes reports a zero safe area, so the top and bottom room for the
 * Dynamic Island and the home bar is set here with a floor instead of trusting it.
 */
export default function Caught() {
  const t = useTheme();
  const g = useGame();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = g.garage.find((x) => String(x.id) === id);
  const [pop] = useState(() => new Animated.Value(0));
  const [flavor] = useState(() => FLAVOR[Math.floor(Math.random() * FLAVOR.length)]);

  const prior = c ? g.garage.filter((x) => x.id !== c.id && x.car.make === c.car.make && x.car.model === c.car.model && x.ts < c.ts).length : 0;
  const isShiny = !!c?.shiny;

  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 360, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
    play('tab');
    const tm = setTimeout(() => {
      if (isShiny) play('shiny');
      else if (prior > 0) play('dup');
    }, 700);
    return () => clearTimeout(tm);
  }, [pop, isShiny, prior]);

  if (!c) return null;
  const hit = catalogMatch(c.car);
  const conf = Number.isFinite(c.car.confidence) ? ` - AI ${Math.round(c.car.confidence as number)}% SURE` : '';
  const xp = catchXP(c.car) + (c.shiny ? 100 : 0);
  const top = (insets.top || 50) + 10;
  const bottom = (insets.bottom || 18) + 8;

  return (
    <Screen edges={[]}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: top, paddingBottom: bottom, gap: 10 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 34, color: t.red, letterSpacing: 1, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{flavor}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip text={ordinal(prior)} bg={prior ? '#2C3E58' : palette.green} fg="#fff" />
            <Chip text={`+${xp} XP`} bg={palette.gold} fg="#141C27" />
            {c.shiny ? <Chip text="SHINY" bg="#FFD84D" fg="#7A5A10" /> : null}
          </View>
          <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, letterSpacing: 1, color: t.muted, textAlign: 'center' }}>
            BIX {g.caughtNs.size} / {CATALOG.length}{conf}
          </Text>
        </View>

        {/* the card fills the space left and scrolls inside itself, so the buttons never leave the screen */}
        <Animated.View style={{ flex: 1, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: 8 }}>
            <View style={{ width: '100%', maxWidth: 340 }}>
              <CarCard g={c} />
            </View>
          </ScrollView>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn style={{ flex: 1 }} tone="red" label="GO TO GARAGE" onPress={() => { router.dismissAll(); router.navigate('/bix'); }} />
          <Btn style={{ flex: 1 }} tone="navy" label="KEEP SCANNING" onPress={() => { router.dismissAll(); router.navigate('/'); }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, paddingVertical: 2 }}>
          {hit ? (
            <Text onPress={() => router.push({ pathname: '/car/[n]', params: { n: String(hit.n) } })} style={{ fontFamily: fonts.utilityBold, fontSize: 10.5, color: t.red, padding: 4 }}>
              ALL ABOUT THIS CAR
            </Text>
          ) : null}
          <Text
            onPress={() =>
              Alert.alert('Discard this catch?', 'It will be removed from your garage.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => { g.removeCatch(c.id); router.dismissAll(); router.navigate('/'); } },
              ])
            }
            style={{ fontFamily: fonts.utility, fontSize: 10.5, color: t.muted, padding: 4 }}>
            WRONG CAR? DISCARD
          </Text>
        </View>
      </View>
      <CatchSparks rarity={c.car.rarity} shiny={c.shiny} origin={{ x: width / 2, y: height * 0.42 }} />
    </Screen>
  );
}

function Chip({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderWidth: 2, borderColor: '#141C27', paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: fg, letterSpacing: 1 }}>{text}</Text>
    </View>
  );
}
