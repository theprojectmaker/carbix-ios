import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { PIN_H, PIN_W, RARITY_HEX, renderPin, shapeForPinId } from '@/engine/pin-art';

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
 * A map pin exactly as it appears on the Map: the equipped shape, drawn pixel by pixel in the catch's rarity colour
 * (the same art the website serves), or the classic teardrop. Nothing to download, so it is crisp at any size and
 * works offline.
 */
export function PinArt({ id, rarity, color, size = 44 }: { id: string; rarity: string; color: string; size?: number }) {
  const shape = shapeForPinId(id);
  const pixels = useMemo(() => (shape ? renderPin(shape, RARITY_HEX[rarity.toLowerCase()] || color) : []), [shape, rarity, color]);
  if (!shape) return <ClassicPin color={color} width={size * 0.75} height={size} />;
  return (
    <Svg width={size * (PIN_W / PIN_H)} height={size} viewBox={`0 0 ${PIN_W} ${PIN_H}`}>
      {pixels.map((p) => <Rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={1} height={1} fill={p.c} />)}
    </Svg>
  );
}
