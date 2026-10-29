import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ago } from '@/components/feed-list';
import { Plate } from '@/components/plate';
import { RaceIcon, SeasonIcon } from '@/components/pixel-icons';
import { Screen } from '@/components/screen';
import { Bar, Btn, PText, Sprite } from '@/components/ui';
import { cotd, evalChallenges, SPOT_HEX, spotlightColor } from '@/engine/daily';
import { CATALOG, CATALOG_BY_N, catalogMatch } from '@/engine/data';
import { currentSeason, SEASON_EVENT_NAMES } from '@/engine/quests';
import { dateKeyET } from '@/engine/store';
import { RANKS, TIER_COLOR, xpForLevel } from '@/engine/xp';
import { loadFeed, visiblePosts, type FeedPost } from '@/lib/feed';
import { isBlocked } from '@/lib/moderation';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';

/** A dark panel with a heading and an optional action link. */
function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowOffset: { width: 3, height: 3 }, shadowRadius: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht, letterSpacing: 1 }}>
          <Text style={{ color: palette.red }}>» </Text>{title}
        </Text>
        {action ? <Text onPress={onAction} style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.red, padding: 4 }}>{action} ›</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(20,28,39,.08)', borderWidth: 2, borderColor: INK, paddingVertical: 6, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: INK }}>{value}</Text>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: '#5a6478', letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

export default function Home() {
  const t = useTheme();
  const g = useGame();
  const race = useRace();
  const season = currentSeason();
  const today = dateKeyET();
  const [now] = useState(() => Date.now());
  const [license, setLicense] = useState(false);
  const [friendPosts, setFriendPosts] = useState<FeedPost[]>([]);
  const daysLeft = Math.max(1, Math.ceil((season.end - now) / 864e5));

  const car = cotd(CATALOG, today);
  const gotCotd = g.garage.some((c) => {
    const h = catalogMatch(c.car);
    return h && h.n === car.n && dateKeyET(new Date(c.ts)) === today;
  });
  const spot = spotlightColor(today);
  const ch = useMemo(() => evalChallenges(g.garage, g.profile).list, [g.garage, g.profile]);
  const doneCh = ch.filter((c) => c.done).length;
  const quests = g.quests().quests;
  const step = (g.profile.questStep as number) || 0;
  const q = quests[step];
  const starts = (g.profile.questStarts || {}) as Record<number, number>;
  const prog = q ? q.test(starts[step] ?? 0) : null;
  const into = g.xp - g.prevLevelXp;
  const span = Math.max(1, g.nextLevelXp - g.prevLevelXp);
  const nextRank = RANKS.find(([lv]) => lv > g.level);
  const toNext = nextRank ? Math.max(0, xpForLevel(nextRank[0]) - g.xp) : 0;
  const brands = new Set(g.garage.map((c) => c.car.make)).size;
  const avatar = g.profile.avatar ? CATALOG_BY_N.get(g.profile.avatar) : g.garage[0] ? catalogMatch(g.garage[0].car) : null;
  const recent = g.garage.slice(0, 8);
  const lic = g.profile.lic.replace(/^MDX-/, 'CBX-');
  const orbs = (g.profile.orbs as number) || 0;
  const examDone = g.profile.examDay === today;
  const caughtToday = g.garage.some((c) => dateKeyET(new Date(c.ts)) === today);
  const streakAtRisk = g.streak >= 2 && !caughtToday && new Date().getHours() >= 15;
  const spinDone = g.profile.spinDay === today;

  // what your friends caught lately
  useEffect(() => {
    let live = true;
    loadFeed(g.profile.token, false, g.profile.name).then((s) => {
      if (!live) return;
      const mine = g.profile.name;
      const them = visiblePosts(s.posts, s.friends, mine, (n) => isBlocked(g.profile, n)).filter((p) => String(p.name ?? '').replace(/^@/, '').toLowerCase() !== mine.replace(/^@/, '').toLowerCase());
      setFriendPosts(them.slice(0, 3));
    });
    return () => { live = false; };
  }, [g.profile]);

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30, gap: 14 }}>
        {/* race invites outrank everything */}
        {race.invites.length ? (
          <Pressable onPress={() => { play('tab'); router.push('/race'); }} accessibilityRole="button">
            <View style={{ backgroundColor: palette.gold, borderWidth: 3, borderColor: INK, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <RaceIcon size={30} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: INK }}>{race.invites[0].from} INVITED YOU TO A RACE</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: INK }}>TAP TO JOIN</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        {streakAtRisk ? (
          <Pressable onPress={() => { play('tab'); router.navigate('/'); }} accessibilityRole="button">
            <View style={{ backgroundColor: palette.red, borderWidth: 3, borderColor: INK, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 30, color: '#fff' }}>{g.streak}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 19, color: '#fff' }}>YOUR {g.streak}-DAY STREAK ENDS AT MIDNIGHT</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: 'rgba(255,255,255,.85)' }}>ONE SCAN KEEPS IT. TAP TO SCAN.</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        {/* you */}
        <View style={{ backgroundColor: '#F6F3EA', borderWidth: 3, borderColor: INK, shadowColor: '#000', shadowOpacity: 0.35, shadowOffset: { width: 4, height: 4 }, shadowRadius: 0 }}>
          <Pressable onPress={() => { play('click'); setLicense(!license); }} accessibilityRole="button" accessibilityLabel="Toggle spotter license">
            <View style={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 84, height: 66, backgroundColor: palette.panel2, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                {avatar ? <Sprite entry={avatar} size={74} /> : <PText style={{ color: palette.red, fontSize: 30 }}>C</PText>}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: INK }} numberOfLines={1}>{g.profile.displayName}</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: palette.red }}>LV.{g.level} {g.rank}</Text>
                <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: '#5a6478' }}>{license ? 'TAP TO HIDE LICENSE' : 'TAP FOR YOUR LICENSE'}</Text>
              </View>
            </View>
          </Pressable>
          <View style={{ paddingHorizontal: 12, gap: 5 }}>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.red }}>{nextRank ? `${toNext.toLocaleString()} XP TO ${nextRank[1]}` : 'MAX RANK'}</Text>
            <Bar value={into / span} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
            <Stat label="XP" value={g.xp.toLocaleString()} />
            <Stat label="IN BIX" value={String(g.caughtNs.size)} />
            <Stat label="CAUGHT" value={String(g.garage.length)} />
            <Stat label="STREAK" value={String(g.streak)} />
          </View>
          {license ? (
            <View style={{ borderTopWidth: 3, borderTopColor: INK, padding: 12, gap: 3 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.red }}>SPOTTER LICENSE  <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: '#5a6478' }}>{lic}</Text></Text>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: INK }}>{g.profile.name}  -  {brands} BRANDS  -  ISSUED {g.profile.issued}</Text>
              {(g.profile.title as string) ? <Text style={{ fontFamily: fonts.utility, fontSize: 11, color: palette.red }}>{g.profile.title as string}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* go */}
        <Pressable onPress={() => { play('tab'); router.navigate('/'); }} accessibilityRole="button" accessibilityLabel="Scan a car">
          {({ pressed }) => (
            <Plate color={palette.red} depth={4} pressed={pressed} style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 30, color: '#fff', letterSpacing: 2 }}>SCAN A CAR</Text>
            </Plate>
          )}
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Quick label="RACE" icon={<RaceIcon size={22} />} onPress={() => router.push('/race')} />
          <Quick label="SEASON" icon={<SeasonIcon size={22} />} onPress={() => router.push('/season')} />
          <Quick label={`${orbs} ORBS`} onPress={() => router.push({ pathname: '/season', params: { tab: 'shop' } })} />
        </View>

        {/* today */}
        <Panel title="TODAY">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
            <Sprite entry={car} size={74} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.wht }} numberOfLines={1}>{car.make} {car.model}</Text>
              <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>
                CAR OF THE DAY - <Text style={{ color: TIER_COLOR[car.rarity] }}>{car.rarity.toUpperCase()}</Text>
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: gotCotd ? palette.green : palette.gold }}>{gotCotd ? 'CAUGHT' : '2X XP'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
            <View style={{ width: 44, height: 44, backgroundColor: SPOT_HEX[spot] ?? '#888', borderWidth: 2, borderColor: INK }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.red }}>SPOTLIGHT</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.wht }}>ANY {spot.toUpperCase()} CAR</Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.gold }}>+50%</Text>
          </View>
        </Panel>

        {g.garage.length >= 1 ? (
          <>
            {/* the one thing to do next */}
            <Panel title="DO THIS NOW" action="ALL QUESTS" onAction={() => router.push('/season')}>
              {q && prog ? (
                <>
                  <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht }}>{q.t}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 15, color: palette.gold }}>{Math.min(prog.have, prog.need)} / {prog.need}</Text>
                    <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>{SEASON_EVENT_NAMES[season.event]} - {daysLeft}D LEFT</Text>
                  </View>
                  <Bar value={prog.need ? Math.min(1, prog.have / prog.need) : 0} color={palette.green} />
                </>
              ) : (
                <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.wht }}>YOU DID EVERY QUEST!</Text>
              )}
            </Panel>

            <Panel title={`DAILY ${doneCh}/${ch.length}`}>
              {ch.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 17, color: c.done ? palette.green : palette.wht, flex: 1 }}>{c.done ? '[X] ' : ''}{c.label}</Text>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.gold }}>{c.prog}/{c.n} +{c.xp}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 10, paddingTop: 4 }}>
                <GameTile title="EXAM" sub={examDone ? `DONE ${(g.profile.examLast as number) || 0}/5` : '5 QUESTIONS'} done={examDone} onPress={() => router.push('/exam')} />
                <GameTile title="SPIN" sub={spinDone ? `+${(g.profile.spinLast as number) || 0} XP` : 'FREE SPIN'} done={spinDone} onPress={() => router.push('/spin')} />
              </View>
            </Panel>
          </>
        ) : (
          <Panel title="WELCOME">
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: palette.wht }}>
              ONE CATCH AND THE WHOLE BOARD OPENS UP: DAILY CHALLENGES AND SEASON QUESTS, ALL WAITING ON YOUR FIRST SCAN.
            </Text>
          </Panel>
        )}

        {/* friends */}
        <Panel title="FRIENDS" action="FEED" onAction={() => router.navigate('/social')}>
          {friendPosts.length === 0 ? (
            <>
              <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.lcdDim }}>
                ADD FRIENDS TO SEE WHAT THEY CATCH, RACE THEM AND DUEL THEIR BIX.
              </Text>
              <Btn small tone="navy" label="FIND FRIENDS" onPress={() => router.push('/friends')} />
            </>
          ) : (
            friendPosts.map((p) => {
              const e = p.make && p.model ? catalogMatch({ make: p.make, model: p.model }) : null;
              return (
                <Pressable key={p.id} onPress={() => { play('tab'); router.push({ pathname: '/post/[id]', params: { id: p.id } }); }} accessibilityRole="button">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                    {e ? <Sprite entry={e} size={54} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.wht }} numberOfLines={1}>{p.make} {p.model}</Text>
                      <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>{String(p.name ?? '').toUpperCase()}  -  {ago(p.ts)}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.lcdDim }}>›</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </Panel>

        {/* your latest */}
        <Panel title="YOUR LATEST" action="GARAGE" onAction={() => router.navigate('/bix')}>
          {recent.length === 0 ? (
            <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.lcdDim }}>NOTHING CAUGHT YET.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recent.map((c) => {
                const e = catalogMatch(c.car);
                return (
                  <Pressable key={c.id} onPress={() => { play('tab'); router.push({ pathname: '/card/[id]', params: { id: String(c.id) } }); }} accessibilityRole="button">
                    <View style={{ width: 110, backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', borderTopWidth: 5, borderTopColor: TIER_COLOR[c.car.rarity], alignItems: 'center', padding: 4 }}>
                      {e ? <Sprite entry={e} size={90} /> : null}
                      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 13, color: palette.wht }}>{c.car.model.toUpperCase()}</Text>
                      <Text style={{ fontFamily: fonts.utility, fontSize: 8, color: palette.lcdDim }}>{ago(c.ts)}{c.shiny ? '  SHINY' : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Panel>

        {/* more */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {([['BADGES', '/badges'], ['TROPHIES', '/trophies'], ['FRIENDS', '/friends'], ['POSTER', '/poster'], ['SETTINGS', '/settings']] as const).map(([lab, to]) => (
            <View key={lab} style={{ width: '31%', flexGrow: 1 }}>
              <Quick label={lab} onPress={() => router.push(to)} />
            </View>
          ))}
        </View>

        {!g.profile.googleLinked ? (
          <Panel title="SAVE YOUR GARAGE">
            <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.lcdDim }}>SIGN IN WITH GOOGLE TO BACK UP YOUR GARAGE AND USE IT ON ANY PHONE.</Text>
            <Btn small tone="red" label="SIGN IN" onPress={() => router.push('/settings')} />
          </Panel>
        ) : null}
        <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: t.muted, textAlign: 'center' }}>{SEASON_EVENT_NAMES[season.event]}  -  {season.name}</Text>
      </ScrollView>
    </Screen>
  );
}

function GameTile({ title, sub, done, onPress }: { title: string; sub: string; done: boolean; onPress: () => void }) {
  return (
    <Pressable style={{ flex: 1 }} onPress={() => { play('click'); onPress(); }} accessibilityRole="button">
      <View style={{ borderWidth: 2, borderColor: done ? palette.green : palette.line, padding: 10, alignItems: 'center', gap: 2 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: done ? palette.green : palette.wht }}>{title}</Text>
        <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>{sub}</Text>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: done ? palette.green : palette.gold }}>{done ? 'DONE' : 'PLAY'}</Text>
      </View>
    </Pressable>
  );
}

function Quick({ label, icon, onPress }: { label: string; icon?: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable style={{ flex: 1 }} onPress={() => { play('tab'); onPress(); }} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <Plate color={palette.navy} depth={3} pressed={pressed} style={{ paddingVertical: 12, alignItems: 'center', gap: 4 }}>
          {icon}
          <Text style={{ fontFamily: fonts.display, fontSize: 17, color: '#fff', letterSpacing: 1 }}>{label}</Text>
        </Plate>
      )}
    </Pressable>
  );
}
