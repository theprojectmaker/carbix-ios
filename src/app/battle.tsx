import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, Sprite } from '@/components/ui';
import { CATALOG_BY_N, catalogMatch } from '@/engine/data';
import { BATTLE_STATS, BATTLE_WINS_PAID_PER_DAY, BATTLE_WIN_XP, battleDeal, battleRound, finishBattle, type Battle } from '@/engine/games';
import { dateKeyET } from '@/engine/store';
import type { CatalogEntry } from '@/engine/types';
import { TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';

function Face({ entry, stat, show, mark, dim, onPress }: { entry: CatalogEntry | null; stat: keyof typeof BATTLE_STATS; show: boolean; mark?: 'win' | 'lose' | 'draw'; dim?: boolean; onPress?: () => void }) {
  const d = BATTLE_STATS[stat];
  const border = mark === 'win' ? palette.green : mark === 'lose' ? palette.red : mark === 'draw' ? palette.gold : INK;
  const body = (
    <View style={{ width: 112, backgroundColor: palette.panel, borderWidth: 3, borderColor: border, borderTopWidth: 6, borderTopColor: entry ? TIER_COLOR[entry.rarity] : '#2E3A48', alignItems: 'center', padding: 4, opacity: dim ? 0.35 : 1 }}>
      {entry ? <Sprite entry={entry} size={92} crisp bottom /> : <View style={{ height: 70, justifyContent: 'center' }}><Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.lcdDim }}>?</Text></View>}
      <Text style={{ fontFamily: fonts.display, fontSize: 14, lineHeight: 15, color: palette.wht, textAlign: 'center' }} numberOfLines={2}>{entry ? entry.model.toUpperCase() : 'RIVAL'}</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: show && entry ? palette.gold : palette.lcdDim }}>{show && entry ? `${d.get(entry)}${d.unit}` : '?'}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

/** CARD BATTLE: five of your cars against five of a rival's, over five stats. Win three rounds to win the battle. */
export default function BattleScreen() {
  const g = useGame();
  const owned = useMemo(() => {
    const seen = new Map<number, CatalogEntry>();
    for (const c of g.garage) {
      const e = catalogMatch(c.car);
      if (e) seen.set(e.n, CATALOG_BY_N.get(e.n) ?? e);
    }
    return [...seen.values()];
  }, [g.garage]);

  const [battle, setBattle] = useState<Battle | null>(null);
  const [round, setRound] = useState(0);
  const [used, setUsed] = useState<number[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [marks, setMarks] = useState<(1 | -1 | 0)[]>([]);
  const [done, setDone] = useState<null | { won: boolean; xp: number }>(null);

  const today = dateKeyET();
  const winsToday = g.profile.battleDay === today ? ((g.profile.battleWins as number) || 0) : 0;
  const streak = (g.profile.battleStreak as number) || 0;
  const best = (g.profile.battleBest as number) || 0;

  function start() {
    play('tab');
    setBattle(battleDeal(owned));
    setRound(0); setUsed([]); setPick(null); setMarks([]); setDone(null);
  }

  function choose(i: number) {
    if (!battle || pick !== null || used.includes(i)) return;
    const stat = battle.stats[round];
    const r = battleRound(stat, battle.mine[i], battle.theirs[round]);
    setPick(i);
    play(r === 1 ? 'caught-uncommon' : r === -1 ? 'error' : 'click');
    const nm = [...marks, r];
    setTimeout(() => {
      setMarks(nm);
      setUsed((u) => [...u, i]);
      setPick(null);
      if (round + 1 >= 5) {
        const wins = nm.filter((x) => x === 1).length;
        const lose = nm.filter((x) => x === -1).length;
        const won = wins > lose;
        let xp = 0;
        g.patchProfile((p) => { const f = finishBattle(p, won); xp = f.xp; return f.profile; });
        play(won ? 'levelup' : 'caught-common');
        setDone({ won, xp });
      } else setRound(round + 1);
    }, 1400);
  }

  if (!battle) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.red }}>CARD BATTLE</Text>
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, gap: 8 }}>
            <Text style={{ fontFamily: fonts.prose, fontSize: 21, color: '#C9D2E6' }}>
              Five of your cars face five of a rival&apos;s. Each round shows a stat; pick the car of yours that wins it. Take three rounds to win the battle. Every card plays once, so save your best for the stats that count.
            </Text>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 15, color: palette.gold }}>
              WIN = +{BATTLE_WIN_XP} XP (FIRST {BATTLE_WINS_PAID_PER_DAY} WINS A DAY)  -  {Math.min(winsToday, BATTLE_WINS_PAID_PER_DAY)}/{BATTLE_WINS_PAID_PER_DAY} TODAY
            </Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 14, color: palette.lcdDim }}>WIN STREAK {streak}  -  BEST {best}</Text>
            {owned.length < 5 ? <Text style={{ fontFamily: fonts.utility, fontSize: 14, color: palette.lcdDim }}>YOU HAVE {owned.length} CAR{owned.length === 1 ? '' : 'S'}. THE REST OF YOUR HAND IS BORROWED. CATCH MORE FOR A STRONGER DECK.</Text> : null}
          </View>
          <Btn tone="red" label="DEAL THE CARDS" onPress={start} />
          <Btn tone="plain" label="NOT NOW" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  const stat = battle.stats[Math.min(round, 4)];
  const d = BATTLE_STATS[stat];
  const wins = marks.filter((x) => x === 1).length;
  const losses = marks.filter((x) => x === -1).length;
  const revealing = pick !== null;
  const lastMark = revealing && battle ? battleRound(stat, battle.mine[pick as number], battle.theirs[round]) : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 36, color: palette.red }}>CARD BATTLE</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, color: palette.navyDk }}>{wins} - {losses}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: 34, height: 14, borderWidth: 2, borderColor: INK, backgroundColor: marks[i] === 1 ? palette.green : marks[i] === -1 ? palette.red : marks[i] === 0 ? palette.gold : i === round ? '#8CA6C4' : '#1d2436' }} />
          ))}
        </View>

        {done ? (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: done.won ? palette.green : palette.red, padding: 14, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 44, color: done.won ? palette.gold : palette.red }}>{done.won ? 'YOU WIN' : 'YOU LOSE'}</Text>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 16, color: palette.wht }}>{wins} ROUNDS TO {losses}{done.xp ? `  -  +${done.xp} XP` : done.won ? '  -  NO MORE XP TODAY' : ''}</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 14, color: palette.lcdDim }}>WIN STREAK {((g.profile.battleStreak as number) || 0)}  -  BEST {((g.profile.battleBest as number) || 0)}</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: palette.navyDk, textAlign: 'center' }}>ROUND {round + 1}: {d.label}</Text>
        )}

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 13, color: palette.lcdDim, letterSpacing: 2 }}>RIVAL</Text>
          <Face
            entry={done ? null : battle.theirs[round]}
            stat={stat}
            show={revealing}
            mark={revealing ? (lastMark === 1 ? 'lose' : lastMark === -1 ? 'win' : 'draw') : undefined}
          />
        </View>

        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 13, color: palette.lcdDim, letterSpacing: 2, textAlign: 'center' }}>{done ? 'YOUR HAND' : 'PICK A CAR'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
          {battle.mine.map((c, i) => (
            <Face
              key={c.n}
              entry={c}
              stat={stat}
              show
              dim={used.includes(i)}
              mark={pick === i ? (lastMark === 1 ? 'win' : lastMark === -1 ? 'lose' : 'draw') : undefined}
              onPress={done ? undefined : () => choose(i)}
            />
          ))}
        </ScrollView>

        {done ? (
          <>
            <Btn tone="red" label="BATTLE AGAIN" onPress={start} />
            <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
          </>
        ) : (
          <Btn tone="plain" small label="QUIT" onPress={() => router.back()} />
        )}
      </ScrollView>
    </Screen>
  );
}
