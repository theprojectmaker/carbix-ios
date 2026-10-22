import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ago } from '@/components/feed-list';
import { Screen } from '@/components/screen';
import { Btn, PText, Sprite } from '@/components/ui';
import { catalogMatch } from '@/engine/data';
import { TIER_COLOR } from '@/engine/xp';
import { cachedPost, loadFeed, postPhoto, reactTo, REACTIONS, type FeedPost, type ReactKind } from '@/lib/feed';
import { isSelf } from '@/lib/moderation';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flex: 1, minWidth: '30%', backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', padding: 8, alignItems: 'center' }}>
    <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.gold }} numberOfLines={1}>{value}</Text>
    <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: palette.lcdDim, letterSpacing: 1 }}>{label}</Text>
  </View>
);

/** A feed catch: the photo that was taken, the car's stats, who caught it, and reactions. */
export default function PostScreen() {
  const t = useTheme();
  const g = useGame();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<FeedPost | null>(() => cachedPost(String(id)));
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState<Partial<Record<ReactKind, boolean>>>({});

  useEffect(() => {
    if (post) return;
    let live = true;
    loadFeed(g.profile.token, true).then(() => {
      if (!live) return;
      const p = cachedPost(String(id));
      if (p) setPost(p); else setMissing(true);
    });
    return () => { live = false; };
  }, [id, post, g.profile.token]);

  const photo = post ? postPhoto(post.id) : null;
  const e = post?.make && post?.model ? catalogMatch({ make: post.make, model: post.model }) : null;
  const color = TIER_COLOR[post?.rarity ?? 'Common'];
  const mine = isSelf(g.profile, post?.name);

  async function react(kind: ReactKind) {
    if (!post || sent[kind]) return;
    play('click');
    setSent((s) => ({ ...s, [kind]: true }));
    const next = await reactTo(post.id, kind);
    if (next) setPost(next);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        {!post ? (
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: t.muted }}>{missing ? 'THIS POST IS GONE.' : 'LOADING...'}</Text>
        ) : (
          <>
            <View>
              <Text onPress={() => post.name && router.push({ pathname: '/profile/[name]', params: { name: post.name } })}
                style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: t.muted, letterSpacing: 1 }}>
                {mine ? 'YOU' : String(post.name ?? '@spotter').toUpperCase()} CAUGHT
              </Text>
              <PText style={{ fontSize: 34, lineHeight: 36, color: t.red }}>{post.make} {post.model}</PText>
            </View>

            <View style={{ backgroundColor: '#0a0d14', borderWidth: 4, borderColor: color, aspectRatio: 4 / 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {photo ? (
                <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : e ? (
                <Sprite entry={e} size={200} shadow />
              ) : null}
              <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: color, borderWidth: 2, borderColor: INK, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: ['Common', 'Legendary'].includes(post.rarity ?? 'Common') ? INK : '#fff' }}>{(post.rarity ?? 'Common').toUpperCase()}</Text>
              </View>
              {post.shiny ? (
                <View style={{ position: 'absolute', right: 8, top: 8, backgroundColor: palette.gold, borderWidth: 2, borderColor: INK, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: INK }}>SHINY</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: t.muted }}>CAUGHT {ago(post.ts)}</Text>

            <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 10 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>THE CAR</Text>
              {e ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Stat label="POWER" value={e.hp ? `${e.hp} HP` : '?'} />
                    <Stat label="TOP SPEED" value={e.top ? `${e.top} MPH` : '?'} />
                    <Stat label="YEARS" value={String(e.years ?? '?')} />
                  </View>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
                    {[e.cls].filter(Boolean).join('  -  ').toUpperCase()}
                  </Text>
                  <Btn small tone="navy" label="FULL CAR PAGE" onPress={() => router.push({ pathname: '/car/[n]', params: { n: String(e.n) } })} />
                </>
              ) : (
                <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>NOT IN THE BIX YET, SO THERE ARE NO STATS TO SHOW.</Text>
              )}
            </View>

            <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>REACT</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {REACTIONS.map((r) => (
                  <View key={r.kind} style={{ flex: 1 }}>
                    <Btn small tone={sent[r.kind] ? 'gold' : 'plain'} label={`${r.label} ${post[r.kind] ?? 0}`} onPress={() => react(r.kind)} />
                  </View>
                ))}
              </View>
            </View>

            {post.name && !mine ? (
              <Btn tone="plain" label="SEE THEIR PROFILE" onPress={() => router.push({ pathname: '/profile/[name]', params: { name: String(post.name) } })} />
            ) : null}
          </>
        )}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
