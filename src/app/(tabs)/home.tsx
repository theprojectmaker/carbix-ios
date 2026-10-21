import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Plate } from '@/components/plate';
import { RaceIcon, SeasonIcon } from '@/components/pixel-icons';
import { Screen } from '@/components/screen';
import { Bar, Btn, PText, Sprite } from '@/components/ui';
import { cotd, evalChallenges, SPOT_HEX, spotlightColor } from '@/engine/daily';
import { CATALOG, CATALOG_BY_N, catalogMatch } from '@/engine/data';
import { currentSeason, SEASON_EVENT_NAMES } from '@/engine/quests';
import { dateKeyET } from '@/engine/store';
import { RANKS, TIER_COLOR, xpForLevel } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const SEASON_LABELS = ['SPORTS SEASON', 'WORKHORSE SEASON', 'IMPORT SEASON', 'LUXURY SEASON'];

const ago = (ts: number) => {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m}M AGO` : m < 1440 ? `${Math.round(m / 60)}H AGO` : `${Math.round(m / 1440)}D AGO`;
};

/** A dark LCD panel — the web app's .dpanel. */
function DarkPanel({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 3, height: 3 }, shadowRadius: 0 }}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht, letterSpacing: 1, textAlign: 'center' }}>
            <Text style={{ color: palette.red }}>» </Text>{title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    const out: number[] = [];
    for (let i = 0; i < 46; i++) {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      out.push(1 + (h % 3));
    }
    return out;
  }, [seed]);
  return (
    <View style={{ flexDirection: 'row', height: 24, alignItems: 'stretch', overflow: 'hidden' }}>
      {bars.map((w, i) => (
        <View key={i} style={{ width: w * 2, marginRight: 2, backgroundColor: i % 2 ? 'transparent' : INK }} />
      ))}
    </View>
  );
}

export default function Home() {
  const t = useTheme();
  const g = useGame();
  const season = currentSeason();
  const today = dateKeyET();
  const [now] = useState(() => Date.now());
  const daysLeft = Math.max(1, Math.ceil((season.end - now) / 864e5));
  const car = cotd(CATALOG, today);
  const gotCotd = g.garage.some((c) => {
    const h = catalogMatch(c.car);
    return h && h.n === car.n && dateKeyET(new Date(c.ts)) === today;
  });
  const spot = spotlightColor(today);
  const ch = useMemo(() => evalChallenges(g.garage, g.profile).list, [g.garage, g.profile]);
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
  const recent = g.garage.slice(0, 5);
  const lic = g.profile.lic.replace(/^MDX-/, 'CBX-');
  const title = (g.profile.title as string) || '';

  const row = (k: string, v: string) => (
    <View key={k} style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: t.muted, width: 56 }}>{k}</Text>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: INK }}>{v}</Text>
    </View>
  );

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 16 }}>
        {/* SPOTTER LICENSE */}
        <View style={{ backgroundColor: '#F6F3EA', borderWidth: 3, borderColor: INK, shadowColor: '#000', shadowOpacity: 0.35, shadowOffset: { width: 4, height: 4 }, shadowRadius: 0 }}>
          <View style={{ flexDirection: 'row', height: 10, overflow: 'hidden' }}>
            {Array.from({ length: 40 }).map((_, i) => (
              <View key={i} style={{ width: 10, height: 10, backgroundColor: i % 2 ? '#fff' : INK }} />
            ))}
          </View>
          <View style={{ backgroundColor: palette.red, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: INK }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff', letterSpacing: 1 }}>SPOTTER LICENSE</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: 'rgba(255,255,255,.85)' }}>{lic}</Text>
          </View>
          <View style={{ padding: 12, flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 86, height: 68, backgroundColor: palette.panel2, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}>
              {avatar ? <Sprite entry={avatar} size={76} /> : <PText style={{ color: palette.red, fontSize: 30 }}>C</PText>}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.goldDk }}>
                {g.profile.displayName} <Text style={{ fontSize: 13, color: t.muted }}>{g.profile.name}</Text>
              </Text>
              {title ? <Text style={{ fontFamily: fonts.utility, fontSize: 11, color: palette.red }}>{title}</Text> : null}
              {row('RANK', `LV.${g.level} ${g.rank}`)}
              {row('BIX', `${g.caughtNs.size} / ${CATALOG.length}`)}
              {row('CAUGHT', String(g.garage.length))}
              {row('BRANDS', String(brands))}
              {row('ISSUED', g.profile.issued)}
            </View>
          </View>
          <View style={{ paddingHorizontal: 12, gap: 6 }}>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.red }}>
              {nextRank ? `${toNext.toLocaleString()} XP TO ${nextRank[1]}` : 'MAX RANK'}
            </Text>
            <Bar value={into / span} />
          </View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            <Barcode seed={lic} />
          </View>
          <View style={{ backgroundColor: palette.navyDk, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 3, borderTopColor: INK }}>
            <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.wht }}>CARBIX MVD</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.wht }}>{g.xp.toLocaleString()} XP</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Quick label="SCAN" tone="red" onPress={() => router.navigate('/')} />
          <Quick label="RACE" icon={<RaceIcon size={22} />} onPress={() => router.push('/race')} />
          <Quick label="SEASON" icon={<SeasonIcon size={22} />} onPress={() => router.push('/season')} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {([
            ['BADGES', '/badges'], ['TROPHIES', '/trophies'], ['FRIENDS', '/friends'], ['CLUBS', '/clubs'], ['LEAGUE', '/league'], ['POSTER', '/poster'],
          ] as const).map(([lab, to]) => (
            <View key={lab} style={{ width: '31%' }}>
              <Quick label={lab} onPress={() => router.push(to)} />
            </View>
          ))}
        </View>
        <Btn label="SETTINGS" onPress={() => router.push('/settings')} />

        <DarkPanel title="CLOUD SAVE">
          <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.lcdDim }}>
            {g.profile.googleLinked ? 'LINKED — YOUR GARAGE SYNCS AUTOMATICALLY' : 'NOT BACKED UP — LINK A DEVICE BELOW'}
          </Text>
          {!g.profile.googleLinked ? <Btn small label="LINK WITH A CODE" onPress={() => router.push('/settings')} /> : null}
        </DarkPanel>

        <DarkPanel title="TODAY">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
            <Sprite entry={car} size={74} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.wht }} numberOfLines={1}>{car.make} {car.model}</Text>
              <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>
                CAR OF THE DAY · <Text style={{ color: TIER_COLOR[car.rarity] }}>{car.rarity.toUpperCase()}</Text>
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: gotCotd ? palette.green : palette.gold }}>{gotCotd ? 'CAUGHT' : '2X XP'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
            <View style={{ width: 52, height: 52, backgroundColor: SPOT_HEX[spot] ?? '#888', borderWidth: 2, borderColor: INK }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: '#fff', backgroundColor: palette.red, alignSelf: 'flex-start', paddingHorizontal: 5, paddingVertical: 2 }}>SPOTLIGHT</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.wht }}>ANY {spot.toUpperCase()} CAR TODAY</Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.gold }}>+50%</Text>
          </View>
        </DarkPanel>

        {g.garage.length >= 1 ? (
          <>
            <DarkPanel
              title={season.name}
              right={<Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.lcdDim }}>{daysLeft}d LEFT</Text>}>
              <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.gold }}>
                {SEASON_LABELS[season.idx]} · {SEASON_EVENT_NAMES[season.event]}
              </Text>
              <View style={{ borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8, gap: 6 }}>
                <Text onPress={() => router.push('/season')} style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.red }}>QUESTS ›</Text>
                {q && prog ? (
                  <>
                    <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.wht }}>{q.t}</Text>
                    <Text style={{ fontFamily: fonts.display, fontSize: 15, color: palette.gold }}>{Math.min(prog.have, prog.need)} / {prog.need}</Text>
                  </>
                ) : (
                  <Text style={{ fontFamily: fonts.display, fontSize: 18, color: palette.wht }}>YOU DID EVERY QUEST!</Text>
                )}
                <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>SEASON PROGRESS — {step}/{quests.length}</Text>
                <Bar value={step / quests.length} color={palette.green} />
              </View>
            </DarkPanel>

            <DarkPanel title={`DAILY · ${g.streak} DAY STREAK`}>
              {ch.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 17, color: c.done ? palette.green : palette.wht, flex: 1 }}>
                    {c.done ? '[X] ' : ''}{c.label}
                  </Text>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.gold }}>{c.prog}/{c.n} +{c.xp}</Text>
                </View>
              ))}
            </DarkPanel>

            <DarkPanel title="DAILY GAMES">
              <GameRow
                title="SPOTTER EXAM"
                sub={g.profile.examDay === today ? `DONE TODAY: ${(g.profile.examLast as number) || 0}/5` : '5 QUESTIONS, +3 XP EACH'}
                done={g.profile.examDay === today}
                onPress={() => router.push('/exam')}
              />
              <GameRow
                title="LUCKY SPIN"
                sub={g.profile.spinDay === today ? `DONE TODAY: +${(g.profile.spinLast as number) || 0} XP` : 'FREE, 10 TO 100 XP'}
                done={g.profile.spinDay === today}
                onPress={() => router.push('/spin')}
              />
            </DarkPanel>
          </>
        ) : (
          <DarkPanel>
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: palette.wht }}>
              ONE CATCH AND THE WHOLE BOARD OPENS UP — DAILY CHALLENGES AND SEASON QUESTS, ALL WAITING ON YOUR FIRST SCAN.
            </Text>
            <Btn tone="red" label="SCAN A CAR" onPress={() => router.navigate('/')} />
          </DarkPanel>
        )}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile label="QUESTS" sub={`${step}/${quests.length}`} note="IN ORDER — TAP TO VIEW" onPress={() => router.push('/season')} />
          <Tile label="SHOP" sub={`${(g.profile.orbs as number) || 0} ORBS`} note="SPEND THEM HERE" onPress={() => router.push({ pathname: '/season', params: { tab: 'shop' } })} />
        </View>

        <DarkPanel
          title="RECENT ACTIVITY"
          right={<Text onPress={() => router.navigate('/bix')} style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.red }}>GARAGE ›</Text>}>
          {recent.length === 0 ? (
            <Text style={{ fontFamily: fonts.utility, fontSize: 10, color: palette.lcdDim }}>NOTHING CAUGHT YET.</Text>
          ) : (
            recent.map((c) => {
              const e = catalogMatch(c.car);
              return (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                  {e ? <Sprite entry={e} size={60} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht }} numberOfLines={1} onPress={() => router.push({ pathname: '/card/[id]', params: { id: String(c.id) } })}>
                      {c.car.make} {c.car.model}
                    </Text>
                    <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>
                      <Text style={{ color: TIER_COLOR[c.car.rarity] }}>{c.car.rarity.toUpperCase()}</Text> {ago(c.ts)}{c.shiny ? '  SHINY' : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </DarkPanel>
      </ScrollView>
    </Screen>
  );
}

function GameRow({ title, sub, done, onPress }: { title: string; sub: string; done: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { play('click'); onPress(); }} accessibilityRole="button">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8, gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: done ? palette.green : palette.wht }}>{title}</Text>
          <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>{sub}</Text>
        </View>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: done ? palette.green : palette.gold }}>{done ? 'DONE' : 'PLAY'}</Text>
      </View>
    </Pressable>
  );
}

function Quick({ label, icon, tone = 'navy', onPress }: { label: string; icon?: React.ReactNode; tone?: 'red' | 'navy'; onPress: () => void }) {
  return (
    <Pressable style={{ flex: 1 }} onPress={() => { play('tab'); onPress(); }} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <Plate color={tone === 'red' ? palette.red : palette.navy} depth={3} pressed={pressed} style={{ paddingVertical: 12, alignItems: 'center', gap: 4 }}>
          {icon}
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: '#fff', letterSpacing: 1 }}>{label}</Text>
        </Plate>
      )}
    </Pressable>
  );
}

function Tile({ label, sub, note, onPress }: { label: string; sub: string; note: string; onPress: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Plate color={palette.navyDk} depth={3} style={{ padding: 12, gap: 4 }}>
        <Text onPress={() => { play('click'); onPress(); }} style={{ fontFamily: fonts.display, fontSize: 24, color: '#fff' }}>{label}</Text>
        <Text onPress={() => { play('click'); onPress(); }} style={{ fontFamily: fonts.display, fontSize: 20, color: palette.gold }}>{sub}</Text>
        <Text onPress={() => { play('click'); onPress(); }} style={{ fontFamily: fonts.utility, fontSize: 8, color: palette.lcdDim }}>{note}</Text>
      </Plate>
    </View>
  );
}
