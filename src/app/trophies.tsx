import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, Chip, PText } from '@/components/ui';
import { currentEra, eraProgress, lineagePlaques, marqueMedals, seasonProgress, seasonTheme, setProgress, TITLES } from '@/engine/extras';
import { currentSeason } from '@/engine/quests';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const MEDCOL = { GOLD: '#C9A227', SILVER: '#AFC5CE', BRONZE: '#8C5A2B' };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#161c2c', borderWidth: 2, borderColor: INK, padding: 12, gap: 6 }}>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: palette.gold, letterSpacing: 1.5 }}>{title}</Text>
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,.12)' }} />
      {children}
    </View>
  );
}
function Row({ l, r, c }: { l: string; r: string; c?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 17, color: palette.wht }}>{l}</Text>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: c ?? palette.gold, alignSelf: 'center' }}>{r}</Text>
    </View>
  );
}

/** Trophy room: season medal, era passport, marque medallions, lineage plaques, collection sets, and your title. */
export default function Trophies() {
  const t = useTheme();
  const g = useGame();
  const [tab, setTab] = useState<'trophies' | 'sets' | 'titles'>('trophies');
  const s = currentSeason();
  const th = seasonTheme();
  const sp = seasonProgress(g.garage);
  const e = currentEra();
  const ep = eraProgress(g.garage, e);
  const medals = useMemo(() => marqueMedals(g.garage), [g.garage]);
  const plaques = useMemo(() => lineagePlaques(g.garage), [g.garage]);
  const sets = useMemo(() => setProgress(g.garage), [g.garage]);
  const sm = (g.profile.seasonMedals || {}) as Record<string, { name: string; theme: string }>;
  const stamps = Object.entries((g.profile.eraStamps || {}) as Record<string, string>);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>TROPHIES</PText>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="TROPHY ROOM" on={tab === 'trophies'} onPress={() => setTab('trophies')} />
          <Chip label="SETS" on={tab === 'sets'} onPress={() => setTab('sets')} />
          <Chip label="TITLES" on={tab === 'titles'} onPress={() => setTab('titles')} />
        </View>

        {tab === 'trophies' ? (
          <>
            <Panel title={`THIS SEASON  -  ${s.name}`}>
              <Row l={`${th.label}  ${Math.min(sp, th.n)}/${th.n}`} r={sm[s.key] ? 'MEDAL EARNED' : 'IN PLAY'} c={sm[s.key] ? palette.green : palette.lcdDim} />
            </Panel>
            <Panel title="ERA MONTH">
              <Row l={`${e.dec[2]}  ${Math.min(ep, 10)}/10 CATCHES`} r={(g.profile.eraStamps as Record<string, string> | undefined)?.[e.ym] ? 'STAMPED' : 'OPEN'} c={palette.lcdDim} />
            </Panel>
            {Object.keys(sm).length ? (
              <Panel title="SEASON MEDALS">{Object.values(sm).map((m, i) => <Row key={i} l={m.name} r={m.theme} />)}</Panel>
            ) : null}
            {stamps.length ? <Panel title="ERA PASSPORT">{stamps.map(([ym, d]) => <Row key={ym} l={ym} r={d} />)}</Panel> : null}
            {medals.length ? (
              <Panel title="MARQUE MEDALLIONS">
                {medals.slice(0, 16).map((m) => <Row key={m.mk} l={`${m.mk}  ${m.got}/${m.total}`} r={m.medal} c={MEDCOL[m.medal]} />)}
              </Panel>
            ) : null}
            {plaques.length ? <Panel title="LINEAGE PLAQUES">{plaques.map((p) => <Row key={p.label} l={p.label} r={`${p.n} CAUGHT`} />)}</Panel> : null}
            {!medals.length && !plaques.length && !stamps.length ? (
              <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: t.muted }}>Catch more cars to earn medallions, plaques and stamps.</Text>
            ) : null}
          </>
        ) : null}

        {tab === 'sets' ? (
          <Panel title="COLLECTION SETS">
            {sets.map((x) => (
              <View key={x.nm} style={{ gap: 3 }}>
                <Row l={x.nm} r={x.done ? 'COMPLETE' : `${x.got}/${x.tot}`} c={x.done ? palette.green : palette.lcdDim} />
                <View style={{ height: 8, backgroundColor: '#222c3d' }}>
                  <View style={{ flex: 1, width: `${x.tot ? (x.got / x.tot) * 100 : 0}%`, backgroundColor: x.done ? palette.green : '#5C7AA0' }} />
                </View>
              </View>
            ))}
          </Panel>
        ) : null}

        {tab === 'titles' ? (
          <Panel title="CHOOSE YOUR TITLE">
            {TITLES.map((tt) => {
              const ok = tt.ok(g.garage, g.profile);
              const cur = g.profile.title === tt.name;
              return (
                <View key={tt.name} style={{ opacity: ok ? 1 : 0.45, gap: 4 }}>
                  <Btn
                    small
                    tone={cur ? 'gold' : 'navy'}
                    label={`${tt.name}${cur ? '  (WORN)' : ''}`}
                    disabled={!ok}
                    onPress={() => { play('tab'); g.patchProfile((p) => ({ ...p, title: tt.name })); }}
                  />
                  <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: palette.lcdDim }}>{ok ? 'UNLOCKED' : `LOCKED - ${tt.hint.toUpperCase()}`}</Text>
                </View>
              );
            })}
          </Panel>
        ) : null}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
