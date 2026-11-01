import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText, Sprite } from '@/components/ui';
import { CATALOG, catalogMatch } from '@/engine/data';
import { dateKeyET } from '@/engine/store';
import type { Rarity } from '@/engine/types';
import { catchXP, TIER_COLOR } from '@/engine/xp';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const TIERS: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const RT: Record<string, number> = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5 };
const DAY = 86400000;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>{title}</Text>
      {children}
    </View>
  );
}
const Big = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flex: 1, minWidth: '30%', backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', padding: 8, alignItems: 'center' }}>
    <Text style={{ fontFamily: fonts.display, fontSize: 24, color: palette.gold }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: palette.lcdDim, letterSpacing: 1 }}>{label}</Text>
  </View>
);

/** Your spotting, in numbers: totals, a 12-week heat grid, rarity mix, top brands, best days. */
export default function Stats() {
  const t = useTheme();
  const g = useGame();
  const [now] = useState(() => Date.now());

  const s = useMemo(() => {
    const garage = g.garage;
    const byDay = new Map<string, number>();
    for (const c of garage) byDay.set(dateKeyET(new Date(c.ts)), (byDay.get(dateKeyET(new Date(c.ts))) || 0) + 1);
    const days = byDay.size;
    const first = garage.length ? Math.min(...garage.map((c) => c.ts)) : now;
    const span = Math.max(1, Math.round((now - first) / DAY) + 1);
    const bestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const perTier: Record<string, number> = {};
    for (const c of garage) perTier[c.car.rarity] = (perTier[c.car.rarity] || 0) + 1;
    const brands = new Map<string, number>();
    for (const c of garage) brands.set(c.car.make, (brands.get(c.car.make) || 0) + 1);
    const topBrands = [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const classes = new Map<string, number>();
    for (const c of garage) { const e = catalogMatch(c.car); const k = (e?.cls || c.car.class || 'OTHER').toUpperCase(); classes.set(k, (classes.get(k) || 0) + 1); }
    const topClasses = [...classes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const rarest = [...garage].sort((a, b) => (RT[b.car.rarity] ?? 0) - (RT[a.car.rarity] ?? 0) || b.ts - a.ts)[0];
    const xp = garage.reduce((a, c) => a + catchXP(c.car), 0);
    // 12 weeks of days, oldest first, each with its count
    const grid: { key: string; n: number }[] = [];
    const today = new Date(now);
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const k = dateKeyET(d);
      grid.push({ key: k, n: byDay.get(k) || 0 });
    }
    const last7 = grid.slice(-7).reduce((a, d) => a + d.n, 0);
    const prev7 = grid.slice(-14, -7).reduce((a, d) => a + d.n, 0);
    const shinies = garage.filter((c) => c.shiny).length;
    const uniqueMakes = new Set(CATALOG.map((c) => c.make)).size;
    return { days, span, bestDay, perTier, topBrands, topClasses, rarest, xp, grid, last7, prev7, shinies, brands: brands.size, uniqueMakes };
  }, [g.garage, now]);

  const maxTier = Math.max(1, ...TIERS.map((r) => s.perTier[r] || 0));
  const maxBrand = Math.max(1, ...s.topBrands.map((b) => b[1]));
  const rarestE = s.rarest ? catalogMatch(s.rarest.car) : null;
  const heat = (n: number) => (n === 0 ? '#1d2436' : n === 1 ? '#4c6a3a' : n <= 3 ? '#6f9a4a' : n <= 6 ? '#9ccc5c' : '#d7f27a');

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>STATS</PText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Big label="CATCHES" value={String(g.garage.length)} />
          <Big label="IN THE BIX" value={`${g.caughtNs.size}`} />
          <Big label="BRANDS" value={`${s.brands}/${s.uniqueMakes}`} />
          <Big label="SHINIES" value={String(s.shinies)} />
          <Big label="DAYS SPOTTING" value={String(s.days)} />
          <Big label="PER ACTIVE DAY" value={s.days ? (g.garage.length / s.days).toFixed(1) : '0'} />
        </View>

        <Panel title="LAST 12 WEEKS">
          <View style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
            {Array.from({ length: 12 }).map((_, w) => (
              <View key={w} style={{ gap: 3 }}>
                {s.grid.slice(w * 7, w * 7 + 7).map((d) => (
                  <View key={d.key} style={{ width: 18, height: 18, backgroundColor: heat(d.n), borderWidth: 1, borderColor: '#10141f' }} accessibilityLabel={`${d.key}: ${d.n}`} />
                ))}
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
            THIS WEEK {s.last7}  -  LAST WEEK {s.prev7}  -  {s.last7 >= s.prev7 ? 'UP' : 'DOWN'} {Math.abs(s.last7 - s.prev7)}
            {s.bestDay ? `  -  BEST DAY ${s.bestDay[1]} CATCHES ON ${s.bestDay[0]}` : ''}
          </Text>
        </Panel>

        <Panel title="RARITY MIX">
          {TIERS.map((r) => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: TIER_COLOR[r], width: 76 }}>{r.toUpperCase()}</Text>
              <View style={{ flex: 1, height: 12, backgroundColor: '#161c2c', borderWidth: 1, borderColor: '#10141f' }}>
                <View style={{ width: `${((s.perTier[r] || 0) / maxTier) * 100}%`, height: '100%', backgroundColor: TIER_COLOR[r] }} />
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 16, color: palette.wht, width: 36, textAlign: 'right' }}>{s.perTier[r] || 0}</Text>
            </View>
          ))}
        </Panel>

        {s.rarest && rarestE ? (
          <Panel title="RAREST CATCH">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Sprite entry={rarestE} size={110} shadow />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }} numberOfLines={2}>{s.rarest.car.make} {s.rarest.car.model}</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: TIER_COLOR[s.rarest.car.rarity] }}>{s.rarest.car.rarity.toUpperCase()}  -  +{catchXP(s.rarest.car)} XP</Text>
                <Btn small tone="navy" label="OPEN CARD" onPress={() => router.push({ pathname: '/card/[id]', params: { id: String(s.rarest!.id) } })} />
              </View>
            </View>
          </Panel>
        ) : null}

        <Panel title="TOP BRANDS">
          {s.topBrands.length === 0 ? <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>NOTHING YET.</Text> : s.topBrands.map(([b, n]) => (
            <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 16, color: palette.wht, width: 110 }} numberOfLines={1}>{b.toUpperCase()}</Text>
              <View style={{ flex: 1, height: 12, backgroundColor: '#161c2c', borderWidth: 1, borderColor: '#10141f' }}>
                <View style={{ width: `${(n / maxBrand) * 100}%`, height: '100%', backgroundColor: palette.gold }} />
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 16, color: palette.gold, width: 36, textAlign: 'right' }}>{n}</Text>
            </View>
          ))}
        </Panel>

        <Panel title="BODY TYPES">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {s.topClasses.map(([k, n]) => (
              <View key={k} style={{ backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', gap: 6 }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.lcdDim }}>{k}</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.gold }}>{n}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>{s.xp.toLocaleString()} XP FROM CATCHES OVER {s.span} DAY{s.span === 1 ? '' : 'S'}.</Text>
        </Panel>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn small style={{ flex: 1 }} tone="navy" label="GALLERY" onPress={() => router.push('/gallery')} />
          <Btn small style={{ flex: 1 }} tone="plain" label="CLOSE" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
