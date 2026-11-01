import { router, useLocalSearchParams } from 'expo-router';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { renderCardImage } from '@/engine/card-image';
import { catalogMatch } from '@/engine/data';
import { play } from '@/lib/sfx';
import { fonts, palette } from '@/theme/theme';
import { Screen } from '@/components/screen';

import { CarCard } from '@/components/car-card';
import { Btn, PText } from '@/components/ui';
import { useGame } from '@/state/game';

const FONT = require('@expo-google-fonts/jersey-25/400Regular/Jersey25_400Regular.ttf');

export default function CardScreen() {
  const g = useGame();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = g.garage.find((x) => String(x.id) === id);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState('');

  async function share() {
    if (!c || sharing) return;
    play('whoosh');
    setSharing(true);
    setNote('');
    try {
      const asset = Asset.fromModule(FONT);
      await asset.downloadAsync();
      const buf = await (await fetch(asset.localUri ?? asset.uri)).arrayBuffer();
      const b64 = await renderCardImage(c, new Uint8Array(buf), g.profile.name);
      const f = new File(Paths.cache, `carbix-card-${c.id}.png`);
      if (f.exists) f.delete();
      f.create();
      f.write(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'image/png', dialogTitle: 'Carbix card' });
      else setNote('SHARING IS NOT AVAILABLE ON THIS DEVICE.');
    } catch {
      setNote('COULD NOT MAKE THE IMAGE. TRY AGAIN.');
    }
    setSharing(false);
  }

  if (!c) {
    return (
      <Screen edges={['top', 'bottom']}>
        <PText>THAT CATCH ISN&apos;T IN THIS GARAGE.</PText>
        <Btn label="CLOSE" onPress={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <CarCard g={c} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn style={{ flex: 1 }} tone="gold" label={sharing ? 'MAKING IMAGE...' : 'SHARE CARD'} disabled={sharing} onPress={share} />
          <Btn style={{ flex: 1 }} tone="navy" label="COMPARE" onPress={() => { const e = catalogMatch(c.car); router.push({ pathname: '/compare', params: e ? { a: String(e.n) } : {} }); }} />
        </View>
        {note ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.red }}>{note}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn style={{ flex: 1 }} tone="red" label="DONE" onPress={() => router.back()} />
          <Btn
            style={{ flex: 1 }}
            tone="plain"
            label="DELETE"
            onPress={() =>
              Alert.alert('Delete this catch?', 'It will be removed from your garage and its XP will be lost.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { g.removeCatch(c.id); router.back(); } },
              ])
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
