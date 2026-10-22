import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn } from '@/components/ui';
import { accountAuth, redeemLinkCode, usernameAvailable } from '@/engine/api';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const TERMS_URL = 'https://motordex.pages.dev/terms.html';
const PRIVACY_URL = 'https://motordex.pages.dev/privacy.html';
const input = {
  backgroundColor: '#2C3E58', borderWidth: 3, borderColor: INK, color: '#fff',
  fontFamily: fonts.display, fontSize: 22, paddingHorizontal: 12, paddingVertical: 10,
} as const;

/** First launch: make a username and password, agree to the terms, or log in / connect an existing account. */
export default function Welcome() {
  const t = useTheme();
  const g = useGame();
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const clean = user.trim().replace(/^@+/, '').toLowerCase();
  const nameOk = /^[a-z0-9_]{3,16}$/.test(clean);

  function done(extra?: Record<string, unknown>) {
    g.patchProfile((p) => ({ ...p, onboarded: true, termsAccepted: new Date().toISOString(), ...extra }));
    play('levelup');
    router.replace('/');
  }

  async function create() {
    setMsg('');
    if (!nameOk) return setMsg('USERNAMES ARE 3 TO 16 LETTERS, NUMBERS OR UNDERSCORES.');
    if (pass.length < 8) return setMsg('PASSWORDS NEED AT LEAST 8 CHARACTERS.');
    if (pass !== pass2) return setMsg("THE PASSWORDS DON'T MATCH.");
    if (!agree) return setMsg('PLEASE AGREE TO THE TERMS TO CONTINUE.');
    setBusy(true);
    const a = await usernameAvailable(clean);
    if (!a.ok) { setBusy(false); return setMsg((a.error || 'COULD NOT CHECK THAT NAME.').toUpperCase()); }
    if (!a.available) { setBusy(false); return setMsg('THAT USERNAME IS TAKEN.'); }
    const r = await accountAuth('register', clean, pass, g.profile.token);
    setBusy(false);
    if (!r.ok) return setMsg((r.error || 'COULD NOT MAKE THE ACCOUNT.').toUpperCase());
    g.setUsername(clean);
    setPass('');
    setPass2('');
    done({ accountUser: clean });
  }

  async function login() {
    setMsg('');
    if (!nameOk || !pass) return setMsg('TYPE YOUR USERNAME AND PASSWORD.');
    if (!agree) return setMsg('PLEASE AGREE TO THE TERMS TO CONTINUE.');
    setBusy(true);
    const r = await accountAuth('login', clean, pass, g.profile.token);
    if (!r.ok || !r.token) { setBusy(false); return setMsg((r.error || 'LOGIN FAILED.').toUpperCase()); }
    const res = await g.linkAccount(r.token);
    setBusy(false);
    setPass('');
    if (!res.ok) return setMsg('LOGGED IN, BUT YOUR GARAGE DID NOT DOWNLOAD. TRY AGAIN.');
    g.setUsername(clean);
    done({ accountUser: clean });
  }

  async function googleSignIn() {
    setMsg('');
    if (!agree) return setMsg('PLEASE AGREE TO THE TERMS TO CONTINUE.');
    setBusy(true);
    const r = await g.googleSignIn();
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? 'COULD NOT SIGN IN.');
    router.replace('/');
  }

  async function connectGoogle() {
    setMsg('');
    if (!agree) return setMsg('PLEASE AGREE TO THE TERMS TO CONTINUE.');
    if (code.trim().length < 4) return setMsg('TYPE THE CODE FROM THE WEBSITE.');
    setBusy(true);
    const r = await redeemLinkCode(code);
    if (!r.ok) { setBusy(false); return setMsg(r.error.toUpperCase()); }
    const res = await g.linkAccount(r.token);
    setBusy(false);
    if (!res.ok) return setMsg('LINKED, BUT YOUR GARAGE DID NOT DOWNLOAD. TRY AGAIN.');
    done({ googleLinked: true });
  }

  const label = { fontFamily: fonts.utilityBold, fontSize: 10, color: palette.lcdDim, letterSpacing: 1.5 } as const;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: 52, lineHeight: 54, color: t.red }}>CARBIX</Text>
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: t.muted, letterSpacing: 1.5 }}>SPOT REAL CARS. FILL YOUR BIX.</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small style={{ flex: 1 }} tone={mode === 'create' ? 'red' : 'plain'} label="NEW HERE" onPress={() => { setMode('create'); setMsg(''); }} />
            <Btn small style={{ flex: 1 }} tone={mode === 'login' ? 'red' : 'plain'} label="I HAVE AN ACCOUNT" onPress={() => { setMode('login'); setMsg(''); }} />
          </View>

          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, gap: 10 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: palette.wht }}>
              <Text style={{ color: palette.red }}>» </Text>{mode === 'create' ? 'MAKE YOUR ACCOUNT' : 'LOG IN'}
            </Text>
            <Text style={label}>USERNAME</Text>
            <TextInput value={user} onChangeText={setUser} placeholder="spotter_name" placeholderTextColor="#7f8ca6" autoCapitalize="none" autoCorrect={false} maxLength={17} style={input} textContentType="username" />
            <Text style={label}>PASSWORD</Text>
            <TextInput value={pass} onChangeText={setPass} placeholder="at least 8 characters" placeholderTextColor="#7f8ca6" secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={72} style={input} textContentType={mode === 'create' ? 'newPassword' : 'password'} />
            {mode === 'create' ? (
              <>
                <Text style={label}>REPEAT PASSWORD</Text>
                <TextInput value={pass2} onChangeText={setPass2} placeholder="same password" placeholderTextColor="#7f8ca6" secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={72} style={input} textContentType="newPassword" />
              </>
            ) : null}

            <Pressable onPress={() => { play('click'); setAgree(!agree); }} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingTop: 4 }}>
              <View style={{ width: 26, height: 26, borderWidth: 3, borderColor: INK, backgroundColor: agree ? palette.green : '#222c3d', alignItems: 'center', justifyContent: 'center' }}>
                {agree ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: INK }}>OK</Text> : null}
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.prose, fontSize: 14, color: '#C9D2E6' }}>
                I agree to the{' '}
                <Text style={{ color: palette.gold }} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>Terms of Use</Text> and the{' '}
                <Text style={{ color: palette.gold }} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>Privacy Policy</Text>.
              </Text>
            </Pressable>

            {msg ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: palette.red }}>{msg}</Text> : null}
            <Btn tone="red" label={busy ? 'ONE MOMENT...' : mode === 'create' ? 'CREATE ACCOUNT' : 'LOG IN'} disabled={busy} onPress={mode === 'create' ? create : login} />
          </View>

          <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, gap: 10 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.wht }}><Text style={{ color: palette.red }}>» </Text>CONNECT GOOGLE</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim }}>
              ALREADY PLAY WITH GOOGLE? SIGN IN AND YOUR WHOLE GARAGE, LEVEL AND NAME COME OVER. IT OPENS SAFARI AND BRINGS YOU BACK HERE BY ITSELF.
            </Text>
            <Btn tone="red" label={busy ? 'ONE MOMENT...' : 'SIGN IN WITH GOOGLE'} disabled={busy} onPress={googleSignIn} />
            <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>DID NOT COME BACK? TYPE THE CODE SAFARI SHOWED:</Text>
            {showCode ? (
              <>
                <TextInput value={code} onChangeText={(s) => setCode(s.toUpperCase())} placeholder="ABC123" placeholderTextColor="#7f8ca6" autoCapitalize="characters" autoCorrect={false} maxLength={8} style={{ ...input, letterSpacing: 4 }} />
                <Btn tone="navy" label={busy ? 'ONE MOMENT...' : 'CONNECT'} disabled={busy} onPress={connectGoogle} />
              </>
            ) : (
              <Btn tone="navy" label="I HAVE A CODE" onPress={() => setShowCode(true)} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
