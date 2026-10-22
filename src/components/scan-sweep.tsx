import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { play } from '@/lib/sfx';
import { fonts } from '@/theme/theme';

const LOCK = '#5dff9b';
const SCAN = '#4ab4ff';

/**
 * While the car is being read: the frozen shot gets a scanline grid, a blue sweep that glides down and back up,
 * and corner brackets that spring in from wide, lock green with a LOCK tag and a tap of haptics, then breathe.
 * Everything runs on the native driver, so it stays smooth while the photo is uploading.
 */
export function ScanSweep({ haptics = true }: { haptics?: boolean }) {
  const [h, setH] = useState(0);
  const [w, setW] = useState(0);
  const [sweep] = useState(() => new Animated.Value(0));
  const [close] = useState(() => new Animated.Value(0));
  const [breath] = useState(() => new Animated.Value(0));
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    // glide down, glide back up: no jump at the end of each pass
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const c = Animated.sequence([
      Animated.delay(200),
      Animated.spring(close, { toValue: 1, friction: 7, tension: 46, useNativeDriver: true }),
    ]);
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    a.start();
    play('scan');
    const ticks = [520, 1040, 1560, 2080].map((ms, i) => setTimeout(() => play(i % 2 ? 'ping1' : 'ping0'), ms));
    c.start(({ finished }) => {
      if (!finished) return;
      setLocked(true);
      play('ping2');
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      b.start();
    });
    return () => { a.stop(); c.stop(); b.stop(); ticks.forEach(clearTimeout); };
  }, [sweep, close, breath, haptics]);

  const onLayout = (e: LayoutChangeEvent) => {
    setH(e.nativeEvent.layout.height);
    setW(e.nativeEvent.layout.width);
  };
  const y = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, h - 4)] });
  const fw = w * 0.78, fh = Math.min(h * 0.46, fw * 0.62);
  const scale = Animated.multiply(
    close.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }),
    breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }),
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {/* dark edges pull the eye to the middle */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '14%', backgroundColor: 'rgba(5,8,14,.45)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '14%', backgroundColor: 'rgba(5,8,14,.45)' }} />
      {w ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id="scan" width="4" height="6" patternUnits="userSpaceOnUse">
              <Rect x="0" y="0" width="4" height="1" fill="rgba(74,180,255,0.10)" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width={w} height={h} fill="url(#scan)" />
        </Svg>
      ) : null}

      {/* the sweep, with a soft glow on both sides since it travels both ways */}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: [{ translateY: y }] }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: -34, height: 34, backgroundColor: 'rgba(74,180,255,.07)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: -16, height: 16, backgroundColor: 'rgba(74,180,255,.13)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 4, height: 16, backgroundColor: 'rgba(74,180,255,.13)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 20, height: 34, backgroundColor: 'rgba(74,180,255,.07)' }} />
        <View style={{ height: 4, flexDirection: 'row' }}>
          <View style={{ flex: 1 }} />
          <View style={{ flex: 3, backgroundColor: SCAN }} />
          <View style={{ flex: 3, backgroundColor: '#bfe6ff' }} />
          <View style={{ flex: 3, backgroundColor: SCAN }} />
          <View style={{ flex: 1 }} />
        </View>
      </Animated.View>

      {/* lock-on frame: springs in from wide to snug, then breathes once locked */}
      {w ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View
            style={{
              width: fw, height: fh, alignItems: 'center', justifyContent: 'center',
              transform: [{ scale }],
              opacity: close.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
            }}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View
                key={c}
                style={{
                  position: 'absolute', width: 26, height: 26, borderColor: locked ? LOCK : '#ffffff',
                  top: c[0] === 't' ? 0 : undefined, bottom: c[0] === 'b' ? 0 : undefined,
                  left: c[1] === 'l' ? 0 : undefined, right: c[1] === 'r' ? 0 : undefined,
                  borderTopWidth: c[0] === 't' ? 3 : 0, borderBottomWidth: c[0] === 'b' ? 3 : 0,
                  borderLeftWidth: c[1] === 'l' ? 3 : 0, borderRightWidth: c[1] === 'r' ? 3 : 0,
                }}
              />
            ))}
            {locked ? (
              <View style={{ position: 'absolute', left: 0, top: -20, backgroundColor: LOCK, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, letterSpacing: 1.5, color: '#0b1408' }}>LOCK</Text>
              </View>
            ) : (
              <View style={{ position: 'absolute', left: 0, top: -20, backgroundColor: 'rgba(8,10,16,.7)', paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, letterSpacing: 1.5, color: SCAN }}>READING</Text>
              </View>
            )}
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}
