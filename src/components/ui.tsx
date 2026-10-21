import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, TextProps, View, ViewProps, ViewStyle } from 'react-native';

import { iconURL } from '@/engine/api';
import type { CatalogEntry } from '@/engine/types';
import { fonts, useTheme } from '@/theme/theme';
import { play } from '@/lib/sfx';
import { PixelSprite } from './pixel-sprite';
import { Plate } from './plate';

export function PText({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text {...p} style={[{ fontFamily: fonts.display, color: t.ink, fontSize: 16 }, style]} />;
}

export function Panel({ style, ...p }: ViewProps) {
  const t = useTheme();
  return (
    <View
      {...p}
      style={[
        { backgroundColor: t.paper2, borderWidth: 3, borderColor: t.dark ? '#000' : t.panel, padding: 12 },
        styles.shadow,
        style,
      ]}
    />
  );
}

type BtnProps = {
  label: string;
  onPress?: () => void;
  tone?: 'red' | 'navy' | 'gold' | 'plain';
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
};

export function Btn({ label, onPress, tone = 'navy', disabled, style, small }: BtnProps) {
  const t = useTheme();
  const bg = tone === 'red' ? t.red : tone === 'gold' ? t.gold : tone === 'plain' ? t.paper2 : t.navy;
  const fg = tone === 'plain' ? t.ink : tone === 'gold' ? t.panel : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        play(tone === 'red' ? 'tab' : 'click');
        onPress?.();
      }}
      disabled={disabled}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      {({ pressed }) => (
        <Plate color={bg} pressed={pressed} style={{ paddingVertical: small ? 6 : 10, paddingHorizontal: small ? 10 : 14, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: small ? 15 : 20, color: fg, letterSpacing: 1.5, textShadowColor: tone === 'gold' || tone === 'plain' ? 'transparent' : 'rgba(0,0,0,.4)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 }}>
            {label}
          </Text>
        </Plate>
      )}
    </Pressable>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 14, borderWidth: 3, borderColor: t.panel, backgroundColor: t.panel2 }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, flex: 1, backgroundColor: color ?? t.gold }} />
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        play('click');
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={{
        borderWidth: 2, borderColor: t.panel, backgroundColor: on ? t.red : t.paper,
        paddingHorizontal: 10, paddingVertical: 4, marginRight: 6,
      }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 15, color: on ? '#fff' : t.ink }}>{label}</Text>
    </Pressable>
  );
}

/** A catalog sprite from the live /api/icon store. Uncaught cars are drawn as a flat silhouette. */
export function Sprite({ entry, caught = true, size = 64, tint = '#141C27', crisp = false, shadow = false }: { entry: CatalogEntry; caught?: boolean; size?: number; tint?: string; crisp?: boolean; shadow?: boolean }) {
  // big (or asked-for) sprites go through the nearest-neighbour renderer so they stay sharp; a soft ground shadow adds depth
  if (caught && (crisp || size >= 140)) {
    return (
      <View style={{ alignItems: 'center' }}>
        <PixelSprite uri={iconURL(entry)} width={size} height={size * 0.7} />
        {shadow ? <View style={{ width: size * 0.78, height: Math.max(3, size * 0.05), borderRadius: size, backgroundColor: 'rgba(0,0,0,.28)', marginTop: -size * 0.06 }} /> : null}
      </View>
    );
  }
  return (
    <Image
      source={{ uri: iconURL(entry) }}
      style={{ width: size, height: size * 0.7 }}
      contentFit="contain"
      tintColor={caught ? undefined : tint}
      cachePolicy="disk"
      recyclingKey={String(entry.n)}
      accessibilityLabel={caught ? `${entry.make} ${entry.model}` : 'Not caught yet'}
    />
  );
}

const styles = StyleSheet.create({
  shadow: { shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 3, height: 3 }, shadowRadius: 0, elevation: 3 },
});
