import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismissToast, useToastQueue, type Toast, type ToastKind } from '@/lib/toast';
import { play } from '@/lib/sfx';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
const LOOK: Record<ToastKind, { label: string; color: string; ink: string }> = {
  quest: { label: 'QUEST', color: palette.green, ink: INK },
  level: { label: 'LEVEL UP', color: palette.gold, ink: INK },
  trophy: { label: 'TROPHY', color: palette.gold, ink: INK },
  daily: { label: 'DAILY', color: '#E0863A', ink: INK },
  friend: { label: 'FRIEND', color: '#5C7AA0', ink: '#fff' },
  race: { label: 'RACE', color: palette.red, ink: '#fff' },
  feed: { label: 'FEED', color: '#8C6FB5', ink: '#fff' },
  bonus: { label: 'BONUS', color: palette.gold, ink: INK },
  progress: { label: 'PROGRESS', color: '#F6F3EA', ink: INK },
  info: { label: 'CARBIX', color: '#F6F3EA', ink: INK },
  error: { label: 'OOPS', color: palette.red, ink: '#fff' },
};

/** A pixel glyph per kind, drawn from tiny grids so it matches the rest of the app. */
const GLYPH: Record<ToastKind, string[]> = {
  quest: ['.....#', '....##', '#..##.', '##.##.', '.###..', '..#...'],
  level: ['..##..', '.####.', '######', '..##..', '..##..', '..##..'],
  trophy: ['######', '######', '.####.', '..##..', '..##..', '.####.'],
  daily: ['..##..', '.####.', '######', '######', '.####.', '..##..'],
  friend: ['.####.', '.####.', '.####.', '######', '######', '######'],
  race: ['#.#.#.', '.#.#.#', '######', '######', '#.##.#', '#....#'],
  feed: ['######', '#....#', '#.##.#', '#.##.#', '#....#', '######'],
  bonus: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
  progress: ['......', '#.....', '##....', '###...', '####..', '#####.'],
  info: ['..##..', '..##..', '......', '..##..', '..##..', '..##..'],
  error: ['#....#', '##..##', '.####.', '..##..', '.####.', '##..##'],
};
function Glyph({ kind, color }: { kind: ToastKind; color: string }) {
  const rows = GLYPH[kind] ?? GLYPH.info;
  return (
    <View>
      {rows.map((r, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {r.split('').map((c, x) => <View key={x} style={{ width: 5, height: 5, backgroundColor: c === '#' ? color : 'transparent' }} />)}
        </View>
      ))}
    </View>
  );
}

/** One pop-up card: slides in from the top, drains a timer bar, slides out. Tap to open what it is about. */
function Card({ t }: { t: Toast }) {
  const [y] = useState(() => new Animated.Value(-130));
  const [bar] = useState(() => new Animated.Value(1));
  const look = LOOK[t.kind] ?? LOOK.info;
  useEffect(() => {
    Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 190, mass: 0.8 }).start();
    Animated.timing(bar, { toValue: 0, duration: t.ms, easing: Easing.linear, useNativeDriver: false }).start();
    if (t.kind !== 'progress' && t.kind !== 'info') Haptics.notificationAsync(t.kind === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (t.kind === 'quest' || t.kind === 'level' || t.kind === 'trophy') play('pop');
    const id = setTimeout(() => {
      Animated.timing(y, { toValue: -150, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => dismissToast(t.id));
    }, t.ms);
    return () => clearTimeout(id);
  }, [t, y, bar]);
  const go = () => {
    dismissToast(t.id);
    if (t.route) { play('tab'); router.push(t.route as never); }
  };
  return (
    <Animated.View style={{ transform: [{ translateY: y }] }}>
      <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={`${look.label}: ${t.title}`}>
        <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, shadowColor: '#000', shadowOpacity: 0.45, shadowOffset: { width: 4, height: 4 }, shadowRadius: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
            <View style={{ width: 54, backgroundColor: look.color, alignItems: 'center', justifyContent: 'center', borderRightWidth: 3, borderRightColor: INK }}>
              <Glyph kind={t.kind} color={look.ink} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 9, gap: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 14, color: look.color, letterSpacing: 2 }}>{look.label}{t.route ? '   TAP TO OPEN' : ''}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 23, color: '#fff' }} numberOfLines={2}>{t.title}</Text>
              {t.body ? <Text style={{ fontFamily: fonts.display, fontSize: 15, lineHeight: 17, color: '#C9D2E6', marginTop: 2 }} numberOfLines={3}>{t.body}</Text> : null}
            </View>
          </View>
          <View style={{ height: 5, backgroundColor: '#0c121b' }}>
            <Animated.View style={{ height: 5, backgroundColor: look.color, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** The pop-up layer. Lives once in the root layout, above every screen. Shows the front of the queue. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const q = useToastQueue();
  const t = q[0];
  if (!t) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12, zIndex: 50 }}>
      <Card key={t.id} t={t} />
      {q.length > 1 ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 12, color: '#fff', textAlign: 'right', marginTop: 2, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 }}>+{q.length - 1} MORE</Text> : null}
    </View>
  );
}
