import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText } from '@/components/ui';
import { redeemLinkCode } from '@/engine/api';

import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

type Outcome = { ok: true } | { ok: false; error: string };
/** A code is single-use, and the deep link can mount this screen twice; every mount shares one attempt per code. */
const attempts = new Map<string, Promise<Outcome>>();

/** carbix://signed-in?code=XXXXXX — where the website's Google sign-in hands you back to the app. */
export default function SignedIn() {
  const t = useTheme();
  const g = useGame();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [msg, setMsg] = useState('SIGNING YOU IN...');
  const [bad, setBad] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!code) { setBad(true); setMsg('NO SIGN-IN CODE CAME BACK. TRY AGAIN.'); return; }
      const key = String(code);
      let p = attempts.get(key);
      if (!p) {
        p = (async (): Promise<Outcome> => {
          const r = await redeemLinkCode(key);
          if (!r.ok) return { ok: false, error: r.error.toUpperCase() };
          const res = await g.linkAccount(r.token);
          return res.ok ? { ok: true } : { ok: false, error: 'SIGNED IN, BUT THE GARAGE DID NOT DOWNLOAD. TRY AGAIN.' };
        })();
        attempts.set(key, p);
      }
      const out = await p;
      if (!live) return;
      if (!out.ok) { attempts.delete(key); setBad(true); setMsg(out.error); return; }
      g.patchProfile((p) => ({ ...p, onboarded: true, googleLinked: true, termsAccepted: p.termsAccepted || new Date().toISOString() }));
      play('levelup');
      router.replace('/');
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <Screen edges={[]}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>GOOGLE</PText>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: bad ? palette.red : palette.gold }}>{msg}</Text>
        {bad ? <Btn tone="red" label="BACK" onPress={() => router.replace('/')} /> : null}
      </View>
    </Screen>
  );
}
