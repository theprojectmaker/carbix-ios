import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, Sprite } from '@/components/ui';
import { fetchLeaderboard } from '@/engine/api';
import { CATALOG_BY_N } from '@/engine/data';
import { dexBitsDecode } from '@/engine/store';
import type { CatalogEntry } from '@/engine/types';
import { TIER_COLOR, TIER_XP } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
const norm = (s: string) => s.replace(/^@+/, '').toLowerCase();

function Tile({ c, star, on, onStar }: { c: CatalogEntry; star?: boolean; on?: boolean; onStar?: () => void }) {
  return (
    <View style={{ width: '31.5%', backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', borderTopWidth: 5, borderTopColor: TIER_COLOR[c.rarity], alignItems: 'center', padding: 4, opacity: star ? 1 : 0.7 }}>
      <Sprite entry={c} size={86} />
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 13, color: palette.wht }}>{c.model.toUpperCase()}</Text>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 7.5, color: TIER_COLOR[c.rarity] }}>{c.rarity.toUpperCase()}</Text>
      {star ? (
        <Pressable onPress={onStar} accessibilityRole="button" accessibilityLabel={`Target ${c.make} ${c.model}`}>
          <View style={{ marginTop: 4, backgroundColor: on ? palette.gold : '#2C3E58', borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: on ? INK : '#fff' }}>{on ? 'TARGETED' : 'TARGET'}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/** BIX DUEL: your caught bix against a friend's, using the bitfield on their leaderboard row. */
export default function Duel() {
  const g = useGame();
  const { name } = useLocalSearchParams<{ name: string }>();
  const [bits, setBits] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    fetchLeaderboard().then((rows) => {
      if (!live) return;
      const row = (rows as { name?: string; dexBits?: string }[]).find((r) => norm(r.name ?? '') === norm(String(name)));
      setBits(row?.dexBits ?? null);
    });
    return () => { live = false; };
  }, [name]);

  const d = useMemo(() => {
    if (!bits) return null;
    const theirs = dexBitsDecode(bits);
    const mine = g.caughtNs;
    const byXp = (a: CatalogEntry, b: CatalogEntry) => (TIER_XP[b.rarity] || 0) - (TIER_XP[a.rarity] || 0);
    const only = [...theirs].filter((n) => !mine.has(n)).map((n) => CATALOG_BY_N.get(n)).filter(Boolean).sort(byXp as never) as CatalogEntry[];
    const yours = [...mine].filter((n) => !theirs.has(n)).map((n) => CATALOG_BY_N.get(n)).filter(Boolean).sort(byXp as never) as CatalogEntry[];
    const both = [...mine].filter((n) => theirs.has(n)).length;
    return { theirs, only, yours, both, gap: mine.size - theirs.size };
  }, [bits, g.caughtNs]);

  const stars = (g.profile.stars as number[]) || [];
  const verdict = d ? (d.gap > 0 ? `YOU'RE UP ${d.gap}` : d.gap < 0 ? `THEY'RE UP ${-d.gap}` : 'DEAD HEAT') : '';
  const vcol = d ? (d.gap > 0 ? palette.green : d.gap < 0 ? palette.red : palette.gold) : '#fff';

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 34, color: palette.red }}>BIX DUEL</Text>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.navyDk }}>YOU VS {String(name).toUpperCase()}</Text>

        {bits === undefined ? (
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.navyDk }}>LOADING...</Text>
        ) : !d ? (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12 }}>
            <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>
              {String(name)} has not published their bix yet. Their garage shows up here after their next catch.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, flexDirection: 'row', padding: 12, alignItems: 'center' }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.gold }}>{g.caughtNs.size}</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.lcdDim }}>YOU</Text>
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 20, color: vcol, flex: 1.2, textAlign: 'center' }}>{verdict}</Text>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 40, color: palette.gold }}>{d.theirs.size}</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.lcdDim }}>{String(name).toUpperCase().slice(0, 10)}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.navyDk, textAlign: 'center' }}>
              {d.both} IN BOTH GARAGES  -  {d.only.length} ONLY THEIRS  -  {d.yours.length} ONLY YOURS
            </Text>

            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navyDk }}>
              {d.only.length ? "THEY HAVE, YOU DON'T" : 'THEY HAVE NOTHING YOU DONT'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {d.only.slice(0, 60).map((c) => (
                <Tile key={c.n} c={c} star on={stars.includes(c.n)} onStar={() => { play('click'); g.toggleStar(c.n); }} />
              ))}
            </View>
            {d.only.length > 60 ? <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.navyDk }}>+{d.only.length - 60} MORE</Text> : null}

            {d.yours.length ? (
              <>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navyDk }}>YOU HAVE, THEY DON&apos;T</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {d.yours.slice(0, 30).map((c) => <Tile key={c.n} c={c} />)}
                </View>
              </>
            ) : null}
            <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.navyDk }}>CATCH A TARGETED CAR FOR BONUS XP.</Text>
          </>
        )}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
