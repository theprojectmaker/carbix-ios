import React from 'react';
import { View, ViewStyle } from 'react-native';

const INK = '#141C27';

/**
 * The app's raised plastic key: base colour, a glossy top band, a darker lower band,
 * a 2px light bevel top-left and a 2px dark bevel bottom-right, and a hard 3px drop under it.
 * Mirrors the web app's .btn / nav button treatment (glint + band + bevel).
 */
export function Plate({
  color, children, style, depth = 3, pressed = false, hi = 'rgba(255,255,255,.34)', lo = 'rgba(0,0,0,.30)',
}: {
  color: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  depth?: number;
  pressed?: boolean;
  hi?: string;
  lo?: string;
}) {
  const d = pressed ? 0 : depth;
  return (
    <View style={{ paddingBottom: d, backgroundColor: INK, marginTop: pressed ? depth : 0 }}>
      <View style={[{ backgroundColor: color, borderWidth: 2, borderColor: INK, overflow: 'hidden' }, style]}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '20%', backgroundColor: 'rgba(255,255,255,.30)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '20%', height: '25%', backgroundColor: 'rgba(255,255,255,.10)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '45%', height: '27%', backgroundColor: 'rgba(0,0,0,.12)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '28%', backgroundColor: lo }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: hi }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: hi }} />
        <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(0,0,0,.40)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(0,0,0,.40)' }} />
        {children}
      </View>
    </View>
  );
}
