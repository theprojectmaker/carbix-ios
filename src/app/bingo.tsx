import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn } from '@/components/ui';
import { BINGO_FULL_ORBS, BINGO_FULL_XP, BINGO_LINES, BINGO_LINE_XP, applyBingo, bingoState } from '@/engine/games';
import { dateKeyET } from '@/engine/store';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';

/** SPOTTER BINGO: nine squares a day, the same for everyone. Catch cars that fit them; lines pay XP, a full board pays orbs. */
export default function Bingo() {
  const g = useGame();
  const day = dateKeyET();
  const st = useMemo(() => bingoState(g.garage, day), [g.garage, day]);
  const paidRef = useRef(-1);

  // pay out any line or full board that has not been paid yet today (once per change)
  useEffect(() => {
    if (paidRef.current === st.mask) return;
    paidRef.current = st.mask;
    let msg = '';
    g.patchProfile((p) => {
      const r = applyBingo(p, st, day);
      if (r.xp) msg = `BINGO${r.full ? ' - FULL BOARD' : ''}: +${r.xp} XP${r.orbs ? `, +${r.orbs} ORBS` : ''}`;
      return r.profile;
    });
    if (msg) { play(st.full ? 'levelup' : 'caught-rare'); g.notify(msg); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.mask]);

  const doneCount = st.done.filter(Boolean).length;
  const inLine = new Set(st.lines.flatMap((i) => BINGO_LINES[i]));

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.red }}>SPOTTER BINGO</Text>
        <Text style={{ fontFamily: fonts.prose, fontSize: 21, color: palette.navyDk }}>
          Catch cars today that fit the squares. Every line is +{BINGO_LINE_XP} XP. A full board is +{BINGO_FULL_XP} XP and {BINGO_FULL_ORBS} orbs. A fresh board comes tomorrow.
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {st.board.map((t, i) => {
            const done = st.done[i];
            const line = inLine.has(i);
            return (
              <View
                key={t.id}
                style={{
                  width: '31.5%', aspectRatio: 1, borderWidth: 3, borderColor: line ? palette.gold : INK, padding: 6, alignItems: 'center', justifyContent: 'center', gap: 4,
                  backgroundColor: done ? '#1f5d3a' : palette.panel,
                }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: done ? palette.gold : palette.lcdDim }}>{done ? 'X' : i === 4 ? '*' : '?'}</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 15, lineHeight: 16, color: done ? '#fff' : palette.wht, textAlign: 'center' }}>{t.label}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['SQUARES', `${doneCount}/9`], ['LINES', `${st.lines.length}/8`], ['FULL BOARD', st.full ? 'YES' : 'NO']].map(([k, v]) => (
            <View key={k} style={{ flex: 1, backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 13, color: palette.lcdDim, letterSpacing: 1 }}>{k}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: palette.wht }}>{v}</Text>
            </View>
          ))}
        </View>

        <Btn tone="red" label="GO SCAN" onPress={() => { router.back(); router.navigate('/'); }} />
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
