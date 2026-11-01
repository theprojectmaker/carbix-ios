import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { Rarity } from '@/engine/types';
import { TIER_COLOR } from '@/engine/xp';

const SPARKS: Record<Rarity, number> = { Common: 8, Uncommon: 11, Rare: 14, Epic: 18, Legendary: 24, Mythic: 32, Grail: 40 };
const REACH: Record<Rarity, number> = { Common: 0.7, Uncommon: 0.85, Rare: 1, Epic: 1.2, Legendary: 1.5, Mythic: 1.9, Grail: 2.2 };

/** How each shop effect moves: a burst off the card, a fall from above, a rise from below, or a slow drift. */
type Mode = 'burst' | 'fall' | 'rise' | 'drift';
type Look = { mode: Mode; colors: string[]; count: number; size: [number, number]; flash: string; ring?: string; round?: boolean; duration: number };
const LOOKS: Record<string, Look> = {
  standard: { mode: 'burst', colors: [], count: 0, size: [4, 8], flash: '', duration: 1100 },
  starburst: { mode: 'burst', colors: ['#FFD84D', '#ffffff', '#FFF1A8'], count: 18, size: [8, 16], flash: '#FFD84D', ring: '#FFD84D', duration: 1200 },
  leaffall: { mode: 'fall', colors: ['#E0863A', '#D9532B', '#C9A227', '#8B2E2E', '#A9501C'], count: 24, size: [8, 14], flash: '#E0863A', duration: 2600 },
  embers: { mode: 'rise', colors: ['#FFD84D', '#E0863A', '#D9532B', '#FFF1A8'], count: 28, size: [3, 6], flash: '#FF8C28', duration: 2000 },
  ghostparade: { mode: 'rise', colors: ['#F4F1FF', '#B58BFF', '#E0863A', '#ffffff'], count: 16, size: [8, 22], flash: '#A078E6', duration: 2600 },
  harvestmoon: { mode: 'drift', colors: ['#FFF1A8', '#FFD84D', '#F0DC7A'], count: 16, size: [4, 7], flash: '#FFE496', duration: 3000 },
  snowfall: { mode: 'fall', colors: ['#ffffff', '#E4F1FB', '#BFE0F5'], count: 28, size: [4, 9], flash: '#9FC3E0', round: true, duration: 3000 },
  frost: { mode: 'burst', colors: ['#ffffff', '#BFE0F5', '#6FA3C8'], count: 18, size: [6, 14], flash: '#BFE0F5', ring: '#BFE0F5', duration: 1300 },
  aurora: { mode: 'rise', colors: ['#7CE0A8', '#5FA89B', '#B58BFF', '#8C6FB5', '#E4F1FB'], count: 32, size: [3, 7], flash: '#7CE0A8', duration: 2400 },
  petals: { mode: 'fall', colors: ['#F6A8C8', '#FFD1E3', '#ffffff', '#E58CB5'], count: 26, size: [7, 13], flash: '#E58CB5', duration: 2700 },
  rainbow: { mode: 'burst', colors: ['#D8402F', '#E0863A', '#F2D36B', '#7FA05C', '#5C9ED6', '#8C6FB5'], count: 26, size: [5, 9], flash: '#ffffff', ring: '#ffffff', duration: 1300 },
};

/**
 * What the catch screen does the moment the card lands: pixel sparks in the rarity colour by default, or the catch
 * effect you equipped in the shop (leaves, embers, snow, petals, a starburst...). Count and reach scale with rarity;
 * a shiny adds gold glints on top of any effect.
 */
export function CatchSparks({ rarity, shiny, origin, effect = 'standard' }: { rarity: Rarity; shiny?: boolean; origin: { x: number; y: number }; effect?: string }) {
  const [t] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(1));
  const look = LOOKS[effect] ?? LOOKS.standard;
  const [parts] = useState(() => {
    const reach = REACH[rarity];
    const base = look.mode === 'burst' ? (look.count || SPARKS[rarity]) : look.count;
    const n = Math.round(base * (0.7 + reach * 0.3)) + (shiny ? 8 : 0);
    const cardW = 300, cardH = 220;
    return Array.from({ length: n }, (_, i) => {
      const gold = shiny && i >= n - 8;
      const size = look.size[0] + Math.round(Math.random() * (look.size[1] - look.size[0]));
      const color = gold ? '#FFD84D' : look.colors.length ? look.colors[i % look.colors.length] : TIER_COLOR[rarity];
      if (look.mode === 'fall') {
        return { x0: (Math.random() - 0.5) * cardW, y0: -cardH * 0.6 - Math.random() * 60, dx: (Math.random() - 0.5) * 90, dy: cardH * 0.9 + Math.random() * 120, size, color, spin: (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 220), delay: Math.random() * 0.35 };
      }
      if (look.mode === 'rise') {
        return { x0: (Math.random() - 0.5) * cardW, y0: cardH * 0.45 - Math.random() * 20, dx: (Math.random() - 0.5) * 50, dy: -(cardH * 0.8 + Math.random() * 140), size, color, spin: 0, delay: Math.random() * 0.3 };
      }
      if (look.mode === 'drift') {
        return { x0: (Math.random() - 0.5) * cardW * 1.1, y0: (Math.random() - 0.5) * cardH, dx: (Math.random() - 0.5) * 70, dy: -20 - Math.random() * 50, size, color, spin: 0, delay: Math.random() * 0.4 };
      }
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = (70 + Math.random() * 90) * reach * (look.ring ? 1.3 : 1);
      return { x0: 0, y0: 0, dx: Math.cos(a) * d, dy: Math.sin(a) * d + 26, size, color, spin: 0, delay: 0 };
    });
  });

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: look.duration, easing: look.mode === 'burst' ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(flash, { toValue: 0, duration: 420, useNativeDriver: true }).start();
  }, [t, flash, look]);

  const flashColor = look.flash || TIER_COLOR[rarity];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }]} />
      {look.ring ? (
        <Animated.View
          style={{
            position: 'absolute', left: origin.x - 60, top: origin.y - 60, width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: look.ring,
            opacity: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.5, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.2] }) }],
          }}
        />
      ) : null}
      {parts.map((p, i) => {
        const inp = [0, Math.min(0.99, p.delay), Math.min(0.995, p.delay + 0.1), 0.75, 1];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', left: origin.x + p.x0, top: origin.y + p.y0, width: p.size, height: p.size, backgroundColor: p.color, borderRadius: look.round ? p.size / 2 : 0,
              opacity: look.mode === 'burst' ? t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }) : t.interpolate({ inputRange: inp, outputRange: [0, 0, 1, 1, 0] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, look.mode === 'fall' ? -p.dx * 0.6 : p.dx * 0.5, p.dx] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
                { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, look.mode === 'rise' ? 0.3 : look.mode === 'burst' ? 0.5 : 1] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
