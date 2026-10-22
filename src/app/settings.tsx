import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, Chip, PText } from '@/components/ui';
import { redeemLinkCode } from '@/engine/api';
import { TITLES } from '@/engine/extras';
import { dateKeyET, KEYS, normalizeProfile, parseBackup } from '@/engine/store';
import { blockedList, reportUser, withUnblocked } from '@/lib/moderation';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

export const PRIVACY_URL = 'https://motordex.pages.dev/privacy.html';
const INK = '#141C27';
const VOLUMES: [string, number][] = [['OFF', 0], ['LOW', 0.5], ['NORMAL', 1], ['LOUD', 1.6]];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 12, gap: 10 }}>
      <View>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>{title}</Text>
        {hint ? <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: palette.red, false: '#3a4660' }} />
    </View>
  );
}

const input = {
  backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK, color: '#fff',
  fontFamily: fonts.display, fontSize: 22, paddingHorizontal: 12, paddingVertical: 10,
} as const;

/** Settings, grouped by what they do: you, camera, sound, look, account and backup, safety, about. */
export default function Settings() {
  const t = useTheme();
  const g = useGame();
  const [name, setName] = useState(g.profile.username);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');

  async function link() {
    if (!code.trim()) return;
    setStatus('CHECKING...');
    const r = await redeemLinkCode(code);
    if (!r.ok) return setStatus(r.error.toUpperCase());
    setStatus('LINKED. PULLING YOUR GARAGE...');
    const res = await g.linkAccount(r.token);
    setStatus(res.ok ? `LINKED. ${res.added} CAR${res.added === 1 ? '' : 'S'} RESTORED.` : 'LINKED, BUT NOTHING DOWNLOADED YET. TRY AGAIN.');
    setCode('');
  }

  async function exportBackup() {
    try {
      const data = { when: new Date().toISOString(), app: 'motordex', profile: g.profile, garage: g.garage };
      const f = new File(Paths.cache, `carbix-backup-${dateKeyET()}.json`);
      if (f.exists) f.delete();
      f.create();
      f.write(JSON.stringify(data));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Carbix backup' });
      else setStatus('SHARING IS NOT AVAILABLE ON THIS DEVICE.');
    } catch {
      setStatus('BACKUP FAILED.');
    }
  }

  async function importBackup() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const text = await new File(r.assets[0].uri).text();
      const b = parseBackup(text);
      if (!b) return setStatus("THAT FILE ISN'T A CARBIX BACKUP.");
      Alert.alert('Restore this backup?', `${b.garage.length} cars will replace what is on this phone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: () => { g.restore(b.garage, b.profile); setStatus(`RESTORED ${b.garage.length} CARS.`); } },
      ]);
    } catch {
      setStatus('COULD NOT READ THAT FILE.');
    }
  }

  function wipe() {
    Alert.alert('Delete everything?', 'This erases your garage and profile from this phone. A linked cloud save is not touched.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove([KEYS.garage, KEYS.profile, KEYS.notifications]);
          g.restore([], normalizeProfile(null));
          setStatus('ALL LOCAL DATA DELETED.');
        },
      },
    ]);
  }

  const unlocked = TITLES.filter((tt) => tt.ok(g.garage, g.profile));
  const blocked = blockedList(g.profile);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>SETTINGS</PText>

        <Section title="YOU" hint="THIS NAME SHOWS ON THE FEED AND LEADERBOARD.">
          <TextInput value={name} onChangeText={setName} autoCapitalize="none" autoCorrect={false} maxLength={16} style={input} />
          <Btn small label="SAVE NAME" onPress={() => { g.setUsername(name); setStatus('NAME SAVED.'); }} />
          <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>
            TITLE: {String(g.profile.title || 'NONE').toUpperCase()}  -  {unlocked.length} OF {TITLES.length} UNLOCKED
          </Text>
          <Btn small tone="gold" label="CHOOSE A TITLE" onPress={() => router.push('/trophies')} />
        </Section>

        <Section title="CAMERA">
          <Toggle label="COOL MODE" sub="SMALLER PHOTOS AND NO BACKGROUND WORK, SO THE PHONE STAYS COOL." value={g.settings.cool} onChange={(v) => g.setSettings({ cool: v })} />
          <Toggle label="HAPTICS" sub="A BUZZ WHEN YOU CATCH A CAR." value={g.settings.haptics} onChange={(v) => g.setSettings({ haptics: v })} />
          <Toggle label="CALL YOUR SHOT" sub="GUESS THE BRAND BEFORE EACH SCAN, JUST FOR A STREAK." value={g.settings.callshot} onChange={(v) => g.setSettings({ callshot: v })} />
        </Section>

        <Section title="SOUND" hint={g.settings.silentMute !== false ? "THE SILENT SWITCH MUTES GAME SOUNDS." : "PLAYS EVEN WITH THE SILENT SWITCH ON."}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {VOLUMES.map(([label, v]) => (
              <Chip key={label} label={label} on={g.settings.sfx === v} onPress={() => { g.setSettings({ sfx: v }); setTimeout(() => play('caught-rare'), 120); }} />
            ))}
          </View>
          <Toggle label="MUTE WITH SILENT SWITCH" sub="WHEN YOUR PHONE IS ON SILENT, GAME SOUNDS STAY QUIET TOO." value={g.settings.silentMute !== false} onChange={(v) => g.setSettings({ silentMute: v })} />
          <Btn small tone="navy" label="TEST SOUND" onPress={() => play('levelup')} />
        </Section>

        <Section title="LOOK">
          <Toggle label="DARK MODE" sub="THE CASING AROUND THE GAME. THE GAME ITSELF KEEPS ITS COLOURS." value={g.settings.theme === 'dark'} onChange={(v) => g.setSettings({ theme: v ? 'dark' : 'light' })} />
        </Section>

        <Section title="ACCOUNT AND BACKUP" hint="MOVE YOUR GARAGE BETWEEN PHONES, OR KEEP A COPY.">
          <Btn tone="red" label={g.profile.googleLinked ? 'SIGN IN WITH GOOGLE AGAIN' : 'SIGN IN WITH GOOGLE'} onPress={async () => { setStatus('OPENING GOOGLE...'); const r = await g.googleSignIn(); setStatus(r.ok ? 'SIGNED IN. YOUR GARAGE IS HERE.' : (r.error ?? 'COULD NOT SIGN IN.')); }} />
          <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
            A SIGN-IN SHEET POPS UP OVER THE APP. WHEN YOU ARE DONE IT CLOSES BY ITSELF AND YOUR WHOLE GARAGE COMES WITH YOU. NO CODE NEEDED. OR TYPE A CODE FROM THE WEBSITE (SETTINGS, ACCOUNT, LINK A DEVICE):
          </Text>
          <TextInput value={code} onChangeText={(s) => setCode(s.toUpperCase())} placeholder="ABC123" placeholderTextColor="#7f8ca6" autoCapitalize="characters" autoCorrect={false} maxLength={8} style={{ ...input, letterSpacing: 4 }} />
          <Btn small tone="red" label="USE CODE" onPress={link} />
          {g.syncState ? <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>CLOUD: {g.syncState}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small style={{ flex: 1 }} tone="plain" label="EXPORT" onPress={exportBackup} />
            <Btn small style={{ flex: 1 }} tone="plain" label="RESTORE" onPress={importBackup} />
          </View>
        </Section>

        <Section title="SAFETY" hint="HIDE SPOTTERS YOU DON'T WANT TO SEE. YOU CAN'T BLOCK YOURSELF.">
          {blocked.length === 0 ? (
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>NOBODY BLOCKED. USE BLOCK OR REPORT UNDER ANY NAME IN THE FEED OR LEADERBOARD.</Text>
          ) : (
            blocked.map((n) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht }}>@{n}</Text>
                <Btn small tone="plain" label="UNBLOCK" onPress={() => g.patchProfile((p) => withUnblocked(p, n))} />
              </View>
            ))
          )}
          <Btn small tone="plain" label="REPORT A PROBLEM" onPress={() => reportUser('a spotter or post', 'general report')} />
        </Section>

        <Section title="ABOUT">
          <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
            CARBIX {version}  -  LICENCE {g.profile.lic.replace(/^MDX-/, 'CBX-')}
          </Text>
          <Btn small tone="plain" label="PRIVACY POLICY" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} />
          <Btn small tone="red" label="DELETE ALL LOCAL DATA" onPress={wipe} />
        </Section>

        {status ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: t.red }}>{status}</Text> : null}
        <Btn tone="plain" label="CLOSE" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
