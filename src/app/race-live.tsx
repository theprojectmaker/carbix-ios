import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { RaceIcon } from '@/components/pixel-icons';
import { RACE_GREEN, RACE_GREEN_DK, clock, useNow, usePulse, useRaceStatus } from '@/components/race-pill';
import { Screen } from '@/components/screen';
import { Btn, PText } from '@/components/ui';
import type { RaceMode, RacePlayer } from '@/engine/api';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
const MODE_LABEL: Record<RaceMode, string> = { xp: 'XP RACE', scavenger: 'SCAVENGER GP', elimination: 'LAST SPOTTER STANDING' };
const ago = (ts: number) => {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m}M AGO` : `${Math.round(m / 60)}H AGO`;
};

function Panel({ title, children, tint }: { title?: string; children: React.ReactNode; tint?: string }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: tint ?? INK, padding: 12, gap: 8 }}>
      {title ? <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: RACE_GREEN }}>» </Text>{title}</Text> : null}
      {children}
    </View>
  );
}

function Tile({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 96, backgroundColor: '#1E2833', borderWidth: 3, borderColor: INK, paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 13, color: palette.lcdDim, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 34, color: gold ? palette.gold : palette.wht }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={{ fontFamily: fonts.utility, fontSize: 12, color: palette.lcdDim }} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

const score = (p: RacePlayer, mode: RaceMode) => (mode === 'scavenger' ? (p.boxes?.length ?? 0) * 1e6 : 0) + p.xp;

/** Race control: everything about the race or live session you are in, on one page. Opened from the green flag. */
export default function RaceControl() {
  const g = useGame();
  const r = useRace();
  const { raceOn, liveOn, race, liveSession } = useRaceStatus();
  const now = useNow(true);
  const pulse = usePulse(raceOn || liveOn, 900);
  const ring = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * pulse.get(), transform: [{ scale: 1 + 0.18 * pulse.get() }] }));

  const sorted = useMemo(() => (race ? [...race.players].sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || score(b, race.mode) - score(a, race.mode)) : []), [race]);
  const meIdx = sorted.findIndex((p) => p.you);
  const me = meIdx >= 0 ? sorted[meIdx] : null;
  const top = sorted[0];
  const second = sorted[1];
  const maxXp = Math.max(1, ...sorted.map((p) => p.xp));

  const running = race?.status === 'running';
  const total = race && race.startTs && race.endTs ? race.endTs - race.startTs : 0;
  const left = race?.endTs ? race.endTs - now : 0;
  const frac = total > 0 ? Math.min(1, Math.max(0, (now - (race?.startTs ?? now)) / total)) : 0;

  const mineLive = liveSession ? liveSession.catches.filter((c) => c.name === g.profile.name).length : 0;

  const leave = () => {
    Alert.alert('Leave this race?', 'You will stop scoring and lose your place in the standings view.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { r.leave(); router.back(); } },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 62, height: 62, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ position: 'absolute', width: 62, height: 62, borderWidth: 4, borderColor: RACE_GREEN }, ring]} />
            <View style={{ width: 52, height: 52, backgroundColor: RACE_GREEN, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}>
              <RaceIcon size={36} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <PText style={{ fontSize: 40, lineHeight: 42, color: RACE_GREEN_DK }}>RACE CONTROL</PText>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: palette.navyDk, letterSpacing: 1 }}>
              {race ? `${MODE_LABEL[race.mode]}  -  CODE ${race.code}` : liveSession ? `LIVE SESSION  -  CODE ${liveSession.code}` : 'NOTHING RUNNING'}
            </Text>
          </View>
        </View>

        {!race && !liveSession ? (
          <Panel title="NO ACTIVE RACE">
            <Text style={{ fontFamily: fonts.prose, fontSize: 21, color: '#C9D2E6' }}>Start or join a race and its live stats show up here.</Text>
            <Btn tone="red" label="OPEN RACES" onPress={() => router.replace('/race')} />
          </Panel>
        ) : null}

        {race ? (
          <>
            <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: running ? RACE_GREEN : INK, padding: 14, gap: 10, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: palette.lcdDim, letterSpacing: 2 }}>
                {race.status === 'lobby' ? 'WAITING FOR THE HOST TO START' : running ? 'TIME LEFT' : 'RACE OVER'}
              </Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 72, lineHeight: 74, color: running ? RACE_GREEN : palette.wht, letterSpacing: 2 }}>
                {race.status === 'lobby' ? `${race.durationMin}:00` : running ? clock(left) : '0:00'}
              </Text>
              <View style={{ width: '100%', height: 14, backgroundColor: '#0a0d14', borderWidth: 2, borderColor: INK }}>
                <View style={{ width: `${Math.round(frac * 100)}%`, height: '100%', backgroundColor: RACE_GREEN }} />
              </View>
              {running && race.mode === 'elimination' && race.nextCutTs ? (
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.red }}>NEXT CUT IN {clock(race.nextCutTs - now)}</Text>
              ) : null}
              {race.status === 'finished' ? <Text style={{ fontFamily: fonts.display, fontSize: 24, color: palette.gold }}>WINNER: {race.winnerName ?? 'NOBODY'}</Text> : null}
            </View>

            {race.status !== 'lobby' && me ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Tile label="YOUR RANK" value={me.out ? 'CUT' : `${meIdx + 1}/${sorted.length}`} gold={meIdx === 0 && !me.out} />
                <Tile label={race.mode === 'scavenger' ? 'BOXES' : 'YOUR XP'} value={race.mode === 'scavenger' ? `${me.boxes?.length ?? 0}/${race.sheet?.length ?? 5}` : String(me.xp)} sub={`${me.caught} CARS`} />
                <Tile
                  label={meIdx === 0 ? 'LEAD' : 'BEHIND'}
                  value={meIdx === 0 ? (second ? `+${me.xp - second.xp}` : '-') : `-${Math.max(0, (top?.xp ?? 0) - me.xp)}`}
                  sub={meIdx === 0 ? 'OVER 2ND' : `TO ${top?.name ?? ''}`}
                />
              </View>
            ) : null}

            {race.mode === 'scavenger' && race.sheet ? (
              <Panel title="SPEC SHEET">
                {race.sheet.map((b) => {
                  const done = (me?.boxes ?? []).includes(b.id);
                  return (
                    <View key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 6 }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: done ? RACE_GREEN : palette.wht }}>{done ? '[X] ' : '[ ] '}{b.label}</Text>
                      {b.hard ? <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: palette.gold }}>HARD</Text> : null}
                    </View>
                  );
                })}
              </Panel>
            ) : null}

            <Panel title={race.status === 'lobby' ? `IN THE LOBBY (${sorted.length})` : 'STANDINGS'}>
              {sorted.map((p, i) => (
                <View key={p.name + i} style={{ gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: palette.line, paddingTop: i ? 6 : 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 22, color: i === 0 && race.status !== 'lobby' ? palette.gold : palette.wht, width: 28 }}>{race.status === 'lobby' ? '-' : i + 1}</Text>
                    <Text style={{ fontFamily: fonts.display, fontSize: 19, color: p.out ? palette.lcdDim : p.you ? RACE_GREEN : palette.wht, flex: 1 }} numberOfLines={1}>
                      {p.name}{p.host ? ' (HOST)' : ''}{p.out ? ' - CUT' : ''}
                    </Text>
                    {race.status !== 'lobby' ? (
                      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: palette.wht }}>
                        {race.mode === 'scavenger' ? `${p.boxes?.length ?? 0}/${race.sheet?.length ?? 5}` : `${p.xp} XP`} · {p.caught}
                      </Text>
                    ) : null}
                  </View>
                  {race.status !== 'lobby' ? (
                    <View style={{ height: 8, backgroundColor: '#0a0d14' }}>
                      <View style={{ width: `${Math.round((p.xp / maxXp) * 100)}%`, height: '100%', backgroundColor: p.out ? '#4a5568' : p.you ? RACE_GREEN : palette.navy }} />
                    </View>
                  ) : null}
                </View>
              ))}
            </Panel>

            {race.catches.length ? (
              <Panel title="LIVE CATCHES">
                {race.catches.slice(0, 10).map((c, i) => (
                  <Text key={i} style={{ fontFamily: fonts.utility, fontSize: 14, color: palette.wht }}>
                    <Text style={{ color: c.name === g.profile.name ? RACE_GREEN : palette.gold }}>{c.name}</Text> CAUGHT A {c.make} {c.model} ({c.rarity.toUpperCase()}) +{c.xp}  <Text style={{ color: palette.lcdDim }}>{ago(c.ts)}</Text>
                  </Text>
                ))}
              </Panel>
            ) : null}
          </>
        ) : null}

        {liveSession ? (
          <Panel title="LIVE SESSION" tint={RACE_GREEN}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Tile label="SPOTTERS" value={String(liveSession.players.length)} />
              <Tile label="CATCHES" value={String(liveSession.catches.length)} sub={`${mineLive} ARE YOURS`} />
            </View>
            <Text style={{ fontFamily: fonts.utility, fontSize: 14, color: palette.lcdDim }}>HERE: {liveSession.players.map((p) => p.name).join(', ')}</Text>
            {liveSession.catches.slice(0, 8).map((c, i) => (
              <Text key={i} style={{ fontFamily: fonts.utility, fontSize: 14, color: palette.wht }}>
                <Text style={{ color: c.name === g.profile.name ? RACE_GREEN : palette.gold }}>{c.name}</Text> - {c.make} {c.model} ({c.rarity.toUpperCase()})  <Text style={{ color: palette.lcdDim }}>{ago(c.ts)}</Text>
              </Text>
            ))}
            <Btn tone="plain" small label="LEAVE LIVE SESSION" onPress={() => r.leaveLive()} />
          </Panel>
        ) : null}

        {race?.status === 'lobby' && race.you?.host ? <Btn tone="red" label={r.busy ? 'STARTING...' : 'START THE RACE'} onPress={r.start} disabled={r.busy} /> : null}
        {raceOn || liveOn ? <Btn tone="red" label="GO SCAN" onPress={() => { router.back(); router.navigate('/'); }} /> : null}
        <Btn tone="navy" label="LOBBY, INVITES AND CODE" onPress={() => router.push('/race')} />
        {race ? <Btn tone="plain" label={race.status === 'finished' ? 'CLOSE RACE' : 'LEAVE RACE'} onPress={race.status === 'finished' ? () => { r.leave(); router.back(); } : leave} /> : null}
        <Btn tone="plain" label="BACK" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
