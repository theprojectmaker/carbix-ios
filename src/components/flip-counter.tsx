import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fonts } from '@/theme/theme';

const INK = '#141C27';
const W = 38;
const H = 62;
const STEP_MS = 85;

/** One half of a digit: the top or bottom of the number, cropped from a full-height glyph. */
function Half({ d, top }: { d: string; top: boolean }) {
  return (
    <View style={{ width: W, height: H / 2, overflow: 'hidden', backgroundColor: '#10141c' }}>
      <Text
        style={{ position: 'absolute', left: 0, right: 0, top: top ? 0 : -H / 2, height: H, textAlign: 'center', fontFamily: fonts.display, fontSize: 56, lineHeight: H, color: '#F4F6FA' }}
        allowFontScaling={false}
      >
        {d}
      </Text>
    </View>
  );
}

/** A split-flap digit: the top flap folds down over the old number, the bottom flap swings in with the new one. */
function Flap({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const [prev, setPrev] = useState(0);
  const p = useSharedValue(1);
  const target = useRef(value);
  const cur = useRef(0);

  useEffect(() => {
    target.current = value;
    const id = setInterval(() => {
      if (cur.current === target.current) { clearInterval(id); return; }
      const from = cur.current;
      const to = (from + 1) % 10; // digits only ever roll forward, like the real boards
      cur.current = to;
      setPrev(from);
      setShown(to);
      p.set(0);
      p.set(withTiming(1, { duration: STEP_MS - 10, easing: Easing.linear }));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [value, p]);

  const topFlap = useAnimatedStyle(() => {
    const t = Math.min(1, p.get() * 2);
    return { opacity: p.get() < 0.5 ? 1 : 0, transform: [{ perspective: 400 }, { rotateX: `${-90 * t}deg` }] };
  });
  const bottomFlap = useAnimatedStyle(() => {
    const t = Math.max(0, p.get() * 2 - 1);
    return { opacity: p.get() < 0.5 ? 0 : 1, transform: [{ perspective: 400 }, { rotateX: `${90 * (1 - t)}deg` }] };
  });

  return (
    <View style={{ width: W, height: H, borderWidth: 2, borderColor: INK, backgroundColor: INK }}>
      <View style={{ position: 'absolute', left: 0, top: 0 }}><Half d={String(shown)} top /></View>
      <View style={{ position: 'absolute', left: 0, top: H / 2 }}><Half d={String(prev)} top={false} /></View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, transformOrigin: 'bottom' as never }, topFlap]}><Half d={String(prev)} top /></Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: H / 2, transformOrigin: 'top' as never }, bottomFlap]}><Half d={String(shown)} top={false} /></Animated.View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: H / 2 - 1, height: 2, backgroundColor: INK }} />
    </View>
  );
}

function Checks({ n = 22 }: { n?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: n }).map((_, i) => <View key={i} style={{ flex: 1, height: 10, backgroundColor: i % 2 ? '#F4F6FA' : INK }} />)}
    </View>
  );
}

/** A raceway scoreboard: a split-flap counter between two checkered strips. Digits roll up from zero whenever the number changes. */
export function FlipCounter({ value, label, sub, digits = 6 }: { value: number; label: string; sub?: string; digits?: number }) {
  const s = String(Math.max(0, Math.round(value))).padStart(digits, '0').slice(-digits);
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 3) groups.unshift(s.slice(Math.max(0, i - 3), i));
  let idx = 0;
  return (
    <View style={{ backgroundColor: '#1a1f2b', borderWidth: 3, borderColor: INK }}>
      <Checks />
      <View style={{ paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, backgroundColor: '#35C46A', borderWidth: 2, borderColor: INK }} />
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: '#FFD84D', letterSpacing: 3 }}>{label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {groups.map((g, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 ? <View style={{ width: 8, height: 8, backgroundColor: '#8A97A6', marginHorizontal: 2 }} /> : null}
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {g.split('').map((c) => <Flap key={idx} value={Number(s[idx++])} />)}
              </View>
            </React.Fragment>
          ))}
        </View>
        {sub ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: '#8A97A6', letterSpacing: 2 }}>{sub}</Text> : null}
      </View>
      <Checks />
    </View>
  );
}
