import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText, Sprite } from '@/components/ui';
import { CATALOG_BY_N, catalogMatch } from '@/engine/data';
import type { CatalogEntry } from '@/engine/types';
import { TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const zts = (e: CatalogEntry) => parseFloat(String(e.zts ?? '')) || 0;
const yearStart = (e: CatalogEntry) => parseInt(String(e.years ?? ''), 10) || 0;

type Row = { label: string; a: number; b: number; fmt: (v: number) => string; lowerWins?: boolean };

function Pick({ e, label, on, onPress }: { e?: CatalogEntry; label: string; on: boolean; onPress: () => void }) {
  return (
  <Pressable style={{ flex: 1 }} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Pick ${label}`}>
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: on ? palette.gold : INK, padding: 8, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 13, color: on ? palette.gold : palette.lcdDim, letterSpacing: 1.5 }}>{label}{on ? '  -  TAP A CAR BELOW' : ''}</Text>
      {e ? <Sprite entry={e} size={120} shadow /> : <View style={{ height: 84 }} />}
      <Text style={{ fontFamily: fonts.display, fontSize: 17, color: palette.wht, textAlign: 'center' }} numberOfLines={2}>{e ? `${e.make} ${e.model}` : 'PICK ONE'}</Text>
      {e ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 12, color: TIER_COLOR[e.rarity] }}>{e.rarity.toUpperCase()}</Text> : null}
    </View>
  </Pressable>
  );
}

/** Two of your cars side by side. Pick either side from everything you have caught. */
export default function Compare() {
  const t = useTheme();
  const g = useGame();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();

  const mine = useMemo(() => {
    const seen = new Set<number>();
    const out: CatalogEntry[] = [];
    for (const c of g.garage) {
      const e = catalogMatch(c.car);
      if (e && !seen.has(e.n)) { seen.add(e.n); out.push(e); }
    }
    return out;
  }, [g.garage]);

  const [aN, setA] = useState<number>(() => Number(params.a) || mine[0]?.n || 0);
  const [bN, setB] = useState<number>(() => Number(params.b) || mine.find((e) => e.n !== (Number(params.a) || mine[0]?.n))?.n || 0);
  const [side, setSide] = useState<'a' | 'b'>('b');
  const A = CATALOG_BY_N.get(aN);
  const B = CATALOG_BY_N.get(bN);

  const rows: Row[] = A && B ? [
    { label: 'POWER', a: A.hp || 0, b: B.hp || 0, fmt: (v) => (v ? `${v} HP` : '?') },
    { label: 'TOP SPEED', a: A.top || 0, b: B.top || 0, fmt: (v) => (v ? `${v} MPH` : '?') },
    { label: '0-60', a: zts(A), b: zts(B), fmt: (v) => (v ? `${v.toFixed(1)}s` : '?'), lowerWins: true },
    { label: 'NEWEST YEAR', a: yearStart(A), b: yearStart(B), fmt: (v) => (v ? String(v) : '?') },
    { label: 'VALUE (HIGH)', a: A.high || 0, b: B.high || 0, fmt: (v) => (v ? `$${Math.round(v / 1000)}K` : '?') },
  ] : [];
  const wins = rows.reduce((acc, r) => {
    if (!r.a || !r.b || r.a === r.b) return acc;
    const aWins = r.lowerWins ? r.a < r.b : r.a > r.b;
    return { a: acc.a + (aWins ? 1 : 0), b: acc.b + (aWins ? 0 : 1) };
  }, { a: 0, b: 0 });

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>COMPARE</PText>
        {mine.length < 2 ? (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, gap: 8 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.wht }}>CATCH TWO DIFFERENT CARS FIRST.</Text>
            <Btn small tone="red" label="SCAN" onPress={() => { router.back(); router.navigate('/'); }} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pick e={A} label="A" on={side === 'a'} onPress={() => { play('click'); setSide('a'); }} />
              <Pick e={B} label="B" on={side === 'b'} onPress={() => { play('click'); setSide('b'); }} />
            </View>

            {A && B ? (
              <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 }}>
                {rows.map((r) => {
                  const aWins = r.a && r.b && r.a !== r.b && (r.lowerWins ? r.a < r.b : r.a > r.b);
                  const bWins = r.a && r.b && r.a !== r.b && !aWins;
                  return (
                    <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 6 }}>
                      <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, color: aWins ? palette.gold : palette.wht }}>{r.fmt(r.a)}</Text>
                      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 12, color: palette.lcdDim, letterSpacing: 1, width: 90, textAlign: 'center' }}>{r.label}</Text>
                      <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, color: bWins ? palette.gold : palette.wht, textAlign: 'right' }}>{r.fmt(r.b)}</Text>
                    </View>
                  );
                })}
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: palette.gold, textAlign: 'center', paddingTop: 4 }}>
                  {wins.a === wins.b ? 'DEAD HEAT' : wins.a > wins.b ? `${A.model.toUpperCase()} WINS ${wins.a}-${wins.b}` : `${B.model.toUpperCase()} WINS ${wins.b}-${wins.a}`}
                </Text>
              </View>
            ) : null}

            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: t.muted, letterSpacing: 1.5 }}>YOUR CARS  -  TAP TO SET {side.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {mine.map((e) => (
                <Pressable key={e.n} onPress={() => { play('tab'); if (side === 'a') setA(e.n); else setB(e.n); setSide(side === 'a' ? 'b' : 'a'); }} accessibilityRole="button" accessibilityLabel={`${e.make} ${e.model}`}>
                  <View style={{ width: 92, backgroundColor: '#161c2c', borderWidth: 2, borderColor: e.n === aN || e.n === bN ? palette.gold : '#10141f', borderTopWidth: 4, borderTopColor: TIER_COLOR[e.rarity], alignItems: 'center', padding: 3 }}>
                    <Sprite entry={e} size={80} />
                    <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 11, color: palette.wht }}>{e.model.toUpperCase()}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
