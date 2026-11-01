import AsyncStorage from '@react-native-async-storage/async-storage';
import { PixelSprite } from '@/components/pixel-sprite';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';

/** Three pixel blocks that light up in turn: the app's one loading indicator, used inline wherever something is fetching. */
export function Loading({ label = 'LOADING', color = palette.lcdDim, size = 10 }: { label?: string; color?: string; size?: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.loop(Animated.timing(t, { toValue: 3, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [t]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }} accessibilityLabel={label} accessibilityRole="progressbar">
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={{
              width: size, height: size, backgroundColor: palette.gold, borderWidth: 2, borderColor: INK,
              opacity: t.interpolate({ inputRange: [i, i + 0.5, i + 1, 3], outputRange: [1, 0.25, 0.25, i === 0 ? 1 : 0.25], extrapolate: 'clamp' }),
            }}
          />
        ))}
      </View>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color, letterSpacing: 1.5 }}>{label}</Text>
    </View>
  );
}

/**
 * The full-screen boot screen, shown while fonts and the saved garage load. Cream paper, the wordmark, a little pixel car
 * driving along a dashed road, and a line that says what is happening. Drawn with system fonts until the pixel fonts land.
 */
export function LoadingScreen({ fontsReady, note = 'LOADING YOUR GARAGE' }: { fontsReady: boolean; note?: string }) {
  const [x] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));
  const [car, setCar] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('motordex.native.showcase').then((u) => { if (u) setCar(u); }).catch(() => {});
  }, []);
  useEffect(() => {
    const drive = Animated.loop(Animated.timing(x, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }));
    const hop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]));
    drive.start();
    hop.start();
    return () => { drive.stop(); hop.stop(); };
  }, [x, bob]);
  const display = fontsReady ? fonts.display : undefined;
  const utility = fontsReady ? fonts.utilityBold : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: '#F0EEE7', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <View style={{ backgroundColor: palette.red, borderWidth: 4, borderColor: INK, paddingHorizontal: 22, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowOffset: { width: 5, height: 5 }, shadowRadius: 0 }}>
        <Text style={{ fontFamily: display, fontSize: 54, lineHeight: 58, color: '#fff', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>
          <Text style={{ color: palette.gold }}>› </Text>CARBIX
        </Text>
      </View>
      <Text style={{ fontFamily: utility, fontSize: 11, color: palette.navyDk, letterSpacing: 3 }}>SPOT REAL CARS. FILL YOUR BIX.</Text>

      {/* the road */}
      <View style={{ width: 280, height: 110, marginTop: 6, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, backgroundColor: '#33465F', borderTopWidth: 3, borderTopColor: INK }} />
        <Animated.View style={{ position: 'absolute', left: 0, bottom: 10, flexDirection: 'row', gap: 16, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }] }}>
          {Array.from({ length: 12 }).map((_, i) => <View key={i} style={{ width: 20, height: 4, backgroundColor: '#C9A227' }} />)}
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center', transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }}>
          {car ? (
            <PixelSprite uri={car} width={160} height={90} bottom />
          ) : (
            <PixelCar />
          )}
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: 0, bottom: 2, flexDirection: 'row', gap: 40, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) }] }}>
          {Array.from({ length: 8 }).map((_, i) => <View key={i} style={{ width: 20, height: 4, backgroundColor: '#243247' }} />)}
        </Animated.View>
      </View>

      <Loading label={note} color={palette.navyDk} />
    </View>
  );
}

/** A 13x7 pixel hatchback in the app's red, drawn with plain views so it works before any font or image loads. */
function PixelCar() {
  const P = 4;
  const rows = [
    '....RRRRR....',
    '...RWWRWWR...',
    '..RRRRRRRRRR.',
    '.RRRRRRRRRRRR',
    'RRRRRRRRRRRRR',
    'RKKRRRRRRRKKR',
    '.KK.......KK.',
  ];
  const col: Record<string, string> = { R: palette.red, W: '#BFE0F5', K: INK };
  return (
    <View>
      {rows.map((r, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {r.split('').map((ch, x) => <View key={x} style={{ width: P, height: P, backgroundColor: ch === '.' ? 'transparent' : col[ch] }} />)}
        </View>
      ))}
    </View>
  );
}
