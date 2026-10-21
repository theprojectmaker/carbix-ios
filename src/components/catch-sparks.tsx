import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { Rarity } from '@/engine/types';
import { TIER_COLOR } from '@/engine/xp';

const SPARKS: Record<Rarity, number> = { Common: 8, Uncommon: 11, Rare: 14, Epic: 18, Legendary: 24, Mythic: 32 };
const REACH: Record<Rarity, number> = { Common: 0.7, Uncommon: 0.85, Rare: 1, Epic: 1.2, Legendary: 1.5, Mythic: 1.9 };

/**
 * Pixel sparks in the catch's rarity colour bursting out of the card, plus a soft flash.
 * Count and reach scale with rarity (a Mythic is ~2.7x a Common); a shiny adds gold glints.
 */
export function CatchSparks({ rarity, shiny, origin }: { rarity: Rarity; shiny?: boolean; origin: { x: number; y: number } }) {
  const [t] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(1));
  const [parts] = useState(() => {
    const n = SPARKS[rarity] + (shiny ? 8 : 0);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = (70 + Math.random() * 90) * REACH[rarity];
      const gold = shiny && i >= SPARKS[rarity];
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, size: 4 + Math.round(Math.random() * 4), color: gold ? '#FFD84D' : TIER_COLOR[rarity] };
    });
  });

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(flash, { toValue: 0, duration: 420, useNativeDriver: true }).start();
  }, [t, flash]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: TIER_COLOR[rarity], opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }]} />
      {parts.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', left: origin.x, top: origin.y, width: p.size, height: p.size, backgroundColor: p.color,
            opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy + 26] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
