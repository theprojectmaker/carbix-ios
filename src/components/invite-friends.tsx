import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Btn } from '@/components/ui';
import { friendsGet } from '@/engine/api';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts, palette } from '@/theme/theme';

const INK = '#141C27';
const box = { backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 } as const;
const head = { fontFamily: fonts.display, fontSize: 22, color: palette.wht } as const;

const ago = (ts: number) => {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m} MIN AGO` : `${Math.round(m / 60)} H AGO`;
};

/** Races friends have invited you to. Joining drops you into the lobby; declining clears the dot. */
export function InvitesPanel() {
  const r = useRace();
  if (!r.invites.length) return null;
  return (
    <View style={[box, { borderColor: palette.gold }]}>
      <Text style={head}><Text style={{ color: palette.red }}>» </Text>RACE INVITES</Text>
      {r.invites.map((i) => (
        <View key={i.from + i.code} style={{ gap: 6, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht }}>{i.from} invited you to a race</Text>
          <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>CODE {i.code} · {ago(i.ts)}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small style={{ flex: 1 }} tone="red" label="JOIN" disabled={r.busy || !!r.code}
              onPress={async () => { await r.join(i.code); r.dismissInvite(i.code); }} />
            <Btn small style={{ flex: 1 }} tone="plain" label="NO THANKS" onPress={() => { play('click'); r.dismissInvite(i.code); }} />
          </View>
        </View>
      ))}
      {r.code ? <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>LEAVE YOUR CURRENT RACE TO JOIN ANOTHER.</Text> : null}
    </View>
  );
}

/** Your friends with an INVITE key each; the invite shows up as a dot on their race key. */
export function InviteFriendsPanel() {
  const g = useGame();
  const r = useRace();
  const [friends, setFriends] = useState<string[] | null>(null);
  const [sent, setSent] = useState<Record<string, 'sent' | 'fail'>>({});

  useEffect(() => {
    let live = true;
    friendsGet(g.profile.token).then((s) => { if (live) setFriends(s?.friends ?? []); });
    return () => { live = false; };
  }, [g.profile.token]);

  async function invite(f: string) {
    play('click');
    const ok = await r.inviteFriend(f);
    setSent((m) => ({ ...m, [f]: ok ? 'sent' : 'fail' }));
  }

  return (
    <View style={box}>
      <Text style={head}><Text style={{ color: palette.red }}>» </Text>INVITE FRIENDS</Text>
      {friends === null ? (
        <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>LOADING...</Text>
      ) : friends.length === 0 ? (
        <>
          <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>NO FRIENDS YET. ADD SOME AND THEY CAN BE INVITED.</Text>
          <Btn small tone="navy" label="ADD FRIENDS" onPress={() => router.push('/friends')} />
        </>
      ) : (
        friends.map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 6 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht, flex: 1 }} numberOfLines={1}>{f}</Text>
            <Btn small tone={sent[f] === 'sent' ? 'plain' : 'red'} label={sent[f] === 'sent' ? 'INVITED' : sent[f] === 'fail' ? 'TRY AGAIN' : 'INVITE'}
              disabled={sent[f] === 'sent'} onPress={() => invite(f)} />
          </View>
        ))
      )}
    </View>
  );
}
