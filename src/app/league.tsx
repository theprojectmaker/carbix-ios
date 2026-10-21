import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText } from '@/components/ui';
import { leagueGet, type League } from '@/engine/api';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const TIER_COL: Record<string, string> = { RUST: '#8C5A2B', IRON: '#7f8796', STEEL: '#5C7AA0', CHROME: '#c9d3e0' };

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}D ${h}H` : `${h}H ${m}M`;
};

/** SPOTTER LEAGUE: weekly 20-player divisions. Top spotters move up a tier, the bottom moves down. */
export default function LeagueScreen() {
  const t = useTheme();
  const g = useGame();
  const [lg, setLg] = useState<League | null | undefined>(undefined);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    leagueGet(g.profile.token).then((r) => { if (live) setLg(r); });
    return () => { live = false; };
  }, [g.profile.token]);

  const mine = lg?.divisions.find((d) => d.id === lg.myDivision);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>LEAGUE</PText>
        {lg === undefined ? (
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.navyDk }}>LOADING...</Text>
        ) : lg === null ? (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14 }}>
            <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>The league is not reachable right now. Catch a car and try again in a minute.</Text>
          </View>
        ) : (
          <>
            <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: TIER_COL[lg.myTier ?? ''] ?? INK, padding: 14, gap: 4 }}>
              <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>YOUR TIER</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 40, color: TIER_COL[lg.myTier ?? ''] ?? '#fff' }}>{lg.myTier ?? 'NOT SEATED YET'}</Text>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.lcdDim }}>WEEK ENDS IN {clock(lg.endsTs - now)}</Text>
              <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: palette.lcdDim }}>
                TIERS, LOW TO HIGH: {lg.tiers.join(', ')}. TOP SPOTTERS MOVE UP, THE BOTTOM MOVES DOWN WHEN THE WEEK ENDS.
              </Text>
            </View>
            {lg.prev ? (
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: t.muted }}>
                LAST WEEK: {lg.prev.myTier}, RANK {lg.prev.myRank}, {lg.prev.myXp} XP{lg.prev.myMoved ? `, ${lg.prev.myMoved.toUpperCase()}` : ''}
              </Text>
            ) : null}
            {mine ? (
              <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 6 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }}>YOUR DIVISION</Text>
                {mine.members.map((m, i) => {
                  const up = i < mine.up;
                  const down = i >= mine.members.length - mine.down;
                  const me = !!m.me;
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 6 }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 20, width: 28, color: up ? palette.green : down ? palette.red : '#fff' }}>{i + 1}</Text>
                      <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, color: me ? palette.gold : '#fff' }} numberOfLines={1}>{String(m.displayName || m.name || 'SPOTTER')}</Text>
                      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.gold }}>{Number(m.xp ?? m.weekXp ?? 0).toLocaleString()} XP</Text>
                    </View>
                  );
                })}
                <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: palette.lcdDim }}>
                  GREEN = MOVES UP ({mine.up}). RED = MOVES DOWN ({mine.down}).
                </Text>
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: t.muted }}>You are not in a division yet. Catch a car so your row publishes, then check back.</Text>
            )}
          </>
        )}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
