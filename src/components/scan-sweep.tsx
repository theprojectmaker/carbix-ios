import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';

import { coverRect, padBox, type Box, type Rect } from '@/lib/car-finder';
import { play } from '@/lib/sfx';
import { fonts } from '@/theme/theme';

const LOCK = '#5dff9b';
const SCAN = '#4ab4ff';
const ARM = 28;
const CHIPS = ['GRILLE', 'BADGE', 'HEADLIGHTS', 'WHEELS', 'BODY LINES'];

function Corner({ c, l, t, w, h, lockP, breath }: { c: 'tl' | 'tr' | 'bl' | 'br'; l: SharedValue<number>; t: SharedValue<number>; w: SharedValue<number>; h: SharedValue<number>; lockP: SharedValue<number>; breath: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const inset = breath.get() * 3;
    const x = c[1] === 'l' ? l.get() + inset : l.get() + w.get() - ARM - inset;
    const y = c[0] === 't' ? t.get() + inset : t.get() + h.get() - ARM - inset;
    return { transform: [{ translateX: x }, { translateY: y }], borderColor: interpolateColor(lockP.get(), [0, 1], ['#ffffff', LOCK]) };
  });
  return (
    <Animated.View
      style={[{
        position: 'absolute', left: 0, top: 0, width: ARM, height: ARM,
        borderTopWidth: c[0] === 't' ? 4 : 0, borderBottomWidth: c[0] === 'b' ? 4 : 0,
        borderLeftWidth: c[1] === 'l' ? 4 : 0, borderRightWidth: c[1] === 'r' ? 4 : 0,
      }, style]}
    />
  );
}

/**
 * While the car is being read: the frozen shot gets a blue sweep that glides down and back up, and four corner
 * brackets that spring from wide onto the car, flash green with a LOCKED ON tag and a tap of haptics, then breathe.
 * Everything animates by transform on the UI thread (no layout per frame), so it stays smooth while the photo uploads.
 * `box` may arrive late (the phone is still looking for the car); the frame glides onto it when it does.
 */
export function ScanSweep({ haptics = true, box = null, aspect = 0 }: { haptics?: boolean; box?: Box | null; aspect?: number }) {
  const [{ W, H }, setSize] = useState({ W: 0, H: 0 });
  const [locked, setLocked] = useState(false);
  const didLock = useRef(false); // the lock sound, tap and flash happen once; later targets only glide the frame
  const sweep = useSharedValue(0);
  const lockP = useSharedValue(0);
  const breath = useSharedValue(0);
  const ringP = useSharedValue(0);
  const [stage, setStage] = useState(0); // how many readout chips have finished
  const fl = useSharedValue(0), ft = useSharedValue(0), fw = useSharedValue(0), fh = useSharedValue(0);

  const target: Rect | null = useMemo(() => {
    if (!W) return null;
    if (box) return coverRect(padBox(box, 0.06), aspect, W, H);
    const w = W * 0.78, h = Math.min(H * 0.46, w * 0.62);
    return { left: (W - w) / 2, top: (H - h) / 2, w, h };
  }, [box, aspect, W, H]);

  // first measure: start wide, sweep and sound
  useEffect(() => {
    if (!W) return;
    fl.set(-W * 0.2); ft.set(-H * 0.12); fw.set(W * 1.4); fh.set(H * 1.24);
    sweep.set(withRepeat(withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.sin) }), -1, true));
    play('scan');
    const ticks = [420, 840, 1260, 1680].map((ms, i) => setTimeout(() => play(i % 2 ? 'ping1' : 'ping0'), ms));
    // the readout: one chip finishes every half second, each with a light tap
    const chips = CHIPS.map((_, i) => setTimeout(() => { setStage(i + 1); if (haptics) Haptics.selectionAsync().catch(() => {}); }, 500 + i * 520));
    return () => { ticks.forEach(clearTimeout); chips.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  // glide onto the target whenever it changes (generic frame first, the car's own box when found)
  useEffect(() => {
    if (!target) return;
    const cfg = { damping: 17, stiffness: 150, mass: 0.9 };
    fl.set(withSpring(target.left, cfg)); ft.set(withSpring(target.top, cfg));
    fw.set(withSpring(target.w, cfg)); fh.set(withSpring(target.h, cfg));
    // lock a beat after the frame lands: right away for the car's own box, after a short read for the generic one
    if (didLock.current) return;
    const id = setTimeout(() => {
      didLock.current = true;
      setLocked(true);
      lockP.set(withTiming(1, { duration: 160 }));
      breath.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }), -1, true));
      play('lock');
      ringP.set(0);
      ringP.set(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, box ? 420 : 1100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ W: e.nativeEvent.layout.width, H: e.nativeEvent.layout.height });
  const bar = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.get() * Math.max(0, H - 4) }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - ringP.get()),
    transform: [{ translateX: fl.get() + fw.get() / 2 - 45 }, { translateY: ft.get() + fh.get() / 2 - 45 }, { scale: 0.5 + ringP.get() * 3.4 }],
  }));
  const tag = useAnimatedStyle(() => ({ transform: [{ translateX: fl.get() }, { translateY: Math.max(2, ft.get() - 26) }] }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '12%', backgroundColor: 'rgba(5,8,14,.4)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '12%', backgroundColor: 'rgba(5,8,14,.4)' }} />

      {/* the sweep: one bar with a soft glow on both sides, since it travels both ways */}
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: 4 }, bar]}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: -30, height: 30, backgroundColor: 'rgba(74,180,255,.09)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 4, height: 30, backgroundColor: 'rgba(74,180,255,.09)' }} />
        <View style={{ flex: 1, backgroundColor: SCAN, marginHorizontal: '8%' }} />
      </Animated.View>

      {W ? (
        <>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: 90, height: 90, borderWidth: 4, borderColor: LOCK }, ring]} />
          <View style={{ position: 'absolute', left: 12, bottom: '14%', gap: 3 }}>
            {CHIPS.map((c, i) => {
              const ok = stage > i;
              return (
                <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(8,10,16,.72)', paddingHorizontal: 8, paddingVertical: 1 }}>
                  <View style={{ width: 8, height: 8, backgroundColor: ok ? LOCK : SCAN, opacity: ok ? 1 : 0.5 }} />
                  <Text style={{ fontFamily: fonts.display, fontSize: 15, letterSpacing: 1, color: ok ? LOCK : SCAN }}>{c}</Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 15, color: ok ? LOCK : '#7f8ca6' }}>{ok ? 'OK' : '...'}</Text>
                </View>
              );
            })}
          </View>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => <Corner key={c} c={c} l={fl} t={ft} w={fw} h={fh} lockP={lockP} breath={breath} />)}
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, tag]}>
            <View style={{ backgroundColor: locked ? LOCK : 'rgba(8,10,16,.72)', paddingHorizontal: 8, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, letterSpacing: 2, color: locked ? '#0b1408' : SCAN }}>{locked ? (box ? 'LOCKED ON' : 'LOCK') : 'LOOKING'}</Text>
            </View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}
