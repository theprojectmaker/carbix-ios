import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, interpolate, interpolateColor, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';

import { play } from '@/lib/sfx';
import { fonts } from '@/theme/theme';

const seg = (t: number, a: number, b: number) => {
  'worklet';
  return Math.min(1, Math.max(0, (t - a) / Math.max(1, b - a)));
};
/** eases out and overshoots a little, for things that slam onto a target */
const slam = (x: number) => {
  'worklet';
  const c = 1.8;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

const RAINBOW = ['#FF5C7A', '#FFB84D', '#FFF06A', '#6BE38A', '#5CC8FF', '#B58BFF', '#FF5C7A'];
const GOLD = ['#FFD84D', '#F2B632', '#FFF1A8', '#FFFFFF'];

function Ray({ i, n, t, H }: { i: number; n: number; t: SharedValue<number>; H: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * seg(t.get(), 250, 700) * (1 - seg(t.get(), 2800, 3500)),
    backgroundColor: interpolateColor((t.get() / 1500 + i / n) % 1, RAINBOW.map((_, k) => k / (RAINBOW.length - 1)), RAINBOW),
    transform: [{ rotate: `${(i * 360) / n + t.get() * 0.022}deg` }, { scaleY: interpolate(seg(t.get(), 250, 900), [0, 1], [0.2, 1]) }],
  }));
  return <Animated.View style={[{ position: 'absolute', left: -9, top: -H, width: 18, height: H * 2 }, style]} />;
}

function Piece({ t, xf, W, delay, dur, size, color, H, sway }: { t: SharedValue<number>; xf: number; W: number; delay: number; dur: number; size: number; color: string; H: number; sway: number }) {
  const style = useAnimatedStyle(() => {
    const p = seg(t.get(), delay, delay + dur);
    return {
      opacity: p > 0 && p < 1 ? 1 : 0,
      transform: [{ translateX: xf * W + Math.sin(p * 9 + sway) * 26 }, { translateY: interpolate(p, [0, 1], [-30, H + 30]) }, { rotate: `${p * 540 + sway * 60}deg` }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size, backgroundColor: color }, style]} />;
}

function Spark({ t, angle, dist, delay, size, color }: { t: SharedValue<number>; angle: number; dist: number; delay: number; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = seg(t.get(), delay, delay + 900);
    const e = 1 - Math.pow(1 - p, 3);
    return {
      opacity: p > 0 && p < 1 ? 1 - p * p : 0,
      transform: [{ translateX: Math.cos(angle) * dist * e }, { translateY: Math.sin(angle) * dist * e + 40 * p * p }, { scale: 1 - p * 0.6 }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size, backgroundColor: color }, style]} />;
}

/**
 * The extra-special catch moment. A GRAIL (15 or fewer exist) gets prismatic rays, a rain of pixels and a GRAIL banner
 * that slams in with three heavy taps; any other limited run gets a gold stamp ("ONLY 200 BUILT") that slams down in a
 * burst of sparks. All of it runs on one UI-thread timeline and removes itself when it is done.
 */
export function RareCatchFX({ grail, label, name, haptics = true, onDone }: { grail: boolean; label: string; name: string; haptics?: boolean; onDone: () => void }) {
  const [{ W, H }, setSize] = useState({ W: 0, H: 0 });
  const t = useSharedValue(0);
  const total = grail ? 3600 : 2400;

  useEffect(() => {
    if (!W) return;
    t.set(0);
    t.set(withTiming(total, { duration: total, easing: Easing.linear }, (done) => { if (done) runOnJS(onDone)(); }));
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const tap = (s: Haptics.ImpactFeedbackStyle) => { if (haptics) Haptics.impactAsync(s).catch(() => {}); };
    if (grail) {
      at(300, () => tap(Haptics.ImpactFeedbackStyle.Heavy));
      at(470, () => tap(Haptics.ImpactFeedbackStyle.Heavy));
      at(640, () => tap(Haptics.ImpactFeedbackStyle.Heavy));
      at(1100, () => { if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); });
      at(900, () => play('fanfare'));
    } else {
      at(260, () => { tap(Haptics.ImpactFeedbackStyle.Heavy); play('coin'); });
      at(900, () => play('streak'));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  const rays = grail ? 14 : 0;
  const [confetti] = useState(() => Array.from({ length: grail ? 54 : 0 }, (_, i) => ({
    xf: Math.random(), delay: 350 + Math.random() * 1500, dur: 1300 + Math.random() * 900, size: 6 + Math.round(Math.random() * 6),
    color: RAINBOW[i % (RAINBOW.length - 1)], sway: Math.random() * 6,
  })));
  const [sparks] = useState(() => Array.from({ length: grail ? 24 : 26 }, (_, i) => ({
    angle: (i / (grail ? 24 : 26)) * Math.PI * 2 + Math.random() * 0.2, dist: 90 + Math.random() * (grail ? 220 : 150), delay: grail ? 380 : 230, size: 5 + Math.round(Math.random() * 5),
    color: grail ? RAINBOW[i % (RAINBOW.length - 1)] : GOLD[i % GOLD.length],
  })));

  const dim = useAnimatedStyle(() => ({ opacity: (grail ? 0.8 : 0.5) * seg(t.get(), 0, 180) * (1 - seg(t.get(), total - 600, total)) }));
  const flash = useAnimatedStyle(() => ({ opacity: 0.85 * Math.max(0, 1 - seg(t.get(), grail ? 300 : 240, grail ? 650 : 520)) * (t.get() > (grail ? 280 : 220) ? 1 : 0) }));
  const banner = useAnimatedStyle(() => {
    const p = seg(t.get(), grail ? 280 : 200, grail ? 560 : 440);
    const out = 1 - seg(t.get(), total - 500, total);
    return { opacity: p > 0 ? out : 0, transform: [{ scale: interpolate(slam(p), [0, 1], [3.4, 1]) }, { rotate: grail ? '0deg' : '-7deg' }] };
  });
  const sub = useAnimatedStyle(() => ({ opacity: seg(t.get(), grail ? 640 : 420, grail ? 860 : 620) * (1 - seg(t.get(), total - 500, total)), transform: [{ translateY: interpolate(seg(t.get(), 640, 900), [0, 1], [16, 0]) }] }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e: LayoutChangeEvent) => setSize({ W: e.nativeEvent.layout.width, H: e.nativeEvent.layout.height })}>
      {W ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#070912' }, dim]} />
          {grail ? (
            <View style={{ position: 'absolute', left: W / 2, top: H * 0.4 }}>
              {Array.from({ length: rays }).map((_, i) => <Ray key={i} i={i} n={rays} t={t} H={H} />)}
            </View>
          ) : null}
          {confetti.map((c, i) => <Piece key={i} t={t} H={H} W={W} {...c} />)}
          <View style={{ position: 'absolute', left: W / 2, top: H * 0.4 }}>
            {sparks.map((s, i) => <Spark key={i} t={t} {...s} />)}
          </View>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }, flash]} />

          <View style={{ position: 'absolute', left: 0, right: 0, top: H * 0.4 - 70, alignItems: 'center' }}>
            {grail ? (
              <Animated.View style={[{ alignItems: 'center' }, banner]}>
                <Text style={{ fontFamily: fonts.display, fontSize: 96, lineHeight: 98, color: '#fff', letterSpacing: 6, textShadowColor: '#7B5CFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 22 }}>GRAIL</Text>
              </Animated.View>
            ) : (
              <Animated.View style={[{ alignItems: 'center', borderWidth: 6, borderColor: '#FFD84D', paddingHorizontal: 22, paddingVertical: 8, backgroundColor: 'rgba(20,28,39,.88)' }, banner]}>
                <Text style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: '#FFD84D', letterSpacing: 4 }}>LIMITED</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 52, lineHeight: 54, color: '#fff', letterSpacing: 2 }}>{label}</Text>
              </Animated.View>
            )}
            <Animated.View style={[{ marginTop: 14, alignItems: 'center', gap: 6 }, sub]}>
              {grail ? (
                <>
                  <View style={{ backgroundColor: '#E4DDFF', borderWidth: 3, borderColor: '#141C27', paddingHorizontal: 16, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 30, color: '#1a1530', letterSpacing: 3 }}>{label}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>{name}</Text>
                </>
              ) : (
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>{name}</Text>
              )}
            </Animated.View>
          </View>
        </>
      ) : null}
    </View>
  );
}
