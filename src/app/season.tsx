import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { PinArt } from '@/components/map-pin';
import { SeasonGlyph, ShopIcon } from '@/components/shop-icons';
import { Btn, Chip, Sprite } from '@/components/ui';
import { catalogMatch } from '@/engine/data';
import type { Catch } from '@/engine/types';
import { CHAPTER_REWARDS, chaptersFor, currentSeason, daysUntilNext, SEASON_EVENT_NAMES, type Quest } from '@/engine/quests';
import { SEASON_APP_ICONS, iconEquipped, iconOwned, ownedKey } from '@/engine/appicons';
import { boostEntries, effectEntries, mapPinEntries } from '@/engine/shop';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
function Panel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, borderLeftWidth: accent ? 10 : 3, borderLeftColor: accent ?? INK, padding: 12, gap: 8 }}>
      {children}
    </View>
  );
}

const SEASON_ACCENT: Record<string, string> = { fall: '#E0863A', winter: '#6FA3C8', spring: '#7CB65B', summer: '#E8C547' };

function Chipish({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color, borderWidth: 2, borderColor: INK, paddingHorizontal: 9, paddingVertical: 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: INK }}>{label}</Text>
    </View>
  );
}

const Label = ({ children, color = palette.lcdDim }: { children: string; color?: string }) => (
  <Text style={{ fontFamily: fonts.display, fontSize: 15, color, letterSpacing: 2 }}>{children}</Text>
);

/** The quest you are on: what to do, how far along, what it pays, and the cars that already count. */
function NowCard({ q, step, total, have, need, matched, accent }: { q: Quest; step: number; total: number; have: number; need: number; matched: Catch[]; accent: string }) {
  const filled = Math.min(have, need);
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK }}>
      <View style={{ backgroundColor: accent, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 3, borderBottomColor: INK }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 17, color: INK, letterSpacing: 2 }}>NEXT QUEST</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 17, color: INK }}>{step + 1} / {total}</Text>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 34, color: '#fff' }}>{q.t}</Text>
        {q.desc ? <Text style={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 20, color: '#C9D2E6' }}>{q.desc}</Text> : null}
        {q.altDesc ? <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 18, color: palette.lcdDim }}>{q.altDesc}</Text> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, height: 22, borderWidth: 3, borderColor: INK, backgroundColor: '#222c3d' }}>
            <View style={{ height: '100%', width: `${need ? (filled / need) * 100 : 0}%`, backgroundColor: filled >= need ? palette.green : accent }} />
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, color: filled >= need ? palette.green : '#fff' }}>{filled}/{need}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Label>REWARD</Label>
          <Chipish label={`${q.xp} XP`} color={palette.gold} />
          <Chipish label={`${q.orbs} ORBS`} color="#8FC9BE" />
          {q.badge ? <Chipish label="BADGE" color="#E8705F" /> : null}
        </View>

        {matched.length ? (
          <View style={{ gap: 6, borderTopWidth: 2, borderTopColor: '#26324a', paddingTop: 10 }}>
            <Label>COUNTED SO FAR</Label>
            {matched.slice(0, 4).map((c) => {
              const e = catalogMatch(c.car);
              return (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 64, alignItems: 'center' }}>{e ? <Sprite entry={e} size={56} crisp /> : null}</View>
                  <Text style={{ fontFamily: fonts.display, fontSize: 19, color: '#fff', flex: 1 }} numberOfLines={1}>{c.car.make.toUpperCase()} {c.car.model.toUpperCase()}</Text>
                </View>
              );
            })}
            {matched.length > 4 ? <Text style={{ fontFamily: fonts.display, fontSize: 15, color: palette.lcdDim }}>AND {matched.length - 4} MORE</Text> : null}
          </View>
        ) : null}

        <Btn tone="red" label="GO SCAN A CAR" onPress={() => { play('tab'); router.back(); router.navigate('/'); }} />
        <Text style={{ fontFamily: fonts.display, fontSize: 14, color: palette.lcdDim, textAlign: 'center' }}>ONLY CARS CAUGHT AFTER THIS QUEST OPENED COUNT.</Text>
      </View>
    </View>
  );
}

function QuestsView({ accent }: { accent: string }) {
  const g = useGame();
  const season = currentSeason();
  const { quests } = g.quests();
  const step = (g.profile.questStep as number) || 0;
  const starts = (g.profile.questStarts || {}) as Record<number, number>;
  const q = quests[step];
  const prog = q ? q.test(starts[step] ?? 0) : null;
  const since = starts[step] ?? 0;
  const matched = q && q.pred ? g.garage.filter((c) => c.ts >= since && !!q.pred!(c)) : [];
  const chapters = chaptersFor(season.event);
  const [openCh, setOpenCh] = useState<Record<string, boolean>>({});
  const nextDate = new Date(season.end).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }).toUpperCase();

  return (
    <>
      {q && prog ? (
        <NowCard q={q} step={step} total={quests.length} have={prog.have} need={prog.need} matched={matched} accent={accent} />
      ) : (
        <Panel>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, color: palette.gold }}>YOU FINISHED EVERY QUEST</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: '#C9D2E6' }}>A brand new set shows up next season.</Text>
        </Panel>
      )}

      <Label color={palette.navyDk}>CHAPTERS</Label>
      {chapters.map((c, ci) => {
        const done = Math.max(0, Math.min(step, c.to + 1) - c.from);
        const total = c.to - c.from + 1;
        const here = step >= c.from && step <= c.to;
        const finished = done === total;
        const open = openCh[c.key] ?? here;
        return (
          <View key={c.key} style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: here ? c.accent : INK }}>
            <Pressable onPress={() => { play('click'); setOpenCh({ ...openCh, [c.key]: !open }); }} accessibilityRole="button" accessibilityLabel={`${c.name}, ${done} of ${total} done`}>
              <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                <View style={{ width: 50, backgroundColor: finished ? palette.green : c.accent, alignItems: 'center', justifyContent: 'center', borderRightWidth: 3, borderRightColor: INK }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 30, color: INK }}>{finished ? 'OK' : ci + 1}</Text>
                </View>
                <View style={{ flex: 1, padding: 12, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 24, color: '#fff' }}>{c.name}</Text>
                    <Text style={{ fontFamily: fonts.display, fontSize: 18, color: finished ? palette.green : palette.lcdDim }}>{done}/{total}  {open ? '-' : '+'}</Text>
                  </View>
                  <View style={{ height: 12, borderWidth: 2, borderColor: INK, backgroundColor: '#222c3d' }}>
                    <View style={{ height: '100%', width: `${(done / total) * 100}%`, backgroundColor: finished ? palette.green : c.accent }} />
                  </View>
                  {CHAPTER_REWARDS[c.key] ? (
                    <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 18, color: finished ? palette.green : '#C9D2E6' }}>{finished ? 'EARNED  ' : 'REWARD  '}{CHAPTER_REWARDS[c.key]}</Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
            {open ? (
              <View style={{ borderTopWidth: 2, borderTopColor: '#26324a' }}>
                {quests.slice(c.from, c.to + 1).map((qq, k) => {
                  const idx = c.from + k;
                  const st = idx < step ? 'done' : idx === step ? 'now' : 'locked';
                  return (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: st === 'now' ? 'rgba(201,162,39,.12)' : 'transparent', borderBottomWidth: k === c.to - c.from ? 0 : 1, borderBottomColor: '#1e2940' }}>
                      <View style={{ width: 26, height: 26, backgroundColor: st === 'done' ? palette.green : st === 'now' ? palette.gold : '#2a3550', borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: fonts.display, fontSize: 16, color: INK }}>{st === 'done' ? 'OK' : st === 'locked' ? '·' : '›'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 20, color: st === 'locked' ? '#7f8aa8' : '#fff' }} numberOfLines={2}>{qq.t}</Text>
                      </View>
                      <Text style={{ fontFamily: fonts.display, fontSize: 15, color: st === 'done' ? palette.green : palette.gold }}>{qq.xp} XP{qq.badge ? '  BADGE' : ''}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={{ borderWidth: 3, borderColor: INK, borderStyle: 'dashed', padding: 12, gap: 4 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.navyDk }}>{SEASON_EVENT_NAMES[season.next]} STARTS {nextDate}</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 18, color: palette.navyDk }}>50 new quests, new pins and effects. Orbs and everything you own carry over.</Text>
      </View>
    </>
  );
}

/** Home-screen icon packs, one per season. This season's pack can be bought; anything you own can be switched to. */
function IconShelf() {
  const g = useGame();
  const key = currentSeason().key;
  const worn = iconEquipped(g.profile);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const run = async (p: Promise<{ ok: boolean; message: string }>) => {
    setWorking(true);
    setNote('WORKING...');
    const r = await p;
    setWorking(false);
    setNote(r.message);
    play(r.ok ? 'caught-rare' : 'error');
  };
  const packs = Object.entries(SEASON_APP_ICONS)
    .map(([sk, list]) => [sk, list.filter((i) => sk === key || iconOwned(g.profile, sk, i.id))] as const)
    .filter(([, list]) => list.length);
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: palette.lcdDim }}>
        THESE CHANGE THE REAL ICON ON YOUR HOME SCREEN. EACH SEASON&apos;S PACK IS ONLY FOR SALE WHILE THAT SEASON LASTS; WHAT YOU BUY IS YOURS FOREVER.
      </Text>
      {note ? (
        <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: palette.gold, padding: 10 }}>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 15, color: palette.gold, lineHeight: 15 }}>{note}</Text>
        </View>
      ) : null}
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
                    <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: palette.green }}>ON YOUR HOME SCREEN</Text>
                  ) : owned ? (
                    <Btn small tone="gold" label="USE ICON" disabled={working} onPress={() => run(g.iconWear(ownedKey(sk, i.id)))} />
                  ) : (
                    <Btn small tone="red" label={`BUY  ${i.price} ORBS`} disabled={working} onPress={() => run(g.iconBuy(sk, i.id))} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {worn ? <Btn small tone="plain" label="BACK TO THE DEFAULT ICON" disabled={working} onPress={() => run(g.iconWear(null))} /> : null}
    </View>
  );
}

function ShopView() {
  const g = useGame();
  const season = currentSeason();
  const [cat, setCat] = useState<'pins' | 'fx' | 'icons' | 'boosts'>('pins');
  const boosts = boostEntries(g.profile);
  const SHELF_HINT = { pins: 'CHANGE THE SHAPE OF YOUR CATCH PINS ON THE MAP. PICK ONE TO WEAR; THE COLOUR STILL FOLLOWS RARITY.', fx: 'WHAT HAPPENS ON SCREEN THE MOMENT YOU CATCH A CAR.', icons: 'REAL HOME-SCREEN ICONS FOR YOUR PHONE.', boosts: 'ONE-TIME HELPERS. BUY AS MANY AS YOU WANT.' } as const;
  const orbs = (g.profile.orbs as number) || 0;
  const items = cat === 'icons' || cat === 'boosts' ? [] : (cat === 'pins' ? mapPinEntries(g.profile, season.event) : effectEntries(g.profile, season.event)).sort(
    (a, b) => (a.owned === b.owned ? 0 : a.owned ? -1 : 1) || a.price - b.price,
  );

  return (
    <>
      <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }}>YOUR ORBS</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 34, color: palette.gold }}>{orbs}</Text>
        </View>
        <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: palette.lcdDim }}>EARN ORBS BY FINISHING QUESTS. PINS, EFFECTS AND ICONS ARE YOURS FOREVER ONCE BOUGHT.</Text>
      </Panel>
      <View style={{ flexDirection: 'row' }}>
        <Chip label="MAP PINS" on={cat === 'pins'} onPress={() => setCat('pins')} />
        <Chip label="CATCH EFFECTS" on={cat === 'fx'} onPress={() => setCat('fx')} />
        <Chip label="APP ICONS" on={cat === 'icons'} onPress={() => setCat('icons')} />
        <Chip label="BOOSTS" on={cat === 'boosts'} onPress={() => setCat('boosts')} />
      </View>
      <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: palette.lcdDim, lineHeight: 14 }}>{SHELF_HINT[cat]}</Text>
      {cat === 'icons' ? <IconShelf /> : null}
      {cat === 'boosts' ? (
        <View style={{ gap: 10 }}>
          {boosts.map((b) => (
            <View key={b.id} style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }}>{b.name}</Text>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: b.count ? palette.green : palette.lcdDim }}>{b.id === 'streaksaver' ? `${b.count} READY` : b.count ? `${b.count} CATCHES LEFT` : 'NONE ACTIVE'}</Text>
              </View>
              <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: palette.lcdDim, lineHeight: 14 }}>{b.desc}</Text>
              <Btn small tone="red" label={`BUY  ${b.price} ORBS`} onPress={() => { if (g.shopBuy('boost', b.id)) play('coin'); else play('error'); }} />
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((e) => (
          <View key={e.track + e.id} style={{ width: '47.5%', backgroundColor: palette.panel, borderWidth: 3, borderColor: e.equipped ? palette.gold : INK, padding: 10, gap: 6, alignItems: 'center' }}>
            <View style={{ height: 64, justifyContent: 'center' }}>
              {e.track === 'mappin' ? <PinArt id={e.id} rarity="legendary" color="#C9A227" size={60} /> : <ShopIcon id={e.id} size={60} />}
            </View>
            {e.season ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 12, color: INK, backgroundColor: e.season === 'fall' ? '#E0863A' : e.season === 'summer' ? '#F2D36B' : e.season === 'spring' ? '#A8D86E' : '#9FC3E0', paddingHorizontal: 5, paddingVertical: 2 }}>{e.season.toUpperCase()} ONLY</Text> : <Text style={{ fontFamily: fonts.utilityBold, fontSize: 12, color: palette.lcdDim }}>ALWAYS AVAILABLE</Text>}
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: '#fff', textAlign: 'center' }}>{e.name}</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 13, color: palette.lcdDim, textAlign: 'center' }} numberOfLines={3}>{e.desc}</Text>
            {e.equipped ? (
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: palette.green }}>WEARING IT</Text>
            ) : e.owned ? (
              <Btn small tone="gold" label="WEAR IT" onPress={() => { play('click'); g.shopEquip(e.track, e.id); }} />
            ) : (
              <Btn small tone="red" label={`BUY  ${e.price} ORBS`} onPress={() => { if (g.shopBuy(e.track, e.id)) play('coin'); else play('error'); }} />
            )}
          </View>
        ))}
      </View>
    </>
  );
}

export default function Season() {
  const g = useGame();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [seg, setSeg] = useState<'quests' | 'shop'>(tab === 'shop' ? 'shop' : 'quests');
  const season = currentSeason();
  const [now] = useState(() => Date.now());
  const daysLeft = daysUntilNext(season, now);
  const accent = SEASON_ACCENT[season.event] ?? palette.gold;
  const step = (g.profile.questStep as number) || 0;
  const orbs = (g.profile.orbs as number) || 0;
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        {/* the season banner: name, days left, and your two numbers */}
        <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK }}>
          <View style={{ height: 6, backgroundColor: accent }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
            <SeasonGlyph season={season.event} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 36, lineHeight: 37, color: '#fff' }} numberOfLines={1} adjustsFontSizeToFit>{SEASON_EVENT_NAMES[season.event]}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 17, color: palette.lcdDim, letterSpacing: 1 }}>{season.name}</Text>
            </View>
            <View style={{ alignItems: 'center', minWidth: 62, backgroundColor: accent, borderWidth: 3, borderColor: INK, paddingVertical: 4, paddingHorizontal: 8 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: INK }}>{daysLeft}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 13, color: INK, letterSpacing: 1 }}>DAYS LEFT</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 2, borderTopColor: '#0b0f18' }}>
            {[['ORBS', String(orbs)], ['QUESTS DONE', `${step}/50`], [`UNTIL ${season.next.toUpperCase()}`, `${daysLeft}D`]].map(([k, v], i) => (
              <View key={k} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderLeftWidth: i ? 1 : 0, borderLeftColor: '#1d2436' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: palette.gold }}>{v}</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 13, color: '#8e98b8', letterSpacing: 1 }}>{k}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* QUESTS | SHOP */}
        <View style={{ flexDirection: 'row', borderWidth: 3, borderColor: INK }}>
          {([['quests', 'QUESTS'], ['shop', 'SHOP']] as const).map(([k, label]) => (
            <Pressable key={k} style={{ flex: 1 }} onPress={() => { play('tab'); setSeg(k); }} accessibilityRole="tab" accessibilityState={{ selected: seg === k }}>
              <View style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: seg === k ? palette.red : palette.panel }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 26, color: '#fff', letterSpacing: 2 }}>{label}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {seg === 'quests' ? <QuestsView accent={accent} /> : <ShopView />}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
