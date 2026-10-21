import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { InviteFriendsPanel, InvitesPanel } from '@/components/invite-friends';
import { RaceIcon } from '@/components/pixel-icons';
import { Screen } from '@/components/screen';
import { Btn, Chip, PText } from '@/components/ui';
import type { RaceMode } from '@/engine/api';
import { isBlocked } from '@/lib/moderation';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const ago = (ts: number) => {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m}M AGO` : `${Math.round(m / 60)}H AGO`;
};

const MODES: { key: RaceMode; label: string; blurb: string }[] = [
  { key: 'xp', label: 'XP RACE', blurb: 'Most XP when the clock runs out wins.' },
  { key: 'scavenger', label: 'SCAVENGER GP', blurb: 'A 5-box spec sheet. First to tick every box wins.' },
  { key: 'elimination', label: 'LAST SPOTTER STANDING', blurb: 'The lowest-XP spotter is cut on a timer. Last one in wins.' },
];
const DURATIONS = [15, 30, 60, 120];

function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 }}>
      {title ? <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>{title}</Text> : null}
      {children}
    </View>
  );
}

export default function RaceScreen() {
  const t = useTheme();
  const r = useRace();
  const gm = useGame();
  const [mode, setMode] = useState<RaceMode>('xp');
  const [mins, setMins] = useState(30);
  const [codeIn, setCodeIn] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [seg, setSeg] = useState<'race' | 'live'>('race');
  const [liveIn, setLiveIn] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const race = r.race;
  const title = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <RaceIcon size={40} />
      <PText style={{ fontSize: 48, lineHeight: 50 }}>RACE</PText>
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }} keyboardShouldPersistTaps="handled">
        {title}
        <View style={{ flexDirection: 'row' }}>
          <Chip label="RACE" on={seg === 'race'} onPress={() => setSeg('race')} />
          <Chip label="LIVE CATCHES" on={seg === 'live'} onPress={() => setSeg('live')} />
        </View>
        {r.error ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: t.red }}>{r.error.toUpperCase()}</Text> : null}

        {seg === 'race' && !race ? <InvitesPanel /> : null}

        {seg === 'live' ? (
          !r.liveSession ? (
            <>
              <Panel title="START A LIVE SESSION">
                <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>
                  Not a race. You scan like normal and keep all your XP. Everyone with the code sees each other&apos;s catches as they happen. Locations are never shared.
                </Text>
                <Btn tone="red" label={r.busy ? 'STARTING...' : 'START LIVE SESSION'} disabled={r.busy} onPress={r.createLive} />
              </Panel>
              <Panel title="JOIN A SESSION">
                <TextInput
                  value={liveIn}
                  onChangeText={(x) => setLiveIn(x.toUpperCase())}
                  placeholder="CODE"
                  placeholderTextColor="#7f8ca6"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={5}
                  style={{ backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK, color: '#fff', fontFamily: fonts.display, fontSize: 24, paddingHorizontal: 12, paddingVertical: 10, letterSpacing: 4 }}
                />
                <Btn tone="navy" label="JOIN SESSION" disabled={r.busy || liveIn.length < 4} onPress={() => r.joinLive(liveIn)} />
              </Panel>
            </>
          ) : (
            <>
              <Panel>
                <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>LIVE SESSION CODE</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.gold, letterSpacing: 6 }}>{r.liveSession.code}</Text>
                <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
                  {r.liveSession.players.length} SPOTTER{r.liveSession.players.length === 1 ? '' : 'S'} HERE: {r.liveSession.players.map((p) => p.name).join(', ')}
                </Text>
              </Panel>
              <Panel title="CATCHES">
                {r.liveSession.catches.length === 0 ? (
                  <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>NOTHING YET. SCAN A CAR AND IT SHOWS UP HERE FOR EVERYONE.</Text>
                ) : (
                  r.liveSession.catches.filter((c) => !isBlocked(gm.profile, c.name)).slice(0, 20).map((c, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                      <View style={{ width: 84, height: 60, backgroundColor: '#0a0d14', borderWidth: 2, borderColor: INK, overflow: 'hidden' }}>
                        {c.photo ? <Image source={{ uri: c.photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.wht }} numberOfLines={1}>{c.make} {c.model}</Text>
                        <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>{c.name}  -  {c.rarity.toUpperCase()}  -  {ago(c.ts)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </Panel>
              <Btn tone="plain" label="LEAVE SESSION" onPress={r.leaveLive} />
            </>
          )
        ) : !race ? (
          <>
            <Panel title="START A RACE">
              <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
                UP TO 10 SPOTTERS. YOUR CATCHES SCORE WHILE THE RACE RUNS. LOCATION IS NEVER SHARED.
              </Text>
              {MODES.map((m) => (
                <View key={m.key} style={{ borderWidth: 2, borderColor: mode === m.key ? palette.gold : palette.line, padding: 8 }}>
                  <Text onPress={() => setMode(m.key)} style={{ fontFamily: fonts.display, fontSize: 20, color: mode === m.key ? palette.gold : palette.wht }}>{m.label}</Text>
                  <Text onPress={() => setMode(m.key)} style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim, marginTop: 2 }}>{m.blurb}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {DURATIONS.map((d) => <Chip key={d} label={d >= 60 ? `${d / 60}H` : `${d} MIN`} on={mins === d} onPress={() => setMins(d)} />)}
              </View>
              <Btn tone="red" label={r.busy ? 'CREATING...' : 'CREATE RACE'} disabled={r.busy} onPress={() => r.create(mode, mins)} />
            </Panel>
            <Panel title="JOIN WITH A CODE">
              <TextInput
                value={codeIn}
                onChangeText={(s) => setCodeIn(s.toUpperCase())}
                placeholder="ABCDE"
                placeholderTextColor="#7f8ca6"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                style={{ backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK, color: '#fff', fontFamily: fonts.display, fontSize: 24, paddingHorizontal: 12, paddingVertical: 10, letterSpacing: 4 }}
              />
              <Btn tone="navy" label="JOIN" disabled={r.busy || codeIn.length < 4} onPress={() => r.join(codeIn)} />
            </Panel>
          </>
        ) : (
          <>
            <Panel>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>RACE CODE</Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.gold, letterSpacing: 6 }}>{race.code}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>{MODES.find((m) => m.key === race.mode)?.label}</Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 34, color: palette.wht }}>
                    {race.status === 'lobby' ? `${race.durationMin} MIN` : race.status === 'running' ? clock((race.endTs ?? now) - now) : 'DONE'}
                  </Text>
                </View>
              </View>
              {race.status === 'lobby' ? (
                <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
                  SHARE THE CODE. WHEN EVERYONE IS IN, THE HOST STARTS THE CLOCK.
                </Text>
              ) : null}
              {race.status === 'finished' ? (
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.gold }}>WINNER: {race.winnerName ?? 'NOBODY'}</Text>
              ) : null}
              {race.status === 'running' && race.mode === 'elimination' && race.nextCutTs ? (
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.red }}>NEXT CUT IN {clock(race.nextCutTs - now)}</Text>
              ) : null}
            </Panel>

            {race.status !== 'finished' ? <InviteFriendsPanel /> : null}

            {race.mode === 'scavenger' && race.sheet ? (
              <Panel title="SPEC SHEET">
                {race.sheet.map((b) => {
                  const mine = race.players.find((p) => p.you)?.boxes ?? [];
                  const done = mine.includes(b.id);
                  return (
                    <View key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 6 }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: done ? palette.green : palette.wht }}>{done ? '[X] ' : '[ ] '}{b.label}</Text>
                      {b.hard ? <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.gold }}>HARD</Text> : null}
                    </View>
                  );
                })}
              </Panel>
            ) : null}

            <Panel title="STANDINGS">
              {[...race.players].sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || (b.xp - a.xp)).map((p, i) => (
                <View key={p.name + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 6 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, color: i === 0 ? palette.gold : palette.wht, width: 28 }}>{i + 1}</Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 19, color: p.out ? palette.lcdDim : p.you ? palette.gold : palette.wht, flex: 1 }} numberOfLines={1}>
                    {p.name}{p.host ? ' (HOST)' : ''}{p.out ? ' - CUT' : ''}
                  </Text>
                  <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.wht }}>
                    {race.mode === 'scavenger' ? `${p.boxes?.length ?? 0}/${race.sheet?.length ?? 5} BOXES` : `${p.xp} XP`} · {p.caught} CARS
                  </Text>
                </View>
              ))}
            </Panel>

            {race.catches.length ? (
              <Panel title="LIVE CATCHES">
                {race.catches.slice(0, 8).map((c, i) => (
                  <Text key={i} style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.wht }}>
                    {c.name} CAUGHT A {c.make} {c.model} ({c.rarity.toUpperCase()}) +{c.xp}
                  </Text>
                ))}
              </Panel>
            ) : null}

            {race.status === 'lobby' && race.you?.host ? <Btn tone="red" label={r.busy ? 'STARTING...' : 'START THE RACE'} onPress={r.start} disabled={r.busy} /> : null}
            {race.status === 'running' ? <Btn tone="red" label="GO SCAN" onPress={() => { router.back(); router.navigate('/'); }} /> : null}
            <Btn tone="plain" label={race.status === 'finished' ? 'CLOSE RACE' : 'LEAVE RACE VIEW'} onPress={r.leave} />
          </>
        )}
        <Btn tone="plain" label="BACK" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
