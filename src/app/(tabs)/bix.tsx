import { router } from 'expo-router';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { Plate } from '@/components/plate';
import { Screen } from '@/components/screen';
import { Bar, Chip, Sprite } from '@/components/ui';
import { norm } from '@/engine/catalog';
import { CATALOG, DISPLAY_RANK, catalogMatch, dexRank } from '@/engine/data';
import type { CatalogEntry, Rarity } from '@/engine/types';
import { RTIER, TIERS, TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
const ORDERED = [...CATALOG].sort((a, b) => (DISPLAY_RANK.get(a.n) || 0) - (DISPLAY_RANK.get(b.n) || 0));
const COLS = 3;
const SORTS = ['POP', 'RARE', 'NEW', 'A-Z'] as const;
type SortMode = (typeof SORTS)[number];

const bigMoney = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`);

const Tile = memo(function Tile({ item, caught, count, crisp, hint }: { item: CatalogEntry; caught: boolean; count: number; crisp: boolean; hint: boolean }) {
  return (
    <Pressable
      style={{ flex: 1 / COLS, padding: 5 }}
      onPress={() => { play('tab'); router.push({ pathname: '/car/[n]', params: { n: String(item.n) } }); }}
      accessibilityRole="button"
      accessibilityLabel={caught ? `${item.make} ${item.model}, caught` : `Number ${dexRank(item.n)}, not caught`}>
      <View style={{ backgroundColor: caught ? '#1E2833' : '#1A212C', borderWidth: 3, borderColor: INK, borderTopWidth: 6, borderTopColor: caught ? TIER_COLOR[item.rarity] : '#3A4456', padding: 5, gap: 4 }}>
        <View style={{ backgroundColor: '#10151f', height: 62, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Sprite entry={item} caught={caught} size={80} tint="#3E4A62" crisp={crisp} shadow={caught} />
          <Text style={{ position: 'absolute', top: 2, right: 4, fontFamily: fonts.utility, fontSize: 8.5, color: '#5f6b86' }}>{String(dexRank(item.n)).padStart(4, '0')}</Text>
          {count > 1 ? <Text style={{ position: 'absolute', top: 2, left: 4, fontFamily: fonts.utilityBold, fontSize: 9, color: INK, backgroundColor: TIER_COLOR[item.rarity], paddingHorizontal: 4 }}>x{count}</Text> : null}
        </View>
        {caught ? (
          <View style={{ minHeight: 30 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.utility, fontSize: 8.5, color: '#8b96b8', letterSpacing: 1 }}>{item.make.toUpperCase()}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 15, lineHeight: 16, color: palette.wht }}>{item.model.toUpperCase()}</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: '#4f5a73', letterSpacing: 1, minHeight: 30, paddingTop: 4 }} numberOfLines={2}>{hint ? item.make.toUpperCase() + '\nNOT SPOTTED' : 'NOT SPOTTED'}</Text>
        )}
      </View>
    </Pressable>
  );
});

export default function Garage() {
  const g = useGame();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<Rarity | ''>('');
  const [caughtOnly, setCaughtOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>('POP');
  const [roomW, setRoomW] = useState(320);

  const rows = useMemo(() => {
    const nq = norm(q);
    const list = ORDERED.filter(
      (c) => (!tier || c.rarity === tier) && (!caughtOnly || g.caughtNs.has(c.n)) && (!nq || norm(c.make + c.model).includes(nq)),
    );
    if (sort === 'RARE') list.sort((a, b) => RTIER[b.rarity] - RTIER[a.rarity] || a.n - b.n);
    else if (sort === 'A-Z') list.sort((a, b) => (a.make + a.model).localeCompare(b.make + b.model));
    else if (sort === 'NEW') {
      const first = new Map<number, number>();
      for (const c of g.garage) {
        const h = catalogMatch(c.car);
        if (h && (first.get(h.n) ?? 0) < c.ts) first.set(h.n, c.ts);
      }
      list.sort((a, b) => (first.get(b.n) ?? 0) - (first.get(a.n) ?? 0));
    }
    return list;
  }, [q, tier, caughtOnly, sort, g.caughtNs, g.garage]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of g.garage) {
      const h = catalogMatch(c.car);
      if (h) m.set(h.n, (m.get(h.n) ?? 0) + 1);
    }
    return m;
  }, [g.garage]);

  const stats = useMemo(() => {
    let best: { e: CatalogEntry; ts: number } | null = null;
    const perTier: Record<string, number> = {};
    let value = 0;
    const brands = new Set<string>();
    const counted = new Set<number>();
    for (const c of g.garage) {
      brands.add(c.car.make);
      const e = catalogMatch(c.car);
      value += e && e.low && e.high ? (e.low + e.high) / 2 : 8000;
      if (e && !counted.has(e.n)) {
        counted.add(e.n);
        perTier[e.rarity] = (perTier[e.rarity] || 0) + 1;
      }
      if (e && (!best || RTIER[e.rarity] > RTIER[best.e.rarity] || (RTIER[e.rarity] === RTIER[best.e.rarity] && c.ts > best.ts))) best = { e, ts: c.ts };
    }
    // "almost there": the brand set closest to complete
    const per: Record<string, { total: number; got: number }> = {};
    for (const c of CATALOG) (per[c.make] = per[c.make] || { total: 0, got: 0 }).total++;
    for (const n of counted) {
      const e = CATALOG.find((x) => x.n === n);
      if (e) per[e.make].got++;
    }
    const near = Object.entries(per)
      .filter(([, v]) => v.total >= 2 && v.got > 0 && v.got < v.total)
      .sort((a, b) => b[1].got / b[1].total - a[1].got / a[1].total || a[1].total - a[1].got - (b[1].total - b[1].got))[0];
    const showcase = (g.profile.avatar ? CATALOG.find((c) => c.n === g.profile.avatar && counted.has(c.n)) : null) || best?.e || null;
    return { best: showcase, perTier, value, brands: brands.size, near };
  }, [g.garage, g.profile.avatar]);

  const renderItem = useCallback(
    ({ item }: { item: CatalogEntry }) => <Tile item={item} caught={g.caughtNs.has(item.n)} count={counts.get(item.n) ?? 0} crisp={g.settings.crispTiles !== false} hint={!!g.settings.hintNames} />,
    [g.caughtNs, counts, g.settings.crispTiles, g.settings.hintNames],
  );

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 48, lineHeight: 50, color: INK }}>BIX</Text>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: INK, marginBottom: 6 }}>
            {g.caughtNs.size}/{CATALOG.length.toLocaleString()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TopKey label="DECK" on={caughtOnly} onPress={() => { play('click'); setCaughtOnly(!caughtOnly); }} />
          <TopKey
            label="RAND"
            onPress={() => {
              play('click');
              const e = CATALOG[Math.floor(Math.random() * CATALOG.length)];
              router.push({ pathname: '/car/[n]', params: { n: String(e.n) } });
            }}
          />
          <TopKey label="PHOTOS" onPress={() => { play('whoosh'); router.push('/gallery'); }} />
          <TopKey label="STATS" onPress={() => { play('whoosh'); router.push('/stats'); }} />
        </View>
      </View>

      {/* the garage card: your showcase car on a stage, then the numbers that matter */}
      <View onLayout={(e) => setRoomW(e.nativeEvent.layout.width)} style={{ backgroundColor: '#0f1522', borderWidth: 3, borderColor: INK }}>
        <Pressable onPress={() => { play('whoosh'); router.push('/showroom'); }} accessibilityRole="button" accessibilityLabel="Open the showroom">
          <View style={{ height: 176, backgroundColor: '#161d2e', overflow: 'hidden', justifyContent: 'flex-end' }}>
            <View style={{ position: 'absolute', top: 12, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: '#8e98b8', letterSpacing: 2 }}>{stats.best ? (g.profile.avatar === stats.best.n ? 'YOUR SHOWCASE' : 'YOUR BEST CAR') : 'SHOWROOM'}</Text>
              {stats.best ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: TIER_COLOR[stats.best.rarity], letterSpacing: 2 }}>{stats.best.rarity.toUpperCase()}</Text> : null}
            </View>
            <View style={{ height: 46, backgroundColor: '#232b40', borderTopWidth: 3, borderTopColor: '#2f3a52' }} />
            {stats.best ? (
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 30, alignItems: 'center' }}>
                <Sprite entry={stats.best} size={Math.min(250, roomW - 60)} shadow />
              </View>
            ) : (
              <Text style={{ position: 'absolute', left: 14, bottom: 60, fontFamily: fonts.display, fontSize: 22, color: '#fff' }}>CATCH A CAR TO PARK IT HERE</Text>
            )}
            <View style={{ position: 'absolute', left: 14, bottom: 12, right: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }} numberOfLines={1}>{stats.best ? `${stats.best.make.toUpperCase()} ${stats.best.model.toUpperCase()}` : ''}</Text>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.gold, letterSpacing: 1 }}>SHOWROOM ›</Text>
            </View>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', borderTopWidth: 2, borderTopColor: '#0b0f18' }}>
          {[['CAUGHT', g.garage.length], ['IN BIX', g.caughtNs.size], ['BRANDS', stats.brands], ['VALUE', bigMoney(stats.value)]].map(([k, v], i) => (
            <View key={String(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderLeftWidth: i ? 1 : 0, borderLeftColor: '#1d2436' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: palette.gold }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: '#8e98b8', letterSpacing: 1.5, marginTop: 2 }}>{k}</Text>
            </View>
          ))}
        </View>
        <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9.5, color: '#aab4cc', letterSpacing: 1 }}>BIX COMPLETE</Text>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9.5, color: '#aab4cc' }}>{g.bixPct.toFixed(1)}%  -  {CATALOG.length - g.caughtNs.size} TO GO</Text>
          </View>
          <Bar value={g.bixPct / 100} />
        </View>
      </View>

      {/* sort */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9.5, color: palette.navyDk, letterSpacing: 1.5, marginRight: 4 }}>SORT</Text>
        {SORTS.map((m) => <Chip key={m} label={m} on={sort === m} onPress={() => { play('click'); setSort(m); }} />)}
      </View>

      {/* tier shelf */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {TIERS.map((r) => (
          <Pressable key={r} style={{ flex: 1 }} onPress={() => setTier(tier === r ? '' : r)}>
            <View style={{ backgroundColor: '#141c2a', borderWidth: 2, borderColor: tier === r ? '#fff' : INK, borderTopWidth: 6, borderTopColor: TIER_COLOR[r], alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, color: '#fff', lineHeight: 26 }}>{stats.perTier[r] || 0}</Text>
              <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: '#aab4cc', marginTop: 8 }}>{r.slice(0, 4).toUpperCase()}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: palette.navyDk, letterSpacing: 2 }}>SEARCH THE BIX</Text>
        <View style={{ backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Make or model…"
            placeholderTextColor="#7f8ca6"
            autoCorrect={false}
            autoCapitalize="none"
            style={{ color: '#fff', fontFamily: fonts.display, fontSize: 20, paddingHorizontal: 14, paddingVertical: 14 }}
          />
        </View>
      </View>

      {stats.near ? (
        <View style={{ backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK, paddingHorizontal: 14, paddingVertical: 14 }}>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10.5, color: '#fff', letterSpacing: 1 }}>
            <Text style={{ color: palette.gold }}>ALMOST THERE — {stats.near[0].toUpperCase()} </Text>
            {stats.near[1].got}/{stats.near[1].total} · {stats.near[1].total - stats.near[1].got} TO GO
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]}>
      <FlatList
        data={rows}
        keyExtractor={(c) => String(c.n)}
        numColumns={COLS}
        renderItem={renderItem}
        ListHeaderComponent={header}
        initialNumToRender={9}
        maxToRenderPerBatch={9}
        updateCellsBatchingPeriod={60}
        windowSize={5}
        removeClippedSubviews
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        columnWrapperStyle={undefined}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30, color: palette.navyDk, fontFamily: fonts.display, fontSize: 18 }}>NO CARS MATCH.</Text>}
      />
    </Screen>
  );
}

function TopKey({ label, onPress, on }: { label: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <Plate color={on ? palette.red : palette.navy} depth={3} pressed={pressed} style={{ minWidth: 40, height: 38, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10.5, color: '#fff', letterSpacing: 1 }}>{label}</Text>
        </Plate>
      )}
    </Pressable>
  );
}
