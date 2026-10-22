import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText } from '@/components/ui';
import { clearInbox, markAllRead, useInbox, type Notice, type NoticeKind } from '@/lib/inbox';
import { play } from '@/lib/sfx';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const KIND: Record<NoticeKind, { label: string; color: string }> = {
  race: { label: 'RACE', color: palette.red },
  friend: { label: 'FRIEND', color: '#5C7AA0' },
  level: { label: 'LEVEL UP', color: palette.gold },
  quest: { label: 'QUEST', color: palette.green },
  trophy: { label: 'TROPHY', color: palette.gold },
  feed: { label: 'FEED', color: '#8C6FB5' },
  daily: { label: 'DAILY', color: '#E0863A' },
  info: { label: 'INFO', color: '#7f8ca6' },
};

const when = (ts: number) => {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return `${m} MIN AGO`;
  if (m < 1440) return `${Math.round(m / 60)} H AGO`;
  const d = Math.round(m / 1440);
  return d === 1 ? 'YESTERDAY' : `${d} DAYS AGO`;
};

const dayOf = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'TODAY';
  if (d.toDateString() === y.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
};

/** Everything that happened: invites, requests, level-ups, quests, trophies, reactions. Tap one to go there. */
export default function Notifications() {
  const t = useTheme();
  const { items, unread } = useInbox();

  // opening the inbox is what marks it read, once the list has been seen
  useEffect(() => {
    const id = setTimeout(markAllRead, 1200);
    return () => clearTimeout(id);
  }, []);

  const groups: { day: string; list: Notice[] }[] = [];
  for (const n of items) {
    const day = dayOf(n.ts);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.list.push(n);
    else groups.push({ day, list: [n] });
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>INBOX</PText>
          {unread ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: t.muted, paddingBottom: 8 }}>{unread} NEW</Text> : null}
        </View>

        {items.length === 0 ? (
          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, gap: 8 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}>NOTHING YET</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim, lineHeight: 14 }}>
              RACE INVITES, FRIEND REQUESTS, LEVEL-UPS, FINISHED QUESTS, TROPHIES AND REACTIONS ON YOUR CATCHES ALL LAND HERE.
            </Text>
          </View>
        ) : (
          groups.map((grp) => (
            <View key={grp.day} style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: t.muted, letterSpacing: 1.5 }}>{grp.day}</Text>
              {grp.list.map((n) => {
                const k = KIND[n.kind] ?? KIND.info;
                const inner = (
                  <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: n.read ? INK : k.color, borderLeftWidth: 10, borderLeftColor: k.color, padding: 10, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.utilityBold, fontSize: 8.5, color: k.color, letterSpacing: 1.5 }}>{k.label}</Text>
                      <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: palette.lcdDim }}>{when(n.ts)}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht }}>{n.title}</Text>
                    {n.body ? <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim, lineHeight: 14 }}>{n.body}</Text> : null}
                    {n.route ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.red }}>OPEN ›</Text> : null}
                  </View>
                );
                return n.route ? (
                  <Pressable key={n.id} onPress={() => { play('tab'); router.push(n.route as never); }} accessibilityRole="button" accessibilityLabel={n.title}>
                    {inner}
                  </Pressable>
                ) : (
                  <View key={n.id}>{inner}</View>
                );
              })}
            </View>
          ))
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {items.length ? <Btn small style={{ flex: 1 }} tone="plain" label="CLEAR ALL" onPress={() => { play('click'); clearInbox(); }} /> : null}
          <Btn small style={{ flex: 1 }} tone="navy" label="CLOSE" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
