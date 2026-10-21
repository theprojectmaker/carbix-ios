import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, Sprite } from '@/components/ui';
import generations from '@/data/generations.json';
import { CATALOG, CATALOG_BY_N, CLASS_STATS, catalogMatch, dexRank, similarCars } from '@/engine/data';
import { RTIER, TIER_COLOR, TIER_XP } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
const money = (n: number) => '$' + n.toLocaleString();
const pct = (n: number): `${number}%` => `${n}%`;
const gens = generations as unknown as Record<string, [string, string][]>;

const RARITY_TEXT: Record<string, string> = {
  Common: 'Seen every day on the road.',
  Uncommon: 'Not rare, but you do not see one every day.',
  Rare: 'A real find. Worth a second look.',
  Epic: 'Seriously uncommon. Spotting one is a good day.',
  Legendary: 'A dream car. Most spotters never see one.',
  Mythic: 'The top of the Bix. A once-in-a-blue-moon spot.',
};

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#161c2c', borderWidth: 2, borderColor: INK, paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}>
      {title ? (
        <View style={{ marginBottom: 2 }}>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: palette.gold, letterSpacing: 1.5 }}>{title}</Text>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,.12)', marginTop: 4 }} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 6 }}>
      <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.lcdDim }}>{k}</Text>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10.5, color: palette.wht, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

function Gauge({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  const filled = value > 0 ? Math.max(1, Math.round(Math.min(1, value / max) * 20)) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim, width: 34 }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', gap: 1, height: 12 }}>
        {Array.from({ length: 20 }).map((_, i) => <View key={i} style={{ flex: 1, backgroundColor: i < filled ? '#CFC6A8' : '#262E42' }} />)}
      </View>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.wht, width: 52, textAlign: 'right' }}>{text}</Text>
    </View>
  );
}

function VsBar({ label, mine, avg, unit }: { label: string; mine: number; avg: number; unit: string }) {
  const max = Math.max(mine, avg) * 1.15;
  const better = mine >= avg;
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>{label}</Text>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: better ? palette.green : palette.red }}>
          {Math.round(Math.abs(mine / avg - 1) * 100)}% {better ? 'ABOVE' : 'BELOW'} AVERAGE
        </Text>
      </View>
      <View style={{ height: 10, backgroundColor: '#222c3d' }}><View style={{ flex: 1, width: pct((mine / max) * 100), backgroundColor: better ? palette.green : palette.red }} /></View>
      <View style={{ height: 6, backgroundColor: '#222c3d' }}><View style={{ flex: 1, width: pct((avg / max) * 100), backgroundColor: '#8e98b8' }} /></View>
      <Text style={{ fontFamily: fonts.utility, fontSize: 8, color: palette.lcdDim }}>THIS CAR {Math.round(mine)}{unit}  -  AVERAGE {Math.round(avg)}{unit}</Text>
    </View>
  );
}

/** Everything the Bix knows about one car — more than the card. Unlocks as you catch it. */
export default function CarDetail() {
  const g = useGame();
  const { n } = useLocalSearchParams<{ n: string }>();
  const e = CATALOG_BY_N.get(Number(n));
  if (!e) return null;
  const caught = g.caughtNs.has(e.n);
  const mine = g.garage.filter((c) => catalogMatch(c.car)?.n === e.n).sort((a, b) => b.ts - a.ts);
  const sameMake = CATALOG.filter((c) => c.make === e.make);
  const gotMake = sameMake.filter((c) => g.caughtNs.has(c.n));
  const color = TIER_COLOR[e.rarity];
  const gl = gens[String(e.n)] ?? [];
  const mid = e.low && e.high ? (e.low + e.high) / 2 : null;
  const cs = CLASS_STATS[e.cls];
  const similar = similarCars(e);
  const yrs = (e.years || '').match(/\d{4}/g)?.map(Number) ?? [];
  const nowYear = new Date().getFullYear();
  const y0 = yrs[0];
  const y1 = /present/i.test(e.years || '') ? nowYear : (yrs[1] ?? yrs[0]);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
        <View style={{ backgroundColor: color, borderWidth: 3, borderColor: INK, padding: 7, gap: 4 }}>
        {/* hero */}
        <View style={{ borderWidth: 2, borderColor: INK, backgroundColor: '#0f1522' }}>
          <View style={{ height: 210, backgroundColor: '#161d2e', overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, backgroundColor: '#232b40' }} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 30, height: 3, flexDirection: 'row', gap: 14 }}>
              {Array.from({ length: 16 }).map((_, i) => <View key={i} style={{ width: 20, height: 3, backgroundColor: '#3b465e' }} />)}
            </View>
            <View style={{ marginBottom: 14 }}>
              <Sprite entry={e} caught={caught} size={300} tint="#56658A" shadow />
            </View>
            <Text style={{ position: 'absolute', right: 10, top: 8, fontFamily: fonts.utility, fontSize: 11, color: '#8e98b8' }}>#{String(dexRank(e.n)).padStart(4, '0')}</Text>
          </View>
          <View style={{ padding: 12, gap: 6 }}>
            <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: '#8e98b8', letterSpacing: 1.5 }}>{e.make.toUpperCase()}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 36, lineHeight: 38, color: '#fff' }}>{caught ? e.model.toUpperCase() : '? ? ?'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ backgroundColor: color, borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: ['Common', 'Legendary'].includes(e.rarity) ? INK : '#fff' }}>{e.rarity.toUpperCase()}</Text>
              </View>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: caught ? palette.green : palette.lcdDim }}>
                {caught ? `CAUGHT ${mine.length} TIME${mine.length === 1 ? '' : 'S'}` : 'NOT CAUGHT YET'}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>{RARITY_TEXT[e.rarity]}</Text>
          </View>
        </View>

        {caught ? (
          <>
            <Panel title="PERFORMANCE">
              <Gauge label="SPD" value={e.top ?? 0} max={220} text={e.top ? `${e.top} MPH` : '-'} />
              <Gauge label="HP" value={e.hp ?? 0} max={750} text={e.hp ? String(e.hp) : '-'} />
              <Gauge label="0-60" value={e.zts ? Math.max(1, 13 - parseFloat(e.zts)) : 0} max={11} text={e.zts ?? '-'} />
            </Panel>
            <Panel title="SPEC SHEET">
              <Row k="MAKE" v={e.make} />
              <Row k="MODEL" v={e.model} />
              <Row k="BODY CLASS" v={e.cls} />
              <Row k="BUILT" v={e.years ?? 'Unknown'} />
              <Row k="ENGINE" v={e.eng ?? 'Unknown'} />
              <Row k="POWER" v={e.hp ? `${e.hp} HP` : 'Unknown'} />
              <Row k="TOP SPEED" v={e.top ? `${e.top} MPH` : 'Unknown'} />
              <Row k="0-60 MPH" v={e.zts ?? 'Unknown'} />
              <Row k="USED MARKET" v={e.low && e.high ? `${money(e.low)} to ${money(e.high)}` : 'Unknown'} />
              {mid ? <Row k="TYPICAL VALUE" v={money(Math.round(mid))} /> : null}
            </Panel>
            {cs && (e.hp || e.top) ? (
              <Panel title={'VS THE AVERAGE ' + e.cls}>
                {e.hp && cs.hp ? <VsBar label="POWER" mine={e.hp} avg={cs.hp} unit=" HP" /> : null}
                {e.top && cs.top ? <VsBar label="TOP SPEED" mine={e.top} avg={cs.top} unit=" MPH" /> : null}
              </Panel>
            ) : null}
            {y0 && y1 ? (
              <Panel title="ON THE ROAD">
                <View style={{ height: 14, backgroundColor: '#222c3d', borderWidth: 2, borderColor: INK }}>
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: pct(Math.max(0, ((y0 - 1900) / 130) * 100)), width: pct(Math.max(2, ((y1 - y0 + 1) / 130) * 100)), backgroundColor: color }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: palette.lcdDim }}>1900</Text>
                  <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.wht }}>{y0} TO {/present/i.test(e.years || '') ? 'NOW' : y1}  ({y1 - y0 + 1} YEARS)</Text>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: palette.lcdDim }}>2030</Text>
                </View>
              </Panel>
            ) : null}
            <Panel title="WHAT IT IS WORTH">
              <Row k="XP FOR A CATCH" v={TIER_XP[e.rarity] + '+ XP'} />
              <Row k="RARITY" v={e.rarity.toUpperCase()} />
              {mid ? <Row k="BIX VALUE" v={money(Math.round(mid))} /> : null}
            </Panel>
            {gl.length ? (
              <Panel title="GENERATIONS">
                {gl.map(([name, yrs]) => <Row key={name} k={name} v={yrs} />)}
              </Panel>
            ) : null}
          </>
        ) : (
          <Panel title="HOW TO UNLOCK">
            <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>
              Spot this car on the road and scan it. Its full spec sheet, value and history unlock when you catch it.
            </Text>
            <Row k="BODY CLASS" v={e.cls} />
            <Row k="BUILT" v={e.years ?? 'Unknown'} />
            <Row k="XP WHEN CAUGHT" v={`${TIER_XP[e.rarity]}+`} />
          </Panel>
        )}

        {similar.length ? (
          <Panel title="SIMILAR CARS">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {similar.map((s) => {
                const got = g.caughtNs.has(s.n);
                return (
                  <Pressable key={s.n} onPress={() => { play('tab'); router.replace({ pathname: '/car/[n]', params: { n: String(s.n) } }); }}>
                    <View style={{ width: 104, backgroundColor: '#161c2c', borderWidth: 2, borderColor: got ? TIER_COLOR[s.rarity] : '#10141f', alignItems: 'center', padding: 4 }}>
                      <Sprite entry={s} caught={got} size={90} tint="#56658A" />
                      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 13, color: palette.wht }}>{got ? s.make + ' ' + s.model : '? ? ?'}</Text>
                      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: palette.gold }}>{s.hp} HP</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Panel>
        ) : null}

        <Panel title={`MORE ${e.make.toUpperCase()}`}>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.gold }}>
            {gotMake.length} OF {sameMake.length} CAUGHT
          </Text>
          <View style={{ height: 12, borderWidth: 2, borderColor: INK, backgroundColor: '#222c3d' }}>
            <View style={{ flex: 1, width: `${(gotMake.length / Math.max(1, sameMake.length)) * 100}%`, backgroundColor: palette.green }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 6 }}>
            {sameMake.filter((c) => c.n !== e.n).sort((a, b) => RTIER[b.rarity] - RTIER[a.rarity]).slice(0, 24).map((c) => (
              <Pressable key={c.n} onPress={() => { play('tab'); router.replace({ pathname: '/car/[n]', params: { n: String(c.n) } }); }}>
                <View style={{ width: 96, backgroundColor: '#161c2c', borderWidth: 2, borderColor: g.caughtNs.has(c.n) ? TIER_COLOR[c.rarity] : '#10141f', alignItems: 'center', padding: 4 }}>
                  <Sprite entry={c} caught={g.caughtNs.has(c.n)} size={84} tint="#56658A" />
                  <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 13, color: palette.wht }}>{g.caughtNs.has(c.n) ? c.model : '? ? ?'}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Panel>

        {mine.length ? (
          <Panel title="YOUR CATCHES">
            {mine.map((c) => (
              <Pressable key={c.id} onPress={() => { play('tab'); router.push({ pathname: '/card/[id]', params: { id: String(c.id) } }); }}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                  <View style={{ width: 78, height: 58, backgroundColor: '#0a0d14', borderWidth: 2, borderColor: INK, overflow: 'hidden' }}>
                    {c.photo ? <Image source={{ uri: c.photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Sprite entry={e} size={70} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 17, color: palette.wht }}>{new Date(c.ts).toLocaleDateString()}{c.shiny ? '  SHINY' : ''}</Text>
                    <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>
                      {c.car.color ? String(c.car.color).toUpperCase() + '  ' : ''}{c.geo ? `${c.geo.lat.toFixed(2)}, ${c.geo.lng.toFixed(2)}` : 'NO LOCATION'}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.red }}>CARD</Text>
                </View>
              </Pressable>
            ))}
          </Panel>
        ) : null}

        </View>
        <View style={{ height: 14 }} />
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
