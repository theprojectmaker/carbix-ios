import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText, Sprite } from '@/components/ui';
import { fetchFeed, fetchLeaderboard, friendAction, friendsGet } from '@/engine/api';
import { CATALOG, catalogMatch } from '@/engine/data';
import { dexBitsDecode } from '@/engine/store';
import type { Rarity } from '@/engine/types';
import { TIER_COLOR, levelFor, rankFor } from '@/engine/xp';
import { isSelf } from '@/lib/moderation';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const norm = (s?: string) => String(s ?? '').replace(/^@+/, '').toLowerCase();

type Row = { name?: string; displayName?: string; xp?: number; caught?: number; dexCount?: number; streak?: number; dexBits?: string; bestModel?: string; bestRarity?: Rarity };
type Post = { id?: string; name?: string; make?: string; model?: string; rarity?: Rarity; ts?: number; type?: string };

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flex: 1, backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', padding: 8, alignItems: 'center' }}>
    <Text style={{ fontFamily: fonts.display, fontSize: 24, color: palette.gold }}>{value}</Text>
    <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: palette.lcdDim, letterSpacing: 1 }}>{label}</Text>
  </View>
);

/** A spotter's public profile: the same numbers as the leaderboard, their latest shared catches, and friend / race actions. */
export default function Profile() {
  const t = useTheme();
  const g = useGame();
  const r = useRace();
  const { name } = useLocalSearchParams<{ name: string }>();
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFriend, setIsFriend] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [tick, setTick] = useState(0);
  const me = isSelf(g.profile, name);

  useEffect(() => {
    let live = true;
    (async () => {
      const [rows, feed, fr] = await Promise.all([fetchLeaderboard(), fetchFeed(), friendsGet(g.profile.token)]);
      if (!live) return;
      setRow(((rows as Row[]).find((x) => norm(x.name) === norm(name)) ?? null));
      const all = feed?.ok && Array.isArray(feed.posts) ? (feed.posts as Post[]) : [];
      setPosts(all.filter((p) => norm(p.name) === norm(name) && p.make && p.model && !p.type).slice(0, 6));
      setIsFriend(fr ? fr.friends.some((f) => norm(f) === norm(name)) : null);
    })();
    return () => { live = false; };
  }, [name, g.profile.token, tick]);

  async function add() {
    play('click');
    setNote('SENDING...');
    const j = await friendAction(g.profile.token, g.profile.name, { action: 'request', target: name });
    setNote(j.becameFriends ? 'YOU ARE NOW FRIENDS.' : j.ok ? 'REQUEST SENT.' : String(j.error || "COULDN'T SEND THAT.").toUpperCase());
    setTick((n) => n + 1);
  }

  async function invite() {
    if (!r.code) { router.push('/race'); return; }
    play('click');
    setNote((await r.inviteFriend(String(name))) ? 'INVITE SENT. THEY GET A DOT ON THEIR RACE KEY.' : "COULDN'T SEND THE INVITE.");
  }

  const xp = row?.xp ?? 0;
  const lv = levelFor(xp);
  const owned = row?.dexBits ? dexBitsDecode(row.dexBits).size : (row?.dexCount ?? 0);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <PText style={{ fontSize: 40, lineHeight: 42, color: t.red }} numberOfLines={1}>{String(row?.displayName || name).toUpperCase()}</PText>

        {row === undefined ? (
          <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: t.muted }}>LOADING...</Text>
        ) : row === null ? (
          <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: t.muted }}>THIS SPOTTER HAS NOT SHARED A PROFILE YET.</Text>
        ) : (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 10 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: palette.wht }}>LV.{lv} {rankFor(lv)}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat label="XP" value={xp.toLocaleString()} />
              <Stat label={`IN THE BIX / ${CATALOG.length.toLocaleString()}`} value={String(owned)} />
              <Stat label="DAY STREAK" value={String(row.streak ?? 0)} />
            </View>
            {row.bestModel ? (
              <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
                BEST CATCH: <Text style={{ color: TIER_COLOR[row.bestRarity ?? 'Common'] }}>{String(row.bestModel).toUpperCase()}</Text>
              </Text>
            ) : null}
          </View>
        )}

        {posts.length ? (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>LATEST CATCHES</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {posts.map((p, i) => {
                const e = catalogMatch({ make: p.make!, model: p.model! });
                const c = TIER_COLOR[p.rarity ?? 'Common'];
                return (
                  <View key={p.id ?? i} style={{ width: '31.5%', backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', borderTopWidth: 5, borderTopColor: c, alignItems: 'center', padding: 4 }}>
                    {e ? <Sprite entry={e} size={86} /> : null}
                    <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 13, color: palette.wht }}>{String(p.model).toUpperCase()}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {note ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.gold }}>{note}</Text> : null}

        {me ? (
          <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: t.muted }}>THIS IS YOU.</Text>
        ) : isFriend ? (
          <>
            <Btn tone="red" label={r.code ? 'INVITE TO MY RACE' : 'START A RACE TO INVITE'} onPress={invite} />
            <Btn tone="gold" label="BIX DUEL" onPress={() => router.push({ pathname: '/duel/[name]', params: { name: String(name) } })} />
          </>
        ) : isFriend === false ? (
          <Btn tone="red" label="ADD FRIEND" onPress={add} />
        ) : null}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
