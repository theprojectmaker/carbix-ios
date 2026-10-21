import React from 'react';
import Svg, { Rect } from 'react-native-svg';

const INK = '#141C27';

type Px = [number, number, number, number, string]; // x, y, w, h, colour

function Icon({ size, px }: { size: number; px: Px[] }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {px.map(([x, y, w, h, c], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} fill={c} />
      ))}
    </Svg>
  );
}

/** Checkered race flag on a pole, 16x16 pixel grid. */
export function RaceIcon({ size = 26 }: { size?: number }) {
  const px: Px[] = [
    [2, 1, 2, 14, '#E4E7EC'], // pole
    [2, 1, 1, 14, '#B7BFCC'],
    [4, 2, 10, 8, INK], // flag outline
  ];
  // 4x3 checker inside the outline
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      px.push([5 + c * 2, 3 + r * 2, 2, 2, (r + c) % 2 ? INK : '#FFFFFF']);
    }
  }
  px.push([5, 3, 8, 6, 'transparent']);
  return <Icon size={size} px={px.filter((p) => p[4] !== 'transparent')} />;
}

/** Trophy cup with handles and a base, 16x16 pixel grid. */
export function SeasonIcon({ size = 26 }: { size?: number }) {
  const px: Px[] = [
    [4, 1, 8, 1, INK], [3, 2, 10, 1, INK],
    [4, 2, 8, 6, '#C9A227'], [5, 2, 2, 5, '#F2D36B'], // cup + highlight
    [3, 3, 1, 4, INK], [1, 3, 2, 1, INK], [1, 3, 1, 4, INK], [1, 6, 2, 1, INK], // left handle
    [12, 3, 1, 4, INK], [13, 3, 2, 1, INK], [14, 3, 1, 4, INK], [13, 6, 2, 1, INK], // right handle
    [4, 8, 8, 1, INK], [5, 9, 6, 1, INK],
    [7, 9, 2, 3, '#8F7318'], // stem
    [5, 12, 6, 1, '#C9A227'], [4, 13, 8, 2, '#8F7318'], [4, 15, 8, 1, INK], [3, 13, 1, 2, INK], [12, 13, 1, 2, INK],
  ];
  return <Icon size={size} px={px} />;
}
