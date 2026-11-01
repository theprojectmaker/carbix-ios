import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, Chip, PText } from '@/components/ui';
import type { Catch, Rarity } from '@/engine/types';
import { TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const COLS = 3;
const TIERS: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

const when = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Every photo you have taken, newest first. Tap one to see it big; open its card from there. */
export default function Gallery() {
  const t = useTheme();
  const g = useGame();
  const { width } = useWindowDimensions();
  const [tier, setTier] = useState<Rarity | ''>('');
  const [open, setOpen] = useState<Catch | null>(null);

  const shots = useMemo(() => g.garage.filter((c) => c.photo && (!tier || c.car.rarity === tier)), [g.garage, tier]);
  const cell = Math.floor((Math.min(width, 560) - 28 - (COLS - 1) * 6) / COLS);
  const idx = open ? shots.findIndex((c) => c.id === open.id) : -1;
  const step = (d: number) => {
    const n = shots[idx + d];
    if (n) { play('swipe'); setOpen(n); }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 14, paddingTop: 8, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>GALLERY</PText>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: t.muted, paddingBottom: 8 }}>{shots.length} PHOTO{shots.length === 1 ? '' : 'S'}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip label="ALL" on={!tier} onPress={() => setTier('')} />
          {TIERS.map((r) => <Chip key={r} label={r.toUpperCase()} on={tier === r} onPress={() => setTier(tier === r ? '' : r)} />)}
        </View>
      </View>
      <FlatList
        data={shots}
        numColumns={COLS}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 8, gap: 6 }}
        columnWrapperStyle={{ gap: 6 }}
        initialNumToRender={12}
        windowSize={5}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 30, gap: 10 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navyDk, textAlign: 'center' }}>NO PHOTOS YET. EVERY SCAN YOU KEEP LANDS HERE.</Text>
            <Btn tone="red" label="SCAN A CAR" onPress={() => { router.back(); router.navigate('/'); }} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => { play('tab'); setOpen(item); }} accessibilityRole="button" accessibilityLabel={`${item.car.make} ${item.car.model}`}>
            <View style={{ width: cell, height: cell, backgroundColor: '#0a0d14', borderWidth: 3, borderColor: TIER_COLOR[item.car.rarity], overflow: 'hidden' }}>
              <Image source={{ uri: item.photo! }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={String(item.id)} />
              {item.shiny ? <View style={{ position: 'absolute', top: 4, right: 4, width: 10, height: 10, backgroundColor: palette.gold, borderWidth: 1, borderColor: INK }} /> : null}
            </View>
          </Pressable>
        )}
      />

      {open ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,10,16,.96)', padding: 16, justifyContent: 'center', gap: 12 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { play('click'); setOpen(null); }} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={{ backgroundColor: '#0a0d14', borderWidth: 4, borderColor: TIER_COLOR[open.car.rarity], aspectRatio: 4 / 3, overflow: 'hidden' }}>
            <Image source={{ uri: open.photo! }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          </View>
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: '#fff' }} numberOfLines={1}>{open.car.make} {open.car.model}</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
              <Text style={{ color: TIER_COLOR[open.car.rarity] }}>{open.car.rarity.toUpperCase()}</Text>  -  {when(open.ts)}{open.shiny ? '  -  SHINY' : ''}  -  {idx + 1} / {shots.length}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small style={{ flex: 1 }} tone="plain" label="PREV" disabled={idx <= 0} onPress={() => step(-1)} />
            <Btn small style={{ flex: 1 }} tone="red" label="OPEN CARD" onPress={() => { setOpen(null); router.push({ pathname: '/card/[id]', params: { id: String(open.id) } }); }} />
            <Btn small style={{ flex: 1 }} tone="plain" label="NEXT" disabled={idx >= shots.length - 1} onPress={() => step(1)} />
          </View>
          <Btn small tone="navy" label="CLOSE" onPress={() => { play('click'); setOpen(null); }} />
        </View>
      ) : null}
      {!open ? <View style={{ padding: 14 }}><Btn tone="plain" label="BACK" onPress={() => router.back()} /></View> : null}
    </Screen>
  );
}
