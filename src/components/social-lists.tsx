import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { Btn, Sprite } from '@/components/ui';
import { fetchFeed, fetchLeaderboard, friendsGet } from '@/engine/api';
import { catalogMatch } from '@/engine/data';
import type { Rarity } from '@/engine/types';
import { TIER_COLOR, levelFor, rankFor } from '@/engine/xp';
import { isBlocked, isSelf, reportUser, withBlocked } from '@/lib/moderation';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

function ModRow({ name, what }: { name: string; what: string }) {
  const g = useGame();
  if (isSelf(g.profile, name)) return <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: palette.green }}>YOU</Text>;
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <Text onPress={() => g.patchProfile((p) => withBlocked(p, name))} style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: palette.red }}>BLOCK</Text>
      <Text onPress={() => reportUser(name, what)} style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: palette.lcdDim }}>REPORT</Text>
    </View>
  );
}

const INK = '#141C27';
const norm = (s?: string) => String(s ?? '').replace(/^@+/, '').toLowerCase();
const openProfile = (name?: string) => { if (name) router.push({ pathname: '/profile/[name]', params: { name } }); };

type Post = { id: string; name?: string; make?: string; model?: string; rarity?: Rarity; ts?: number; type?: string; xp?: number };

const ago = (ts?: number) => {
  if (!ts) return '';
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m}M AGO` : m < 1440 ? `${Math.round(m / 60)}H AGO` : `${Math.round(m / 1440)}D AGO`;
};

const Empty = ({ text }: { text: string }) => (
  <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 30 }}>
    <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navyDk, textAlign: 'center' }}>{text}</Text>
  </View>
);

/** What you and your friends just caught, newest first. Anyone else's catches never show here. */
export function FeedList() {
  const gm = useGame();
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [friends, setFriends] = useState<string[] | null>(null);
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    (async () => {
      const [j, fr] = await Promise.all([fetchFeed(), friendsGet(gm.profile.token)]);
      if (!live) return;
      setFriends(fr ? fr.friends.map(norm) : []);
      setFailed(!j?.ok);
      if (j?.ok && Array.isArray(j.posts)) setPosts((j.posts as Post[]).filter((p) => p.make && p.model && !p.type));
      setBusy(false);
    })();
    return () => { live = false; };
  }, [tick, gm.profile.token]);

  const mine = norm(gm.profile.name);
  const shown = posts.filter((p) => !isBlocked(gm.profile, p.name) && (norm(p.name) === mine || (friends ?? []).includes(norm(p.name))));

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(p, i) => p.id ?? String(i)}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { setBusy(true); load(); }} />}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}
        ListEmptyComponent={
          <View>
            <Empty text={failed ? "CAN'T REACH THE FEED. PULL DOWN TO TRY AGAIN." : busy ? 'LOADING...' : friends && friends.length === 0 ? 'ADD FRIENDS TO SEE THEIR CATCHES HERE.' : 'NO CATCHES FROM YOU OR YOUR FRIENDS YET.'} />
            {!busy && !failed ? <View style={{ marginTop: 16, paddingHorizontal: 40 }}><Btn tone="red" label="FRIENDS" onPress={() => router.push('/friends')} /></View> : null}
          </View>
        }
        renderItem={({ item }) => {
          const e = item.make && item.model ? catalogMatch({ make: item.make, model: item.model }) : null;
          const color = TIER_COLOR[item.rarity ?? 'Common'];
          return (
            <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, borderLeftWidth: 10, borderLeftColor: color, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
              <View style={{ width: 92, height: 66, backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', alignItems: 'center', justifyContent: 'center' }}>
                {e ? <Sprite entry={e} size={86} /> : null}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text onPress={() => openProfile(item.name)} style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }} numberOfLines={1}>{(item.name ?? '@spotter').toUpperCase()} CAUGHT</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 21, color: palette.wht }} numberOfLines={1}>{item.make} {item.model}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: color, borderWidth: 2, borderColor: INK, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: ['Common', 'Legendary'].includes(item.rarity ?? 'Common') ? INK : '#fff' }}>{(item.rarity ?? 'Common').toUpperCase()}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>{ago(item.ts)}</Text>
                </View>
                {item.name ? <ModRow name={item.name} what={`${item.make} ${item.model} post`} /> : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

type Row = { name?: string; displayName?: string; xp?: number; caught?: number; dexCount?: number; streak?: number };

/** Top spotters by XP. */
export function RankList() {
  const gm = useGame();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = (await fetchLeaderboard()) as Row[];
      if (!live) return;
      setRows([...r].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0)).slice(0, 50));
      setBusy(false);
    })();
    return () => { live = false; };
  }, [tick]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows.filter((r) => !isBlocked(gm.profile, r.name))}
        keyExtractor={(r, i) => (r.name ?? '') + i}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { setBusy(true); load(); }} />}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
        ListEmptyComponent={<Empty text={busy ? 'LOADING...' : 'NO RANKINGS YET.'} />}
        renderItem={({ item, index }) => {
          const lv = levelFor(item.xp ?? 0);
          const top = index < 3;
          return (
            <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: top ? palette.gold : INK, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <View style={{ width: 40, height: 40, backgroundColor: top ? palette.gold : '#222c3d', borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: top ? INK : '#fff' }}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text onPress={() => openProfile(item.name)} style={{ fontFamily: fonts.display, fontSize: 21, color: palette.wht }} numberOfLines={1}>{item.displayName || item.name}</Text>
                <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>LV.{lv} {rankFor(lv)}  -  {item.dexCount ?? item.caught ?? 0} IN THE BIX</Text>
                {item.name ? <ModRow name={item.name} what="leaderboard name" /> : null}
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.gold }}>{(item.xp ?? 0).toLocaleString()}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}
