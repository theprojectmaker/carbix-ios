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

/** One pop-up card: slides in from the top, sits for a few seconds, slides out. Swipe up or tap to dismiss early. */
function Card({ t }: { t: Toast }) {
  const [y] = useState(() => new Animated.Value(-120));
  const look = LOOK[t.kind] ?? LOOK.info;
  useEffect(() => {
    Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180, mass: 0.8 }).start();
    if (t.kind !== 'progress' && t.kind !== 'info') Haptics.notificationAsync(t.kind === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (t.kind === 'quest' || t.kind === 'level' || t.kind === 'trophy') play('pop');
    const id = setTimeout(() => {
      Animated.timing(y, { toValue: -140, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => dismissToast(t.id));
    }, t.ms);
    return () => clearTimeout(id);
  }, [t, y]);
  const go = () => {
    dismissToast(t.id);
    if (t.route) { play('tab'); router.push(t.route as never); }
  };
  return (
    <Animated.View style={{ transform: [{ translateY: y }] }}>
      <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={`${look.label}: ${t.title}`}>
        <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, borderLeftWidth: 10, borderLeftColor: look.color, padding: 10, gap: 3, shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 4, height: 4 }, shadowRadius: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: look.color, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: look.ink, letterSpacing: 1.5 }}>{look.label}</Text>
            </View>
            {t.route ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: palette.lcdDim, marginLeft: 'auto' }}>TAP TO OPEN</Text> : null}
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 21, color: '#fff' }} numberOfLines={2}>{t.title}</Text>
          {t.body ? <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, lineHeight: 14, color: '#C9D2E6' }} numberOfLines={3}>{t.body}</Text> : null}
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
      {q.length > 1 ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: '#fff', textAlign: 'right', marginTop: 2, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 }}>+{q.length - 1} MORE</Text> : null}
    </View>
  );
}
