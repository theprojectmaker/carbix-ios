import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { Btn, Chip, Sprite } from '@/components/ui';
import { catalogMatch } from '@/engine/data';
import { TIER_COLOR } from '@/engine/xp';
import { loadFeed, visiblePosts, type FeedPost } from '@/lib/feed';
import { isBlocked, isSelf } from '@/lib/moderation';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';

export const ago = (ts?: number) => {
  if (!ts) return '';
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m}M AGO` : m < 1440 ? `${Math.round(m / 60)}H AGO` : `${Math.round(m / 1440)}D AGO`;
};

const Empty = ({ text }: { text: string }) => (
  <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 30 }}>
    <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navyDk, textAlign: 'center' }}>{text}</Text>
  </View>
);

const total = (p: FeedPost) => (p.heart ?? 0) + (p.fire ?? 0) + (p.star ?? 0) + (p.lol ?? 0);

/** What you and your friends just caught. Tap a catch for its photo and stats. */
export function FeedList() {
  const gm = useGame();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [only, setOnly] = useState<'all' | 'mine'>('all');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => { setBusy(true); setTick((n) => n + 1); }, []);

  useEffect(() => {
    let live = true;
    loadFeed(gm.profile.token, tick > 0, gm.profile.name).then((s) => {
      if (!live) return;
      setPosts(s.posts);
      setFriends(s.friends);
      setFailed(s.failed);
      setBusy(false);
    });
    return () => { live = false; };
  }, [tick, gm.profile.token, gm.profile.name]);

  const shown = visiblePosts(posts, friends, gm.profile.name, (n) => isBlocked(gm.profile, n))
    .filter((p) => only === 'all' || isSelf(gm.profile, p.name));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 4 }}>
        <Chip label="EVERYONE I FOLLOW" on={only === 'all'} onPress={() => setOnly('all')} />
        <Chip label="JUST ME" on={only === 'mine'} onPress={() => setOnly('mine')} />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}
        initialNumToRender={8}
        windowSize={5}
        ListEmptyComponent={
          <View>
            <Empty
              text={
                failed ? "CAN'T REACH THE FEED. PULL DOWN TO TRY AGAIN."
                : busy ? 'LOADING...'
                : friends.length === 0 && only === 'all' ? 'ADD FRIENDS TO SEE THEIR CATCHES HERE.'
                : 'NO CATCHES YET. SCAN A CAR AND IT SHOWS UP HERE.'
              }
            />
            {!busy && !failed ? (
              <View style={{ marginTop: 16, paddingHorizontal: 40, gap: 10 }}>
                <Btn tone="red" label="FIND FRIENDS" onPress={() => router.push('/friends')} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const e = item.make && item.model ? catalogMatch({ make: item.make, model: item.model }) : null;
          const color = TIER_COLOR[item.rarity ?? 'Common'];
          const n = total(item);
          const mine = isSelf(gm.profile, item.name);
          return (
            <Pressable onPress={() => { play('tab'); router.push({ pathname: '/post/[id]', params: { id: item.id } }); }} accessibilityRole="button"
              accessibilityLabel={`${item.name} caught a ${item.make} ${item.model}`}>
              {({ pressed }) => (
                <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, borderLeftWidth: 10, borderLeftColor: color, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, opacity: pressed ? 0.85 : 1 }}>
                  <View style={{ width: 92, height: 66, backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', alignItems: 'center', justifyContent: 'center' }}>
                    {e ? <Sprite entry={e} size={86} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }} numberOfLines={1}>
                      {mine ? 'YOU' : String(item.name ?? '@spotter').toUpperCase()} CAUGHT
                    </Text>
                    <Text style={{ fontFamily: fonts.display, fontSize: 21, color: palette.wht }} numberOfLines={1}>{item.make} {item.model}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: color, borderWidth: 2, borderColor: INK, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: ['Common', 'Legendary'].includes(item.rarity ?? 'Common') ? INK : '#fff' }}>{(item.rarity ?? 'Common').toUpperCase()}</Text>
                      </View>
                      {item.shiny ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: palette.gold }}>SHINY</Text> : null}
                      <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>{ago(item.ts)}</Text>
                      {n > 0 ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.gold }}>{n} REACTION{n === 1 ? '' : 'S'}</Text> : null}
                    </View>
                  </View>
                  <Text style={{ fontFamily: fonts.display, fontSize: 24, color: palette.lcdDim }}>›</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
