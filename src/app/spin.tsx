import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn } from '@/components/ui';
import { finishSpin, SPIN_PRIZES } from '@/engine/extras';
import { dateKeyET } from '@/engine/store';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

/** LUCKY SPIN: one free spin a day for 10 to 100 XP. */
export default function Spin() {
  const g = useGame();
  const doneToday = g.profile.spinDay === dateKeyET();
  const [prize] = useState(() => SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)]);
  const [shown, setShown] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  const [go, setGo] = useState(false);

  useEffect(() => {
    if (!go) return;
    let ticks = 0;
    const iv = setInterval(() => {
      ticks++;
      if (ticks < 22) {
        setShown(SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)]);
        play('click');
      } else {
        clearInterval(iv);
        setShown(prize);
        setLanded(true);
        g.patchProfile((p) => finishSpin(p, prize));
        play(prize >= 75 ? 'levelup' : 'caught-uncommon');
      }
    }, 90);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: 20, gap: 16, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.red, textAlign: 'center' }}>LUCKY SPIN</Text>
        {doneToday && !go ? (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: '#141C27', padding: 16, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: '#fff' }}>YOU ALREADY SPUN TODAY</Text>
            <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>You won {(g.profile.spinLast as number) || 0} XP. Come back tomorrow.</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: '#141C27', padding: 20, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 110, lineHeight: 114, color: landed && (shown ?? 0) >= 75 ? palette.gold : '#fff' }}>{shown ?? '-'}</Text>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: palette.lcdDim, letterSpacing: 2 }}>XP</Text>
          </View>
        )}
        {!doneToday && !go ? <Btn tone="red" label="SPIN" onPress={() => setGo(true)} /> : null}
        {landed ? <Btn tone="gold" label={`COLLECT +${prize} XP`} onPress={() => router.back()} /> : <Btn tone="plain" label={go ? 'SPINNING...' : 'BACK'} disabled={go} onPress={() => router.back()} />}
      </View>
    </Screen>
  );
}
