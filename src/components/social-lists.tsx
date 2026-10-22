import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { fetchLeaderboard } from '@/engine/api';
import { levelFor, rankFor } from '@/engine/xp';
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
const openProfile = (name?: string) => { if (name) router.push({ pathname: '/profile/[name]', params: { name } }); };

const Empty = ({ text }: { text: string }) => (
  <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 30 }}>
    <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navyDk, textAlign: 'center' }}>{text}</Text>
  </View>
);

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
