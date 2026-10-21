import { Image } from 'expo-image';
import React, { useState } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { API_ORIGIN } from '@/engine/api';
import { MAP_PIN_STYLES, pinArtURL } from '@/engine/shop';
import { ShopIcon } from './shop-icons';

const INK = '#141C27';

/** The stock pixel teardrop pin, tinted by a rarity colour. The Map and the Shop both draw this exact pin. */
export function ClassicPin({ color, width = 30, height = 40 }: { color: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 21">
      <Path d="M4 0h8v1h2v2h1v6h-1v2h-2v2h-2v3h-1v3h-1v2h-1v-2h-1v-3h-1v-3H5v-2H3V9H2V3h1V1h2z" fill={INK} />
      <Path d="M5 1h6v1h2v2h1v4h-1v2h-2v2H8v3H7v-3H5v-2H3V4h1V2h1z" fill={color} />
      <Rect x="5" y="3" width="2" height="2" fill="#ffffff" opacity={0.55} />
      <Rect x="6" y="5" width="4" height="4" fill="#1c2233" />
      <Rect x="7" y="6" width="2" height="2" fill="#f5f3ea" />
    </Svg>
  );
}

/**
 * A map pin exactly as it appears on the Map: the equipped shape's art in the catch's rarity colour,
 * or the classic teardrop. Falls back to the drawn icon if the art can't load.
 */
export function PinArt({ id, rarity, color, size = 44 }: { id: string; rarity: string; color: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (id === 'classic' || !MAP_PIN_STYLES.some((s) => s.id === id)) return <ClassicPin color={color} width={size * 0.75} height={size} />;
  if (failed) return <ShopIcon id={id} size={size} />;
  return (
    <Image
      source={{ uri: pinArtURL(API_ORIGIN, id, rarity) }}
      style={{ width: size * 0.8, height: size }}
      contentFit="contain"
      onError={() => setFailed(true)}
    />
  );
}
