import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Btn, PText } from '@/components/ui';
import { redeemLinkCode } from '@/engine/api';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

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
      const r = await redeemLinkCode(String(code));
      if (!live) return;
      if (!r.ok) { setBad(true); setMsg(r.error.toUpperCase()); return; }
      const res = await g.linkAccount(r.token);
      if (!live) return;
      if (!res.ok) { setBad(true); setMsg('SIGNED IN, BUT THE GARAGE DID NOT DOWNLOAD. TRY AGAIN.'); return; }
      g.patchProfile((p) => ({ ...p, onboarded: true, googleLinked: true, termsAccepted: p.termsAccepted || new Date().toISOString() }));
      play('levelup');
      router.replace('/');
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
        <PText style={{ fontSize: 44, lineHeight: 46, color: t.red }}>GOOGLE</PText>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: bad ? palette.red : palette.gold }}>{msg}</Text>
        {bad ? <Btn tone="red" label="BACK" onPress={() => router.replace('/')} /> : null}
      </View>
    </Screen>
  );
}
