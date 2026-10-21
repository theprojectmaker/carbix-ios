import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText } from '@/components/ui';
import { friendAction, friendsGet, type FriendState } from '@/engine/api';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>{title}</Text>
      {children}
    </View>
  );
}

/** Friends: send a request, accept or decline, and open a duel against anyone on your list. */
export default function Friends() {
  const t = useTheme();
  const g = useGame();
  const [state, setState] = useState<FriendState | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await friendsGet(g.profile.token);
    setState(s);
  }, [g.profile.token]);

  useEffect(() => {
    let live = true;
    friendsGet(g.profile.token).then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, [g.profile.token]);

  async function send() {
    if (!name.trim()) return;
    setBusy(true);
    setNote('SENDING...');
    const j = await friendAction(g.profile.token, g.profile.name, { action: 'request', target: name.trim() });
    setNote(
      j.becameFriends ? `YOU AND ${j.name} ARE NOW FRIENDS.` : j.ok ? `REQUEST SENT TO ${j.name}. WAITING FOR THEM TO ACCEPT.` : String(j.error || "COULDN'T SEND THAT.").toUpperCase(),
    );
    if (j.ok) setName('');
    setBusy(false);
    load();
  }

  async function act(action: string, extra: Record<string, unknown>) {
    play('click');
    setBusy(true);
    await friendAction(g.profile.token, g.profile.name, { action, ...extra });
    setBusy(false);
    load();
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>FRIENDS</PText>

        <Panel title="ADD A FRIEND">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="@name"
            placeholderTextColor="#7f8ca6"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            style={{ backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK, color: '#fff', fontFamily: fonts.display, fontSize: 22, paddingHorizontal: 12, paddingVertical: 10 }}
          />
          <Btn tone="red" label="SEND REQUEST" disabled={busy || !name.trim()} onPress={send} />
          {note ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9.5, color: palette.gold }}>{note}</Text> : null}
          <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>THEY HAVE TO ACCEPT BEFORE YOU ARE FRIENDS.</Text>
        </Panel>

        {state && state.incoming.length ? (
          <Panel title="REQUESTS">
            {state.incoming.map((r) => (
              <View key={r.name} style={{ gap: 6, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht }}>{r.name} wants to be your friend</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn small style={{ flex: 1 }} tone="red" label="ACCEPT" onPress={() => act('accept', { from: r.name })} />
                  <Btn small style={{ flex: 1 }} tone="plain" label="DECLINE" onPress={() => act('decline', { from: r.name })} />
                </View>
              </View>
            ))}
          </Panel>
        ) : null}

        <Panel title="YOUR FRIENDS">
          {!state ? (
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>LOADING...</Text>
          ) : state.friends.length === 0 ? (
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>NO FRIENDS YET. ADD SOMEONE ABOVE.</Text>
          ) : (
            state.friends.map((f) => (
              <View key={f} style={{ gap: 6, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 21, color: palette.wht }}>{f}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn small style={{ flex: 1 }} tone="navy" label="PROFILE" onPress={() => router.push({ pathname: '/profile/[name]', params: { name: f } })} />
                  <Btn small style={{ flex: 1 }} tone="gold" label="BIX DUEL" onPress={() => router.push({ pathname: '/duel/[name]', params: { name: f } })} />
                  <Btn small style={{ flex: 1 }} tone="plain" label="REMOVE" onPress={() => act('remove', { friend: f })} />
                </View>
              </View>
            ))
          )}
          {state && state.outgoing.length ? (
            <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>WAITING ON: {state.outgoing.join(', ')}</Text>
          ) : null}
        </Panel>

        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
