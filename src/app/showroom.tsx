import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText, Sprite } from '@/components/ui';
import { catalogMatch } from '@/engine/data';
import type { CatalogEntry } from '@/engine/types';
import { RTIER, TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, useTheme } from '@/theme/theme';

const INK = '#141C27';
const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_W = Math.min(SCREEN_W, 560);

/**
 * THE SHOWROOM: your cars on a stage, one at a time, rarest first. Swipe through them, pick the one that
 * represents you (it fronts your Bix and drives the loading screen), open its card or jump to compare.
 */
export default function Showroom() {
  const t = useTheme();
  const g = useGame();
  const cars = useMemo(() => {
    const seen = new Map<number, { e: CatalogEntry; count: number; lastId: number }>();
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
  const list = useRef<FlatList<{ e: CatalogEntry; count: number; lastId: number }>>(null);
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
    <Screen edges={['top', 'bottom']} plain>
      <View style={{ flex: 1, backgroundColor: '#0f1522' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
          <PText style={{ fontSize: 40, lineHeight: 42, color: '#fff' }}>SHOWROOM</PText>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 15, color: '#8e98b8', marginBottom: 6 }}>{idx + 1} OF {cars.length}</Text>
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
          renderItem={({ item }) => (
            <View style={{ width: PAGE_W, paddingHorizontal: 16, paddingTop: 10 }}>
              {/* the stage */}
              <View style={{ height: 300, backgroundColor: '#161d2e', borderWidth: 3, borderColor: INK, overflow: 'hidden', justifyContent: 'flex-end' }}>
                <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: '#8e98b8', letterSpacing: 2 }}>{item.e.make.toUpperCase()}</Text>
                  <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: TIER_COLOR[item.e.rarity], letterSpacing: 2 }}>{item.e.rarity.toUpperCase()}{item.count > 1 ? `  x${item.count}` : ''}</Text>
                </View>
                {/* spotlight cone */}
                <View style={{ position: 'absolute', left: '20%', right: '20%', top: 0, bottom: 70, backgroundColor: 'rgba(255,241,168,.06)' }} />
                <View style={{ height: 80, backgroundColor: '#232b40', borderTopWidth: 3, borderTopColor: '#2f3a52' }} />
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' }}>
                  <Sprite entry={item.e} size={Math.min(320, PAGE_W - 60)} bottom shadow crisp />
                </View>
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: '#fff', marginTop: 10 }} numberOfLines={1} adjustsFontSizeToFit>{item.e.model.toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {[[item.e.hp ? String(item.e.hp) : '-', 'HP'], [item.e.top ? String(item.e.top) : '-', 'MPH'], [item.e.zts ? String(item.e.zts).replace(/s$/i, '') : '-', '0-60'], [item.e.years ? String(item.e.years).slice(0, 4) : '-', 'FROM']].map(([v, k]) => (
                  <View key={k} style={{ flex: 1, backgroundColor: '#1a2133', borderWidth: 2, borderColor: INK, alignItems: 'center', paddingVertical: 8 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: '#F4F6FA' }}>{v}</Text>
                    <Text style={{ fontFamily: fonts.utility, fontSize: 12, color: '#8e98b8', letterSpacing: 1 }}>{k}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
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
                <View style={{ width: i === idx ? 14 : 8, height: 8, backgroundColor: i === idx ? '#fff' : TIER_COLOR[c.e.rarity], borderWidth: 1, borderColor: INK }} />
              </Pressable>
            ))}
            {cars.length > 24 ? <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: '#8e98b8' }}>+{cars.length - 24}</Text> : null}
          </View>
        </View>
      </View>
    </Screen>
  );
}
