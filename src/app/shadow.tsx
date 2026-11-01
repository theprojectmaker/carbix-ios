import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText, Sprite } from '@/components/ui';
import { CATALOG } from '@/engine/data';
import { finishShadow } from '@/engine/extras';
import { dateKeyET } from '@/engine/store';
import type { CatalogEntry } from '@/engine/types';
import { TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const ROUNDS = 5;

/** Deterministic shuffle from a seed, so everyone gets the same five cars on the same day. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

function buildRounds(day: string, pool: CatalogEntry[]) {
  const rnd = seeded('shadow:' + day);
  const pick = () => pool[Math.floor(rnd() * pool.length)];
  const rounds: { answer: CatalogEntry; options: CatalogEntry[] }[] = [];
  const used = new Set<number>();
  while (rounds.length < ROUNDS) {
    const a = pick();
    if (used.has(a.n)) continue;
    used.add(a.n);
    const opts = new Set<CatalogEntry>([a]);
    let guard = 0;
    while (opts.size < 4 && guard++ < 50) {
      const o = pick();
      if (o.n !== a.n && ![...opts].some((x) => x.make === o.make && x.model === o.model)) opts.add(o);
    }
    const arr = [...opts];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    rounds.push({ answer: a, options: arr });
  }
  return rounds;
}

/** SHADOW GAME: a car shown as a dark silhouette, four names, five rounds a day. */
export default function Shadow() {
  const t = useTheme();
  const g = useGame();
  const today = dateKeyET();
  const done = g.profile.shadowDay === today;
  const pool = useMemo(() => CATALOG.filter((c) => c.years && Number(c.years.slice(0, 4)) >= 1990), []);
  const rounds = useMemo(() => buildRounds(today, pool), [today, pool]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [over, setOver] = useState(done);
  const r = rounds[Math.min(i, ROUNDS - 1)];
  const revealed = picked !== null;

  const choose = (n: number) => {
    if (revealed) return;
    setPicked(n);
    const ok = n === r.answer.n;
    play(ok ? 'caught-uncommon' : 'error');
    const nextRight = right + (ok ? 1 : 0);
    setRight(nextRight);
    setTimeout(() => {
      if (i + 1 >= ROUNDS) {
        g.patchProfile((p) => finishShadow(p, nextRight));
        setOver(true);
        play(nextRight === ROUNDS ? 'fanfare' : 'levelup');
      } else {
        setI(i + 1);
        setPicked(null);
      }
    }, 900);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <PText style={{ fontSize: 40, lineHeight: 42, color: t.red }}>SHADOW GAME</PText>
          {!over ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: t.muted, marginBottom: 6 }}>{i + 1} OF {ROUNDS}  -  {right} RIGHT</Text> : null}
        </View>

        {over ? (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 16, gap: 10, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: palette.gold }}>{done && !revealed && right === 0 ? (g.profile.shadowLast as number) || 0 : right}/{ROUNDS}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.wht }}>{done && !revealed && right === 0 ? 'YOU ALREADY PLAYED TODAY' : right === ROUNDS ? 'PERFECT. YOU KNOW YOUR CARS.' : right >= 3 ? 'NICE EYE.' : 'TOUGH SHADOWS TODAY.'}</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.lcdDim, letterSpacing: 1 }}>+{(g.profile.shadowXP as number) || 0} XP  -  NEW SHADOWS TOMORROW</Text>
            <Btn tone="red" label="BACK HOME" onPress={() => router.back()} />
          </View>
        ) : (
          <>
            <View style={{ backgroundColor: '#1a2133', borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center', paddingVertical: 26 }}>
              <Sprite entry={r.answer} caught={revealed} size={260} tint="#0d1119" crisp />
              {revealed ? (
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: TIER_COLOR[r.answer.rarity], marginTop: 8 }}>{r.answer.make.toUpperCase()} {r.answer.model.toUpperCase()}</Text>
              ) : (
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.lcdDim, letterSpacing: 2, marginTop: 8 }}>WHICH CAR IS THIS?</Text>
              )}
            </View>
            <View style={{ gap: 8 }}>
              {r.options.map((o) => {
                const isAns = o.n === r.answer.n;
                const bg = !revealed ? palette.panel : isAns ? palette.green : picked === o.n ? palette.red : palette.panel;
                return (
                  <Pressable key={o.n} onPress={() => choose(o.n)} accessibilityRole="button" accessibilityLabel={`${o.make} ${o.model}`}>
                    <View style={{ backgroundColor: bg, borderWidth: 3, borderColor: INK, paddingVertical: 12, paddingHorizontal: 14 }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 21, color: '#fff' }} numberOfLines={1}>{o.make.toUpperCase()} {o.model.toUpperCase()}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: t.muted, textAlign: 'center' }}>15 XP PER RIGHT ANSWER. 25 MORE FOR FIVE OUT OF FIVE.</Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        {!over ? <Btn tone="plain" label="CLOSE" onPress={() => router.back()} /> : null}
      </View>
    </Screen>
  );
}
