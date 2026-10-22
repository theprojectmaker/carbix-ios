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

const Tile = memo(function Tile({ item, caught, count }: { item: CatalogEntry; caught: boolean; count: number }) {
  return (
    <Pressable
      style={{ flex: 1 / COLS, padding: 5 }}
      onPress={() => { play('tab'); router.push({ pathname: '/car/[n]', params: { n: String(item.n) } }); }}
      accessibilityRole="button"
      accessibilityLabel={caught ? `${item.make} ${item.model}, caught` : `Number ${dexRank(item.n)}, not caught`}>
      <View style={{ backgroundColor: '#0d1119', padding: 2 }}>
        <View style={{ backgroundColor: '#232E3F', borderWidth: 4, borderColor: '#4A5568', borderTopWidth: 7, borderTopColor: caught ? TIER_COLOR[item.rarity] : '#3A4456', paddingHorizontal: 4, paddingBottom: 6, paddingTop: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            {count > 1 ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: INK, backgroundColor: TIER_COLOR[item.rarity], paddingHorizontal: 4, paddingVertical: 1 }}>x{count}</Text> : <View />}
            <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: '#8b96b8' }}>#{String(dexRank(item.n)).padStart(4, '0')}</Text>
          </View>
          <View style={{ backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', height: 62, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Sprite entry={item} caught={caught} size={80} tint="#56658A" crisp={caught} shadow={caught} />
          </View>
          <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: 13, lineHeight: 14, color: palette.wht, textAlign: 'center', marginTop: 5, minHeight: 28 }}>
            {caught ? `${item.make} ${item.model}` : ' '}
          </Text>
        </View>
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
  const [menu, setMenu] = useState(false);
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
    return { best: best?.e ?? null, perTier, value, brands: brands.size, near };
  }, [g.garage]);

  const renderItem = useCallback(
    ({ item }: { item: CatalogEntry }) => <Tile item={item} caught={g.caughtNs.has(item.n)} count={counts.get(item.n) ?? 0} />,
    [g.caughtNs, counts],
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TopKey label="DECK" on={caughtOnly} onPress={() => { play('click'); setCaughtOnly(!caughtOnly); }} />
          <TopKey label={sort} onPress={() => { play('click'); setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]); }} />
          <TopKey
            label="RAND"
            onPress={() => {
              play('click');
              const e = CATALOG[Math.floor(Math.random() * CATALOG.length)];
              router.push({ pathname: '/car/[n]', params: { n: String(e.n) } });
            }}
          />
          <TopKey label="FILTER" on={menu} onPress={() => { play('click'); setMenu(!menu); }} />
        </View>
      </View>

      {menu ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="ALL" on={!tier} onPress={() => setTier('')} />
          {TIERS.map((r) => (
            <Chip key={r} label={r.toUpperCase()} on={tier === r} onPress={() => setTier(tier === r ? '' : r)} />
          ))}
        </View>
      ) : null}

      {/* showroom: your best car on a road strip */}
      <View onLayout={(e) => setRoomW(e.nativeEvent.layout.width)} style={{ backgroundColor: '#0f1522', borderWidth: 3, borderColor: INK }}>
        <View style={{ height: 190, backgroundColor: '#161d2e', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 62, backgroundColor: '#232b40' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 30, height: 3, flexDirection: 'row', gap: 14 }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <View key={i} style={{ width: 20, height: 3, backgroundColor: '#3b465e' }} />
            ))}
          </View>
          <View style={{ position: 'absolute', left: 14, top: 12, gap: 4 }}>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: '#8e98b8', letterSpacing: 1.5 }}>{stats.best ? stats.best.make.toUpperCase() : 'YOUR BEST CAR'}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }}>{stats.best ? stats.best.model.toUpperCase() : 'CATCH A CAR'}</Text>
            {stats.best ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: TIER_COLOR[stats.best.rarity], borderWidth: 2, borderColor: INK, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: ['Common', 'Legendary'].includes(stats.best.rarity) ? INK : '#fff' }}>{stats.best.rarity.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
          {stats.best ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: -14, alignItems: 'center' }}>
              <Sprite entry={stats.best} size={Math.min(300, roomW - 40)} shadow />
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', borderTopWidth: 2, borderTopColor: '#0b0f18' }}>
          {[['CAUGHT', g.garage.length], ['IN BIX', g.caughtNs.size], ['BRANDS', stats.brands]].map(([k, v], i) => (
            <View key={String(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderLeftWidth: i ? 1 : 0, borderLeftColor: '#1d2436' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 38, lineHeight: 40, color: palette.gold }}>{v}</Text>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: '#8e98b8', letterSpacing: 1.5, marginTop: 6 }}>{k}</Text>
            </View>
          ))}
        </View>
        <View style={{ paddingHorizontal: 14, gap: 8, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: '#aab4cc', letterSpacing: 1 }}>BIX COMPLETION</Text>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: '#aab4cc' }}>{g.bixPct.toFixed(1)}%</Text>
          </View>
          <Bar value={g.bixPct / 100} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: '#aab4cc', letterSpacing: 1 }}>EST. COLLECTION VALUE</Text>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: '#aab4cc' }}>{bigMoney(stats.value)}</Text>
          </View>
          <Plate color="#2d3d58" depth={0} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 12, color: '#6f7b97', letterSpacing: 2 }}>SHOWROOM</Text>
          </Plate>
        </View>
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
