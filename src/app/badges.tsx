import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Screen } from '@/components/screen';
import { Btn, Chip, PText } from '@/components/ui';
import icons from '@/data/badgeIcons.json';
import { badgeList, type Badge } from '@/engine/badges';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const ICONS = icons as unknown as Record<string, [number, number, number, number, string][]>;

export function BadgeIcon({ cat, size = 30, dim }: { cat: string; size?: number; dim?: boolean }) {
  const rects = ICONS[cat] ?? ICONS.SPECIAL;
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" opacity={dim ? 0.28 : 1}>
      {rects.map(([x, y, w, h, c], i) => <Rect key={i} x={x} y={y} width={w} height={h} fill={dim ? '#8a92a8' : c} />)}
    </Svg>
  );
}

/** Every badge, grouped by what it is for. Earned ones are lit, the rest show how far you are. */
export default function Badges() {
  const t = useTheme();
  const g = useGame();
  const [cat, setCat] = useState('ALL');
  const [showEarned, setShowEarned] = useState<'all' | 'earned' | 'todo'>('all');
  const list = useMemo(() => badgeList(g.garage, g.profile), [g.garage, g.profile]);
  const cats = useMemo(() => ['ALL', ...Array.from(new Set(list.map((b) => b.cat)))], [list]);
  const earned = list.filter((b) => b.ok).length;

  const shown = list.filter((b) => (cat === 'ALL' || b.cat === cat) && (showEarned === 'all' || (showEarned === 'earned' ? b.ok : !b.ok)));
  // next rung of each ladder first when browsing what is left
  const rows: Badge[] = showEarned === 'todo' ? [...shown].sort((a, b) => b.prog - a.prog) : shown;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>BADGES</PText>
        <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 6 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, color: palette.gold }}>{earned} OF {list.length} EARNED</Text>
          <View style={{ height: 12, borderWidth: 2, borderColor: INK, backgroundColor: '#222c3d' }}>
            <View style={{ flex: 1, width: `${(earned / list.length) * 100}%`, backgroundColor: palette.gold }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="ALL" on={showEarned === 'all'} onPress={() => setShowEarned('all')} />
          <Chip label="EARNED" on={showEarned === 'earned'} onPress={() => setShowEarned('earned')} />
          <Chip label="TO GO" on={showEarned === 'todo'} onPress={() => setShowEarned('todo')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {cats.map((c) => <Chip key={c} label={c} on={cat === c} onPress={() => { play('click'); setCat(c); }} />)}
        </ScrollView>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {rows.slice(0, 160).map((b, i) => (
            <View key={b.nm + i} style={{ width: '48.5%', backgroundColor: b.ok ? '#1b2436' : palette.panel, borderWidth: 3, borderColor: b.ok ? palette.gold : INK, padding: 8, gap: 5 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <BadgeIcon cat={b.cat} dim={!b.ok} />
                <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.display, fontSize: 16, lineHeight: 17, color: b.ok ? '#fff' : '#8e98b8' }}>{b.nm}</Text>
              </View>
              <Text numberOfLines={2} style={{ fontFamily: fonts.utility, fontSize: 8.5, color: palette.lcdDim }}>{b.desc.toUpperCase()}</Text>
              {b.ok ? (
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: palette.green }}>EARNED</Text>
              ) : (
                <View style={{ height: 8, backgroundColor: '#222c3d' }}>
                  <View style={{ flex: 1, width: `${Math.max(2, b.prog * 100)}%`, backgroundColor: '#5C7AA0' }} />
                </View>
              )}
            </View>
          ))}
        </View>
        {rows.length > 160 ? <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: t.muted, textAlign: 'center' }}>SHOWING 160 OF {rows.length}. PICK A CATEGORY TO SEE THE REST.</Text> : null}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
