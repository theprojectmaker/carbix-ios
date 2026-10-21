import { Canvas, FilterMode, Image as SkImage, MipmapMode, useImage } from '@shopify/react-native-skia';
import React from 'react';

/**
 * A pixel-art image drawn with nearest-neighbour sampling, so big sprites stay crisp blocks
 * instead of the soft blur the normal image view gives when it scales them up.
 */
export function PixelSprite({ uri, width, height }: { uri: string; width: number; height: number }) {
  const image = useImage(uri);
  return (
    <Canvas style={{ width, height }}>
      {image ? (
        <SkImage
          image={image}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="contain"
          sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
        />
      ) : null}
    </Canvas>
  );
}
