import { BlendColor, Canvas, FilterMode, Image as SkImage, MipmapMode, useImage } from '@shopify/react-native-skia';
import React from 'react';

/**
 * A pixel-art image drawn with nearest-neighbour sampling, so big sprites stay crisp blocks
 * instead of the soft blur the normal image view gives when it scales them up.
 */
export function PixelSprite({ uri, width, height, tint, bottom }: { uri: string; width: number; height: number; tint?: string; bottom?: boolean }) {
  const image = useImage(uri);
  // the sprite's own aspect, so a low car is not letterboxed inside a tall box
  const ih = image ? Math.min(height, Math.round((width * image.height()) / image.width())) : height;
  const boxH = bottom ? ih : height;
  return (
    <Canvas style={{ width, height: boxH }}>
      {image ? (
        <SkImage
          image={image}
          x={0}
          y={bottom ? 0 : Math.round((height - ih) / 2)}
          width={width}
          height={ih}
          fit="fill"
          sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}>
          {tint ? <BlendColor color={tint} mode="srcIn" /> : null}
        </SkImage>
      ) : null}
    </Canvas>
  );
}
