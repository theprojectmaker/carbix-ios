import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BellIcon, RaceIcon } from '@/components/pixel-icons';
import { Screen } from '@/components/screen';
import { Btn, PText } from '@/components/ui';
import { askNotify, registerPush } from '@/lib/notify';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';

function Row({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10 }}>
    <View style={{ width: 44, height: 44, backgroundColor: '#161c2c', borderWidth: 2, borderColor: '#10141f', alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 19, color: palette.wht }}>{title}</Text>
      <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: palette.lcdDim, lineHeight: 14 }}>{body}</Text>
    </View>
  </View>
  );
}

/** Asked once, before the system prompt, so the prompt is not a surprise. */
export default function NotifyAsk() {
  const t = useTheme();
  const g = useGame();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  function done(asked: boolean) {
    g.patchProfile((p) => ({ ...p, askedNotify: true, notifyOn: asked }));
    router.back();
  }

  async function turnOn() {
    setBusy(true);
    play('click');
    const ok = await askNotify();
    if (ok) {
      registerPush(g.profile.token, g.settings.notify).catch(() => {});
      g.replanNotifications();
      play('levelup');
    }
    setBusy(false);
    done(ok);
  }

  return (
    <Screen edges={[]}>
      <View style={{ flex: 1, padding: 18, paddingTop: (insets.top || 50) + 16, paddingBottom: (insets.bottom || 18) + 12, gap: 16, justifyContent: 'center' }}>
        <PText style={{ fontSize: 40, lineHeight: 42, color: t.red }}>STAY IN THE GAME</PText>
        <View style={{ backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 14, gap: 10 }}>
          <Row icon={<BellIcon size={28} />} title="A DAILY NUDGE" body="ONE REMINDER A DAY WITH THE CAR OF THE DAY. YOU PICK THE TIME IN SETTINGS." />
          <Row icon={<Text style={{ fontFamily: fonts.display, fontSize: 22, color: palette.gold }}>7</Text>} title="STREAK WARNINGS" body="A HEADS-UP IN THE EVENING WHEN YOUR STREAK IS ABOUT TO END." />
          <Row icon={<RaceIcon size={28} />} title="FRIENDS' BIG CATCHES" body="WHEN A FRIEND BAGS SOMETHING RARE OR BETTER." />
          <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim, lineHeight: 13, paddingTop: 4 }}>
            NEVER MORE THAN A FEW A DAY. EVERY ONE CAN BE TURNED OFF IN SETTINGS.
          </Text>
        </View>
        <Btn tone="red" label={busy ? 'ONE MOMENT...' : 'TURN ON NOTIFICATIONS'} disabled={busy} onPress={turnOn} />
        <Btn tone="plain" label="NOT NOW" onPress={() => { play('click'); done(false); }} />
      </View>
    </Screen>
  );
}
