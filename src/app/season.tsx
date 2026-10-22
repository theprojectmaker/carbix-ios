import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { PinArt } from '@/components/map-pin';
import { SeasonGlyph, ShopIcon } from '@/components/shop-icons';
import { Btn, Chip, PText } from '@/components/ui';
import { chaptersFor, currentSeason, SEASON_EVENT_NAMES, type Quest } from '@/engine/quests';
import { SEASON_APP_ICONS, iconEquipped, iconOwned, ownedKey } from '@/engine/appicons';
import { effectEntries, mapPinEntries } from '@/engine/shop';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
function Panel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, borderLeftWidth: accent ? 10 : 3, borderLeftColor: accent ?? INK, padding: 12, gap: 8 }}>
      {children}
    </View>
  );
}

function Chipish({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color, borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: INK }}>{label}</Text>
    </View>
  );
}

/** The quest you are on, said in plain words: what to do, how far along, what you win. */
function NowCard({ q, step, total, have, need }: { q: Quest; step: number; total: number; have: number; need: number }) {
  const filled = Math.min(have, need);
  const dots = need <= 12;
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 4, borderColor: palette.gold, padding: 14, gap: 10 }}>
      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.gold, letterSpacing: 1.5 }}>DO THIS NOW  -  QUEST {step + 1} OF {total}</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: '#fff' }}>{q.t}</Text>
      {q.desc ? <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>{q.desc}</Text> : null}
      {q.altDesc ? <Text style={{ fontFamily: fonts.prose, fontSize: 13, color: palette.lcdDim }}>{q.altDesc}</Text> : null}
      {dots ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {Array.from({ length: need }).map((_, i) => (
            <View key={i} style={{ width: 26, height: 26, borderWidth: 3, borderColor: INK, backgroundColor: i < filled ? palette.green : '#222c3d' }} />
          ))}
        </View>
      ) : (
        <View style={{ height: 18, borderWidth: 3, borderColor: INK, backgroundColor: '#222c3d' }}>
          <View style={{ flex: 1, width: `${(filled / need) * 100}%`, backgroundColor: palette.green }} />
        </View>
      )}
      <Text style={{ fontFamily: fonts.display, fontSize: 20, color: filled >= need ? palette.green : '#fff' }}>{filled} of {need} done</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>YOU WIN</Text>
        <Chipish label={`${q.xp} XP`} color={palette.gold} />
        <Chipish label={`${q.orbs} ORBS`} color="#8FC9BE" />
        {q.badge ? <Chipish label="BADGE" color="#E8705F" /> : null}
      </View>
      <Btn tone="red" label="GO SCAN A CAR" onPress={() => { play('tab'); router.back(); router.navigate('/'); }} />
      <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>
        ONLY CARS YOU CATCH FROM NOW COUNT. DONE QUESTS PAY XP AND ORBS AUTOMATICALLY.
      </Text>
    </View>
  );
}

function QuestsView() {
  const g = useGame();
  const season = currentSeason();
  const { quests } = g.quests();
  const step = (g.profile.questStep as number) || 0;
  const starts = (g.profile.questStarts || {}) as Record<number, number>;
  const q = quests[step];
  const prog = q ? q.test(starts[step] ?? 0) : null;
  const chapters = chaptersFor(season.event);
  const [openCh, setOpenCh] = useState<Record<string, boolean>>({});

  return (
    <>
      <Panel>
        <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim, lineHeight: 15 }}>
          HOW IT WORKS: THERE ARE {quests.length} QUESTS. YOU DO THEM ONE AT A TIME, IN ORDER. FINISH ONE AND THE NEXT OPENS. YOU EARN XP AND ORBS. ORBS BUY THINGS IN THE SHOP TAB.
        </Text>
      </Panel>

      {q && prog ? (
        <NowCard q={q} step={step} total={quests.length} have={prog.have} need={prog.need} />
      ) : (
        <Panel>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: palette.gold }}>YOU FINISHED EVERY QUEST</Text>
          <Text style={{ fontFamily: fonts.prose, fontSize: 15, color: '#C9D2E6' }}>A brand new set shows up next season.</Text>
        </Panel>
      )}

      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.lcdDim, letterSpacing: 1.5, marginTop: 4 }}>
        THE WHOLE SEASON  -  {step} OF {quests.length} DONE
      </Text>
      {chapters.map((c) => {
        const done = Math.max(0, Math.min(step, c.to + 1) - c.from);
        const total = c.to - c.from + 1;
        const here = step >= c.from && step <= c.to;
        const open = openCh[c.key] ?? here;
        return (
          <View key={c.key} style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: here ? c.accent : INK }}>
            <Pressable onPress={() => { play('click'); setOpenCh({ ...openCh, [c.key]: !open }); }} style={{ padding: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }}>{c.name}</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: done === total ? palette.green : palette.lcdDim }}>
                  {done === total ? 'COMPLETE' : `${done}/${total}`}  {open ? 'HIDE' : 'SHOW'}
                </Text>
              </View>
              <View style={{ height: 12, borderWidth: 2, borderColor: INK, backgroundColor: '#222c3d' }}>
                <View style={{ flex: 1, width: `${(done / total) * 100}%`, backgroundColor: c.accent }} />
              </View>
            </Pressable>
            {open ? (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                {quests.slice(c.from, c.to + 1).map((qq, k) => {
                  const idx = c.from + k;
                  const st = idx < step ? 'done' : idx === step ? 'now' : 'locked';
                  const big = !!qq.badge;
                  const col = st === 'done' ? palette.green : st === 'now' ? palette.gold : '#3a4660';
                  return (
                    <View key={idx} style={{ flexDirection: 'row', gap: 10, alignItems: 'stretch' }}>
                      <View style={{ alignItems: 'center', width: 30 }}>
                        <View style={{ width: 2, height: 8, backgroundColor: k === 0 ? 'transparent' : '#3a4660' }} />
                        <View style={{ width: big ? 28 : 22, height: big ? 28 : 22, backgroundColor: col, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: INK }}>{st === 'done' ? 'OK' : idx + 1}</Text>
                        </View>
                        <View style={{ width: 2, flex: 1, backgroundColor: k === c.to - c.from ? 'transparent' : '#3a4660' }} />
                      </View>
                      <View style={{ flex: 1, paddingVertical: 8 }}>
                        <Text style={{ fontFamily: fonts.display, fontSize: 17, color: st === 'locked' ? '#8e98b8' : '#fff' }}>{qq.t}</Text>
                        <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: st === 'done' ? palette.green : palette.gold }}>
                          {st === 'done' ? 'DONE  ' : ''}{qq.xp} XP  -  {qq.orbs} ORBS{big ? '  -  MILESTONE' : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

/** Home-screen icon packs, one per season. This season's pack can be bought; anything you own can be switched to. */
function IconShelf() {
  const g = useGame();
  const key = currentSeason().key;
  const worn = iconEquipped(g.profile);
  const packs = Object.entries(SEASON_APP_ICONS)
    .map(([sk, list]) => [sk, list.filter((i) => sk === key || iconOwned(g.profile, sk, i.id))] as const)
    .filter(([, list]) => list.length);
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
        THESE CHANGE THE REAL ICON ON YOUR HOME SCREEN. EACH SEASON&apos;S PACK IS ONLY FOR SALE WHILE THAT SEASON LASTS; WHAT YOU BUY IS YOURS FOREVER.
      </Text>
      {packs.map(([sk, list]) => (
        <View key={sk} style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.wht }}>{sk === key ? 'THIS SEASON' : 'YOURS FROM ' + sk}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {list.map((i) => {
              const owned = iconOwned(g.profile, sk, i.id);
              const on = worn === ownedKey(sk, i.id);
              return (
                <View key={i.id} style={{ width: '47.5%', backgroundColor: palette.panel, borderWidth: 3, borderColor: on ? palette.gold : INK, padding: 10, gap: 6, alignItems: 'center' }}>
                  <Image source={{ uri: i.thumb }} style={{ width: 76, height: 76, borderRadius: 17, borderWidth: 2, borderColor: INK }} contentFit="cover" cachePolicy="memory-disk" />
                  <Text style={{ fontFamily: fonts.display, fontSize: 17, color: '#fff', textAlign: 'center' }}>{i.name}</Text>
                  {on ? (
                    <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.green }}>ON YOUR HOME SCREEN</Text>
                  ) : owned ? (
                    <Btn small tone="gold" label="USE ICON" onPress={() => g.iconWear(ownedKey(sk, i.id))} />
                  ) : (
                    <Btn small tone="red" label={`BUY  ${i.price} ORBS`} onPress={() => { if (g.iconBuy(sk, i.id)) play('caught-rare'); else play('error'); }} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {worn ? <Btn small tone="plain" label="BACK TO THE DEFAULT ICON" onPress={() => g.iconWear(null)} /> : null}
    </View>
  );
}

function ShopView() {
  const g = useGame();
  const season = currentSeason();
  const [cat, setCat] = useState<'pins' | 'fx' | 'icons'>('pins');
  const orbs = (g.profile.orbs as number) || 0;
  const items = cat === 'icons' ? [] : (cat === 'pins' ? mapPinEntries(g.profile, season.event) : effectEntries(g.profile, season.event)).sort(
    (a, b) => (a.owned === b.owned ? 0 : a.owned ? -1 : 1) || a.price - b.price,
  );

  return (
    <>
      <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }}>YOUR ORBS</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 34, color: palette.gold }}>{orbs}</Text>
        </View>
        <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>YOU GET ORBS FROM QUESTS. WHAT YOU BUY IS YOURS FOREVER.</Text>
      </Panel>
      <View style={{ flexDirection: 'row' }}>
        <Chip label="MAP PINS" on={cat === 'pins'} onPress={() => setCat('pins')} />
        <Chip label="CATCH EFFECTS" on={cat === 'fx'} onPress={() => setCat('fx')} />
        <Chip label="APP ICONS" on={cat === 'icons'} onPress={() => setCat('icons')} />
      </View>
      {cat === 'icons' ? <IconShelf /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((e) => (
          <View key={e.track + e.id} style={{ width: '47.5%', backgroundColor: palette.panel, borderWidth: 3, borderColor: e.equipped ? palette.gold : INK, padding: 10, gap: 6, alignItems: 'center' }}>
            <View style={{ height: 64, justifyContent: 'center' }}>
              {e.track === 'mappin' ? <PinArt id={e.id} rarity="legendary" color="#C9A227" size={60} /> : <ShopIcon id={e.id} size={60} />}
            </View>
            {e.season ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: INK, backgroundColor: e.season === 'fall' ? '#E0863A' : e.season === 'summer' ? '#F2D36B' : '#9FC3E0', paddingHorizontal: 5, paddingVertical: 2 }}>{e.season.toUpperCase()} ONLY</Text> : <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8, color: palette.lcdDim }}>ALWAYS AVAILABLE</Text>}
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: '#fff', textAlign: 'center' }}>{e.name}</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim, textAlign: 'center' }} numberOfLines={3}>{e.desc}</Text>
            {e.equipped ? (
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.green }}>WEARING IT</Text>
            ) : e.owned ? (
              <Btn small tone="gold" label="WEAR IT" onPress={() => { play('click'); g.shopEquip(e.track, e.id); }} />
            ) : (
              <Btn small tone="red" label={`BUY  ${e.price} ORBS`} onPress={() => { if (g.shopBuy(e.track, e.id)) play('caught-rare'); else play('error'); }} />
            )}
          </View>
        ))}
      </View>
    </>
  );
}

export default function Season() {
  const t = useTheme();
  const g = useGame();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [seg, setSeg] = useState<'quests' | 'shop'>(tab === 'shop' ? 'shop' : 'quests');
  const season = currentSeason();
  const [now] = useState(() => Date.now());
  const daysLeft = Math.max(1, Math.ceil((season.end - now) / 864e5));
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <SeasonGlyph season={season.event} size={44} />
            <PText style={{ fontSize: 40, lineHeight: 42, color: t.red, flexShrink: 1 }}>{SEASON_EVENT_NAMES[season.event]}</PText>
          </View>
          <PText style={{ color: t.muted, fontSize: 15 }}>{season.name}  -  {daysLeft} DAYS LEFT  -  {(g.profile.orbs as number) || 0} ORBS</PText>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="QUESTS" on={seg === 'quests'} onPress={() => { play('tab'); setSeg('quests'); }} />
          <Chip label="SHOP" on={seg === 'shop'} onPress={() => { play('tab'); setSeg('shop'); }} />
        </View>
        {seg === 'quests' ? <QuestsView /> : <ShopView />}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
