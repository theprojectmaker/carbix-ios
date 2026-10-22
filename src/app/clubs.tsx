import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText } from '@/components/ui';
import { clubGet, clubPost, fetchLeaderboard } from '@/engine/api';
import { currentSeason } from '@/engine/quests';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
type Row = { name?: string; seasonXp?: number; seasonKey?: string; clubCode?: string; clubName?: string };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>{title}</Text>
      {children}
    </View>
  );
}

/** Clubs: teams of up to 20 spotters racing on combined season XP. */
/** The clubs UI, usable as a screen or as a section of the leaderboard. */
export function ClubsView({ embedded }: { embedded?: boolean }) {
  const t = useTheme();
  const g = useGame();
  const club = g.profile.club as { code: string; name: string } | undefined;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const r = (await fetchLeaderboard()) as Row[];
    setRows(r);
    if (club?.code) {
      const j = await clubGet(club.code);
      if (j.ok && j.club) setMembers((j.club.members as unknown[]).map((m) => (typeof m === 'string' ? m : (m as { name: string }).name)));
    }
  };

  useEffect(() => {
    let live = true;
    (async () => {
      const r = (await fetchLeaderboard()) as Row[];
      if (!live) return;
      setRows(r);
      if (club?.code) {
        const j = await clubGet(club.code);
        if (live && j.ok && j.club) setMembers((j.club.members as unknown[]).map((m) => (typeof m === 'string' ? m : (m as { name: string }).name)));
      }
    })();
    return () => { live = false; };
  }, [club?.code]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const j = await clubPost(g.profile.token, g.profile.name, { action: 'create', clubName: name.trim() });
    if (j.ok && j.club) {
      g.patchProfile((p) => ({ ...p, club: { code: j.club!.code, name: j.club!.name } }));
      setNote('');
    } else setNote(String(j.error || 'COULD NOT MAKE THE CLUB.').toUpperCase());
    setBusy(false);
  }
  async function join() {
    if (code.trim().length < 4) return;
    setBusy(true);
    const j = await clubPost(g.profile.token, g.profile.name, { action: 'join', code: code.trim().toUpperCase() });
    if (j.ok && j.club) {
      g.patchProfile((p) => ({ ...p, club: { code: j.club!.code, name: j.club!.name } }));
      setNote('');
    } else setNote(String(j.error || 'COULD NOT JOIN.').toUpperCase());
    setBusy(false);
  }
  async function leave() {
    if (!club) return;
    setBusy(true);
    await clubPost(g.profile.token, g.profile.name, { action: 'leave', code: club.code });
    g.patchProfile((p) => {
      const n = { ...p };
      delete n.club;
      return n;
    });
    setMembers([]);
    setBusy(false);
  }

  // standings: group the public rows by club tag, summing this season's XP
  const sk = currentSeason().key;
  const board = Object.values(
    rows.reduce<Record<string, { code: string; name: string; xp: number; n: number }>>((acc, r) => {
      if (!r.clubCode) return acc;
      const b = (acc[r.clubCode] = acc[r.clubCode] || { code: r.clubCode, name: r.clubName || r.clubCode, xp: 0, n: 0 });
      b.n++;
      if (r.seasonKey === sk) b.xp += r.seasonXp || 0;
      return acc;
    }, {}),
  ).sort((a, b) => b.xp - a.xp).slice(0, 25);

  return (
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {embedded ? null : <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>CLUBS</PText>}

        {club ? (
          <Panel title={club.name}>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
              YOUR CLUB. INVITE CODE <Text style={{ fontFamily: fonts.utilityBold, color: palette.wht, letterSpacing: 2 }}>{club.code}</Text>. UP TO 20 SPOTTERS. COMBINED SEASON XP COUNTS ON THE BOARD.
            </Text>
            {members.map((m) => <Text key={m} style={{ fontFamily: fonts.display, fontSize: 17, color: palette.wht }}>{m}</Text>)}
            <Btn small tone="plain" label="LEAVE CLUB" disabled={busy} onPress={leave} />
          </Panel>
        ) : (
          <>
            <Panel title="START A CLUB">
              <TextInput value={name} onChangeText={setName} placeholder="Club name" placeholderTextColor="#7f8ca6" maxLength={18}
                style={{ backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK, color: '#fff', fontFamily: fonts.display, fontSize: 22, paddingHorizontal: 12, paddingVertical: 10 }} />
              <Btn tone="red" label="CREATE CLUB" disabled={busy || !name.trim()} onPress={create} />
            </Panel>
            <Panel title="JOIN WITH A CODE">
              <TextInput value={code} onChangeText={(x) => setCode(x.toUpperCase())} placeholder="CODE" placeholderTextColor="#7f8ca6" autoCapitalize="characters" maxLength={6}
                style={{ backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK, color: '#fff', fontFamily: fonts.display, fontSize: 24, paddingHorizontal: 12, paddingVertical: 10, letterSpacing: 4 }} />
              <Btn tone="navy" label="JOIN CLUB" disabled={busy || code.length < 4} onPress={join} />
            </Panel>
          </>
        )}
        {note ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.red }}>{note}</Text> : null}

        <Panel title="CLUBS BOARD">
          {board.length === 0 ? (
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>NO CLUBS ON THE BOARD YET.</Text>
          ) : (
            board.map((b, i) => (
              <View key={b.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: i < 3 ? palette.gold : palette.wht, width: 30 }}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 19, color: b.code === club?.code ? palette.gold : palette.wht }}>{b.name}</Text>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: palette.lcdDim }}>{b.n} SPOTTER{b.n === 1 ? '' : 'S'}</Text>
                </View>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.gold }}>{b.xp.toLocaleString()}</Text>
              </View>
            ))
          )}
          <Btn small tone="plain" label="REFRESH" onPress={load} />
        </Panel>
        {embedded ? null : <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />}
      </ScrollView>
  );
}

export default function Clubs() {
  return (
    <Screen edges={['top', 'bottom']}>
      <ClubsView />
    </Screen>
  );
}
