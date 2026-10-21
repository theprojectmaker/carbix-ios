import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, Sprite } from '@/components/ui';
import { examQuestions, finishExam } from '@/engine/extras';
import { dateKeyET } from '@/engine/store';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';

/** SPOTTER EXAM: five name-the-car questions, the same five for everyone each day. +3 XP per right answer. */
export default function Exam() {
  const g = useGame();
  const qs = useMemo(() => examQuestions(), []);
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const doneToday = g.profile.examDay === dateKeyET();
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);

  function pick(i: number) {
    if (picked !== null) return;
    const q = qs[qi];
    const right = q.opts[i].n === q.c.n;
    setPicked(i);
    play(right ? 'caught-uncommon' : 'error');
    const next = right ? score + 1 : score;
    if (right) setScore(next);
    setTimeout(() => {
      if (qi + 1 >= qs.length) {
        g.patchProfile((p) => finishExam(p, next));
        play(next === 5 ? 'levelup' : 'caught-rare');
        setFinished(true);
      } else {
        setQi(qi + 1);
        setPicked(null);
      }
    }, 900);
  }

  if (finished) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 34, color: palette.red }}>EXAM COMPLETE</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 96, lineHeight: 100, color: score === 5 ? palette.gold : INK }}>{score}/5</Text>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 12, color: palette.navyDk }}>+{score * 3} XP{score === 5 ? '  -  PERFECT' : ''}</Text>
          {score === 5 ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: palette.goldDk }}>EXAM ACE TITLE UNLOCKED</Text> : null}
          <Btn tone="red" label="CLOSE" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </ScrollView>
      </Screen>
    );
  }

  if (doneToday && !started) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.red }}>SPOTTER EXAM</Text>
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, gap: 6 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: '#fff' }}>YOU ALREADY TOOK TODAY&apos;S EXAM</Text>
            <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>
              You scored {(g.profile.examLast as number) || 0} out of 5. A new exam opens tomorrow.
            </Text>
          </View>
          <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  if (!started) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.red }}>SPOTTER EXAM</Text>
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, gap: 6 }}>
            <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>
              Five cars, one question each: what is it? Everyone gets the same five today. You earn 3 XP for every right answer, and a perfect 5 out of 5 unlocks the EXAM ACE title. You can take it once a day.
            </Text>
          </View>
          <Btn tone="red" label="START THE EXAM" onPress={() => { play('tab'); setStarted(true); }} />
          <Btn tone="plain" label="NOT NOW" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  const q = qs[qi];
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: palette.red }}>SPOTTER EXAM</Text>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: palette.navyDk, alignSelf: 'center' }}>Q{qi + 1}/5  -  {score} RIGHT</Text>
        </View>
        <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, alignItems: 'center' }}>
          <Sprite entry={q.c} size={230} />
        </View>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.navyDk, letterSpacing: 2 }}>WHAT IS IT?</Text>
        {q.opts.map((op, i) => {
          const isRight = op.n === q.c.n;
          return (
            <Btn
              key={op.n}
              label={`${op.make} ${op.model}`.toUpperCase()}
              onPress={() => pick(i)}
              style={{ opacity: picked !== null && !isRight && picked !== i ? 0.5 : 1 }}
              tone={picked === null ? 'navy' : isRight ? 'gold' : picked === i ? 'red' : 'navy'}
            />
          );
        })}
        <Text onPress={() => router.back()} style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.navyDk, textAlign: 'center' }}>QUIT</Text>
      </ScrollView>
    </Screen>
  );
}
