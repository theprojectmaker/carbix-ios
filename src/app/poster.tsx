import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Bar, Btn, PText } from '@/components/ui';
import { CATALOG, catalogMatch, dexRank } from '@/engine/data';
import { renderPoster } from '@/engine/poster';
import { dateKeyET } from '@/engine/store';
import type { CatalogEntry } from '@/engine/types';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const FONT = require('@expo-google-fonts/jersey-25/400Regular/Jersey25_400Regular.ttf');

/** BIX POSTER: the whole garage on one wall poster, saved as an image you can share. */
export default function Poster() {
  const t = useTheme();
  const g = useGame();
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [png, setPng] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function make() {
    if (!g.garage.length) {
      setErr('CATCH A CAR FIRST. AN EMPTY WALL IS JUST A WALL.');
      return;
    }
    setBusy(true);
    setErr('');
    setProg(0);
    try {
      const asset = Asset.fromModule(FONT);
      await asset.downloadAsync();
      const buf = await (await fetch(asset.localUri ?? asset.uri)).arrayBuffer();
      const caughtN = new Set<number>();
      const shinyN = new Set<number>();
      for (const c of g.garage) {
        const h = catalogMatch(c.car);
        if (!h) continue;
        caughtN.add(h.n);
        if (c.shiny) shinyN.add(h.n);
      }
      const caught = [...caughtN].map((n) => CATALOG.find((x) => x.n === n)).filter(Boolean).sort((a, b) => dexRank(a!.n) - dexRank(b!.n)).slice(0, 1200) as CatalogEntry[];
      const b64 = await renderPoster({
        name: g.profile.displayName || g.profile.username || 'SPOTTER', caught, shinyN, catalog: CATALOG, caughtN, pct: g.bixPct,
        levelLine: `LV.${g.level} - ${g.rank} - ${g.xp.toLocaleString()} XP`, dateLine: dateKeyET(), fontData: new Uint8Array(buf),
        onProgress: setProg,
      });
      setPng(b64);
    } catch {
      setErr('POSTER EXPORT FAILED. TRY AGAIN.');
    }
    setBusy(false);
  }

  async function share() {
    if (!png) return;
    try {
      const bin = atob(png);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const f = new File(Paths.cache, `carbix-bix-poster-${dateKeyET()}.png`);
      if (f.exists) f.delete();
      f.create();
      f.write(bytes);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'image/png', dialogTitle: 'Carbix Bix poster' });
    } catch {
      setErr('COULD NOT SHARE THE POSTER.');
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>BIX POSTER</PText>
        <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: '#141C27', padding: 12, gap: 8 }}>
          <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>
            Your whole garage as one wall poster: every car you caught in a grid, and every car still out there as one grey pixel underneath.
          </Text>
          {busy ? <Bar value={prog} color={palette.green} /> : null}
          <Btn tone="red" label={busy ? `DRAWING ${Math.round(prog * 100)}%` : png ? 'DRAW AGAIN' : 'DRAW MY POSTER'} disabled={busy} onPress={make} />
          {err ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.red }}>{err}</Text> : null}
        </View>
        {png ? (
          <>
            <Image source={{ uri: 'data:image/png;base64,' + png }} style={{ width: '100%', aspectRatio: 1216 / 700, backgroundColor: '#F0EEE7', borderWidth: 3, borderColor: '#141C27' }} contentFit="contain" />
            <Btn tone="gold" label="SAVE / SHARE" onPress={share} />
          </>
        ) : null}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
