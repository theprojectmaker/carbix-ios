import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, Text, View } from 'react-native';

import { FRAME, mix } from '@/components/car-card';
import { Screen } from '@/components/screen';
import { Btn, PText, Sprite } from '@/components/ui';
import { catalogMatch } from '@/engine/data';
import { limitedInfo } from '@/engine/limited';
import type { CatalogEntry } from '@/engine/types';
import { RTIER, TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, useTheme } from '@/theme/theme';

const INK = '#141C27';
const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_W = Math.min(SCREEN_W, 560);

type Item = { e: CatalogEntry; count: number; lastId: number };

/** One showroom page: the car on a rarity-framed plate, in the same cream, navy and metal as the cards. */
function Plate({ item }: { item: Item }) {
  const [main, lite, dark] = FRAME[item.e.rarity];
  const ltd = limitedInfo(item.e);
  const stats: [string, string][] = [
    [item.e.hp ? String(item.e.hp) : '-', 'HP'],
    [item.e.top ? String(item.e.top) : '-', 'MPH'],
    [item.e.zts ? String(item.e.zts).replace(/s$/i, '') : '-', '0-60'],
  ];
  return (
    <View style={{ width: PAGE_W, paddingHorizontal: 16, paddingTop: 8 }}>
      <View style={{ backgroundColor: main, borderWidth: 3, borderColor: INK, padding: 8, gap: 8 }}>
        {/* chrome name plate */}
        <View style={{ backgroundColor: mix(lite, '#FFFFFF', 0.7), borderWidth: 2, borderColor: INK, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 15, letterSpacing: 2, color: dark }} numberOfLines={1}>{item.e.make.toUpperCase()}</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 34, color: INK }} numberOfLines={1} adjustsFontSizeToFit>{item.e.model.toUpperCase()}</Text>
        </View>

        {/* the stage: cream wall, navy floor, dashed parking line */}
        <View style={{ height: 250, backgroundColor: '#F0EEE7', borderWidth: 2, borderColor: INK, overflow: 'hidden', justifyContent: 'flex-end' }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 60, backgroundColor: '#E8E5D8' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 60, height: 2, backgroundColor: '#C8C4B8' }} />
          {ltd ? (
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: ltd.grail ? '#E4DDFF' : '#E8C547', borderWidth: 2, borderColor: INK, paddingHorizontal: 7, paddingVertical: 1, zIndex: 2 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 16, letterSpacing: 1, color: ltd.grail ? '#1a1530' : INK }}>{ltd.grail ? 'GRAIL  ' : 'LIMITED  '}{ltd.label}</Text>
            </View>
          ) : null}
          <View style={{ height: 70, backgroundColor: '#33465F', borderTopWidth: 3, borderTopColor: INK }}>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 36, paddingLeft: 6 }}>
              {Array.from({ length: 12 }).map((_, i) => <View key={i} style={{ width: 26, height: 4, backgroundColor: '#5C7AA0' }} />)}
            </View>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center' }}>
            <Sprite entry={item.e} size={Math.min(300, PAGE_W - 70)} bottom shadow crisp />
          </View>
        </View>

        {/* rarity strip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: INK, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, color: TIER_COLOR[item.e.rarity] }}>{item.e.rarity.toUpperCase()}</Text>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 15, color: '#E4E7EC', letterSpacing: 1 }}>{item.count > 1 ? `CAUGHT x${item.count}` : item.e.years ? String(item.e.years).slice(0, 4) : ''}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {stats.map(([v, k]) => (
            <View key={k} style={{ flex: 1, backgroundColor: mix(lite, '#FFFFFF', 0.55), borderWidth: 2, borderColor: INK, alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: INK }}>{v}</Text>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 13, color: dark, letterSpacing: 1 }}>{k}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * THE SHOWROOM: your cars one at a time on rarity-framed plates, rarest first. Swipe through, pick the one that
 * represents you (it fronts your Bix and drives the loading screen), open its card or jump to compare.
 */
export default function Showroom() {
  const t = useTheme();
  const g = useGame();
  const cars = useMemo(() => {
    const seen = new Map<number, Item>();
    for (const c of g.garage) {
      const e = catalogMatch(c.car);
      if (!e) continue;
      const cur = seen.get(e.n);
      if (cur) cur.count++;
      else seen.set(e.n, { e, count: 1, lastId: c.id });
    }
    return [...seen.values()].sort((a, b) => RTIER[b.e.rarity] - RTIER[a.e.rarity] || (b.e.hp || 0) - (a.e.hp || 0));
  }, [g.garage]);
  const start = Math.max(0, cars.findIndex((c) => c.e.n === g.profile.avatar));
  const [idx, setIdx] = useState(start);
  const list = useRef<FlatList<Item>>(null);
  const cur = cars[idx];
  const isShowcase = !!cur && g.profile.avatar === cur.e.n;

  if (!cars.length) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'center' }}>
          <PText style={{ fontSize: 30, color: t.red }}>THE SHOWROOM IS EMPTY</PText>
          <Text style={{ fontFamily: fonts.prose, fontSize: 22, color: t.muted }}>Catch a car and it parks here.</Text>
          <Btn tone="red" label="SCAN A CAR" onPress={() => { router.back(); router.navigate('/'); }} />
          <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4 }}>
          <PText style={{ fontSize: 36, lineHeight: 38, color: t.red }}>SHOWROOM</PText>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 16, color: t.muted, marginBottom: 4, letterSpacing: 1 }}>{idx + 1} OF {cars.length}</Text>
        </View>

        <FlatList
          ref={list}
          data={cars}
          horizontal
          pagingEnabled
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: PAGE_W, offset: PAGE_W * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => String(c.e.n)}
          onMomentumScrollEnd={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / PAGE_W); if (i !== idx) { setIdx(i); play('tick'); } }}
          renderItem={({ item }) => <Plate item={item} />}
          style={{ flexGrow: 0 }}
        />

        <View style={{ padding: 16, gap: 10 }}>
          <Btn tone={isShowcase ? 'gold' : 'red'} label={isShowcase ? 'THIS IS YOUR SHOWCASE CAR' : 'MAKE IT MY SHOWCASE CAR'} disabled={isShowcase} onPress={() => { play('coin'); g.patchProfile((p) => ({ ...p, avatar: cur.e.n })); }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn small style={{ flex: 1 }} tone="navy" label="OPEN CARD" onPress={() => router.push({ pathname: '/card/[id]', params: { id: String(cur.lastId) } })} />
            <Btn small style={{ flex: 1 }} tone="navy" label="COMPARE" onPress={() => router.push({ pathname: '/compare', params: { a: String(cur.e.n) } })} />
            <Btn small style={{ flex: 1 }} tone="plain" label="CLOSE" onPress={() => router.back()} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
            {cars.slice(0, 24).map((c, i) => (
              <Pressable key={c.e.n} onPress={() => { list.current?.scrollToIndex({ index: i, animated: true }); setIdx(i); }} accessibilityLabel={`${c.e.make} ${c.e.model}`}>
                <View style={{ width: i === idx ? 14 : 8, height: 8, backgroundColor: TIER_COLOR[c.e.rarity], borderWidth: i === idx ? 2 : 1, borderColor: INK }} />
              </Pressable>
            ))}
            {cars.length > 24 ? <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: t.muted }}>+{cars.length - 24}</Text> : null}
          </View>
        </View>
      </View>
    </Screen>
  );
}
