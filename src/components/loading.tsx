import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Animated as RNAnimated, Easing as RNEasing, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import { PixelSprite } from '@/components/pixel-sprite';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';

/** Three pixel blocks that light up in turn: the app's one inline loading indicator, used wherever something is fetching. */
export function Loading({ label = 'LOADING', color = palette.lcdDim, size = 10 }: { label?: string; color?: string; size?: number }) {
  const [t] = useState(() => new RNAnimated.Value(0));
  useEffect(() => {
    const a = RNAnimated.loop(RNAnimated.timing(t, { toValue: 3, duration: 900, easing: RNEasing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [t]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }} accessibilityLabel={label} accessibilityRole="progressbar">
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <RNAnimated.View
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

/* ---- the boot scene: your car driving through a pixel town. No logo, no words. ---- */
const PERIOD = 480; // one repeat of the skyline

/** [left, width, height] of each building in one repeat; the layer is drawn twice so it loops without a seam */
const FAR: [number, number, number][] = [[0, 52, 70], [58, 38, 104], [100, 60, 58], [166, 44, 120], [216, 70, 84], [292, 40, 96], [338, 58, 66], [402, 50, 112], [458, 22, 60]];
const NEAR: [number, number, number][] = [[10, 64, 46], [84, 40, 70], [130, 74, 40], [214, 50, 64], [270, 66, 48], [346, 44, 78], [396, 62, 42]];

function Skyline({ shared, rects, color, window }: { shared: SharedValue<number>; rects: [number, number, number][]; color: string; window?: string }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -PERIOD * shared.get() }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, bottom: 0, width: PERIOD * 2, height: 130, flexDirection: 'row' }, style]}>
      {[0, 1].map((k) => (
        <View key={k} style={{ width: PERIOD, height: 130 }}>
          {rects.map(([l, w, h], i) => (
            <View key={i} style={{ position: 'absolute', left: l, bottom: 0, width: w, height: h, backgroundColor: color }}>
              {window ? Array.from({ length: Math.floor(h / 22) }).map((_, r) => (
                <View key={r} style={{ position: 'absolute', left: 8, top: 8 + r * 22, width: Math.max(6, w - 16), height: 6, backgroundColor: window, opacity: (i + r) % 3 === 0 ? 0.9 : 0.35 }} />
              )) : null}
            </View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

function Cloud({ shared, top, w, phase }: { shared: SharedValue<number>; top: number; w: number; phase: number }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: ((1 - ((shared.get() + phase) % 1)) * 520) - 130 }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top }, style]}>
      <View style={{ width: w, height: 14, backgroundColor: '#FFFFFF', opacity: 0.85 }} />
      <View style={{ position: 'absolute', left: w * 0.2, top: -10, width: w * 0.45, height: 12, backgroundColor: '#FFFFFF', opacity: 0.85 }} />
      <View style={{ position: 'absolute', left: w * 0.5, top: -6, width: w * 0.3, height: 8, backgroundColor: '#FFFFFF', opacity: 0.85 }} />
    </Animated.View>
  );
}

function Dashes({ shared, bottom, color, gap, period }: { shared: SharedValue<number>; bottom: number; color: string; gap: number; period: number }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -period * shared.get() }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, bottom, flexDirection: 'row', gap }, style]}>
      {Array.from({ length: 16 }).map((_, i) => <View key={i} style={{ width: period - gap, height: 5, backgroundColor: color }} />)}
    </Animated.View>
  );
}

function Streak({ shared, top, len, phase, speed }: { shared: SharedValue<number>; top: number; len: number; phase: number; speed: number }) {
  const style = useAnimatedStyle(() => {
    const p = (shared.get() * speed + phase) % 1;
    return { opacity: p < 0.1 ? p * 6 : p > 0.7 ? Math.max(0, (1 - p) * 2) : 0.6, transform: [{ translateX: 40 - p * 150 }] };
  });
  return <Animated.View style={[{ position: 'absolute', right: 0, top, width: len, height: 3, backgroundColor: '#FFFFFF' }, style]} />;
}

function Dot({ shared, i }: { shared: SharedValue<number>; i: number }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.abs(((shared.get() + 3 - i) % 3) - 0.5) < 0.6 ? 1 : 0.25 }));
  return <Animated.View style={[{ width: 12, height: 12, backgroundColor: palette.gold, borderWidth: 2, borderColor: INK }, style]} />;
}

/**
 * The boot screen, shown while fonts and your saved garage load: only your showcase car driving down a pixel street,
 * bobbing on its suspension with streaks flying past. Everything is a transform on the UI thread, so it never stutters
 * while the app is busy loading. First launch, before there is a showcase car, a little red hatchback drives instead.
 */
export function LoadingScreen(_props: { fontsReady?: boolean; note?: string }) {
  void _props;
  const [car, setCar] = useState<string | null>(null);
  const road = useSharedValue(0);
  const near = useSharedValue(0);
  const far = useSharedValue(0);
  const clouds = useSharedValue(0);
  const bob = useSharedValue(0);
  const dots = useSharedValue(0);

  useEffect(() => {
    AsyncStorage.getItem('motordex.native.showcase').then((u) => { if (u) setCar(u); }).catch(() => {});
  }, []);
  useEffect(() => {
    road.set(withRepeat(withTiming(1, { duration: 520, easing: Easing.linear }), -1, false));
    near.set(withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false));
    far.set(withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false));
    clouds.set(withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false));
    bob.set(withRepeat(withSequence(withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 190, easing: Easing.inOut(Easing.quad) }), withTiming(0.35, { duration: 120 }), withTiming(0, { duration: 160 })), -1, false));
    dots.set(withRepeat(withTiming(3, { duration: 1100, easing: Easing.linear }), -1, false));
  }, [road, near, far, clouds, bob, dots]);

  const carStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * bob.get() }, { rotate: `${-0.9 * bob.get()}deg` }] }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - 0.05 * bob.get() }], opacity: 0.32 - 0.08 * bob.get() }));

  return (
    <View style={{ flex: 1, backgroundColor: '#F0EEE7', justifyContent: 'flex-end' }}>
      {/* sky: three soft bands */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '38%', backgroundColor: '#F0EEE7' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: '38%', height: '14%', backgroundColor: '#E8E5D8' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: '52%', height: '48%', backgroundColor: '#DEDACB' }} />
      <Cloud shared={clouds} top={110} w={96} phase={0} />
      <Cloud shared={clouds} top={190} w={64} phase={0.37} />
      <Cloud shared={clouds} top={70} w={52} phase={0.7} />

      <View style={{ height: 150 }}>
        <Skyline shared={far} rects={FAR} color="#C7C3B5" />
      </View>
      <View style={{ height: 0 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 130, justifyContent: 'flex-end' }}>
          <Skyline shared={near} rects={NEAR} color="#9AA6BA" window="#F0EEE7" />
        </View>
      </View>

      {/* road */}
      <View style={{ height: 170, backgroundColor: '#33465F', borderTopWidth: 6, borderTopColor: INK }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 10, backgroundColor: '#5C7AA0' }} />
        <Dashes shared={road} bottom={86} color="#C9A227" gap={36} period={72} />
        <Dashes shared={road} bottom={22} color="#243247" gap={60} period={96} />
      </View>

      {/* the car, sitting on the road; its box is anchored so the wheels meet the asphalt */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 118, alignItems: 'center' }}>
        <Animated.View style={[{ position: 'absolute', bottom: -8, width: 210, height: 14, borderRadius: 7, backgroundColor: '#000' }, shadowStyle]} />
        <Animated.View style={carStyle}>
          {car ? <PixelSprite uri={car} width={230} height={120} bottom /> : <PixelCar />}
        </Animated.View>
        <Streak shared={road} top={-70} len={70} phase={0.1} speed={1} />
        <Streak shared={road} top={-48} len={110} phase={0.5} speed={1} />
        <Streak shared={road} top={-22} len={80} phase={0.8} speed={1} />
      </View>

      {/* three pixel blocks, no words */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 44, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {[0, 1, 2].map((i) => <Dot key={i} shared={dots} i={i} />)}
      </View>
    </View>
  );
}

/** A 13x7 pixel hatchback in the app's red, for the very first launch when there is no showcase car yet. */
function PixelCar() {
  const P = 9;
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
