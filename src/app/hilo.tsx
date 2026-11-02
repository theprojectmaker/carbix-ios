import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, Sprite } from '@/components/ui';
import { HILO_DAILY_XP_CAP, HILO_STATS, hiloCorrect, hiloPick, hiloRound, type HiLoStat } from '@/engine/games';
import { dateKeyET } from '@/engine/store';
import type { CatalogEntry } from '@/engine/types';
import { TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
const fmt = (stat: HiLoStat, c: CatalogEntry) => `${HILO_STATS[stat].get(c)}${HILO_STATS[stat].unit}`;

type Round = { left: CatalogEntry; right: CatalogEntry; stat: HiLoStat };
const newGame = (): Round => {
  const left = hiloPick();
  return { left, ...hiloRound(left) };
};

function CarCard({ entry, stat, reveal, tone }: { entry: CatalogEntry; stat: HiLoStat; reveal: boolean; tone?: 'right' | 'wrong' }) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.panel, borderWidth: 3, borderColor: tone === 'right' ? palette.green : tone === 'wrong' ? palette.red : INK, borderTopWidth: 6, borderTopColor: TIER_COLOR[entry.rarity], padding: 8, alignItems: 'center', gap: 2 }}>
      <Sprite entry={entry} size={130} crisp bottom />
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: palette.lcdDim, letterSpacing: 1 }} numberOfLines={1}>{entry.make.toUpperCase()}</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: '#fff', textAlign: 'center' }} numberOfLines={2}>{entry.model.toUpperCase()}</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: reveal ? (tone === 'wrong' ? palette.red : palette.gold) : palette.lcdDim }}>
        {reveal ? fmt(stat, entry) : '?'}
      </Text>
    </View>
  );
}

/** HIGHER OR LOWER: two cars, one stat. Is the new car's number higher or lower? 2 XP a right answer, up to 60 XP a day. */
export default function HiLo() {
  const g = useGame();
  const [round, setRound] = useState<Round>(newGame);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<null | 'right' | 'wrong'>(null);
  const [over, setOver] = useState(false);
  const [gained, setGained] = useState(0);

  const best = (g.profile.hiloBest as number) || 0;
  const used = g.profile.hiloDay === dateKeyET() ? ((g.profile.hiloXp as number) || 0) : 0;

  function answer(higher: boolean) {
    if (result) return;
    const a = HILO_STATS[round.stat].get(round.left) ?? 0;
    const b = HILO_STATS[round.stat].get(round.right) ?? 0;
    const right = higher ? b > a : b < a;
    if (right) {
      const next = streak + 1;
      let xp = 0;
      g.patchProfile((p) => { const r = hiloCorrect(p, next); xp = r.xp; return r.profile; });
      setGained((x) => x + xp);
      setStreak(next);
      setResult('right');
      play(next >= 10 ? 'caught-epic' : next >= 5 ? 'caught-rare' : 'caught-uncommon');
      setTimeout(() => {
        setRound({ left: round.right, ...hiloRound(round.right) });
        setResult(null);
      }, 1100);
    } else {
      setResult('wrong');
      play('error');
      setTimeout(() => setOver(true), 1300);
    }
  }

  function again() {
    play('tab');
    setRound(newGame());
    setStreak(0);
    setGained(0);
    setResult(null);
    setOver(false);
  }

  if (over) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 34, color: palette.red }}>GAME OVER</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 96, lineHeight: 100, color: streak >= best && streak > 0 ? palette.gold : INK }}>{streak}</Text>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 17, color: palette.navyDk }}>IN A ROW{streak >= best && streak > 0 ? '  -  NEW BEST' : `  -  BEST ${best}`}</Text>
          <Text style={{ fontFamily: fonts.utility, fontSize: 15, color: palette.navyDk }}>+{gained} XP THIS GAME  -  {Math.min(HILO_DAILY_XP_CAP, used)}/{HILO_DAILY_XP_CAP} XP TODAY</Text>
          <Btn tone="red" label="PLAY AGAIN" onPress={again} style={{ alignSelf: 'stretch' }} />
          <Btn tone="plain" label="CLOSE" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </ScrollView>
      </Screen>
    );
  }

  const st = HILO_STATS[round.stat];
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.red }}>HIGHER OR LOWER</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['STREAK', String(streak)], ['BEST', String(best)], ['XP TODAY', `${Math.min(HILO_DAILY_XP_CAP, used)}/${HILO_DAILY_XP_CAP}`]].map(([k, v]) => (
            <View key={k} style={{ flex: 1, backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 13, color: palette.lcdDim, letterSpacing: 1 }}>{k}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: palette.wht }}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navyDk, textAlign: 'center' }}>
          WHICH HAS THE {st.label}? IS THE RIGHT CAR HIGHER OR LOWER THAN THE LEFT ONE?
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <CarCard entry={round.left} stat={round.stat} reveal />
          <CarCard entry={round.right} stat={round.stat} reveal={!!result} tone={result ?? undefined} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn tone="red" label="HIGHER" disabled={!!result} onPress={() => answer(true)} style={{ flex: 1 }} />
          <Btn tone="navy" label="LOWER" disabled={!!result} onPress={() => answer(false)} style={{ flex: 1 }} />
        </View>
        {round.stat === 'zts' ? <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: palette.navyDk, textAlign: 'center' }}>FOR 0-60, A HIGHER NUMBER MEANS A SLOWER CAR.</Text> : null}
        <Btn tone="plain" small label="QUIT" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
