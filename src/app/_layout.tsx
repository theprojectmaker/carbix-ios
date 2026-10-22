import { Jersey25_400Regular } from '@expo-google-fonts/jersey-25';
import { PixelifySans_400Regular } from '@expo-google-fonts/pixelify-sans';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { useFonts } from 'expo-font';
import { Redirect, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';

import { GameProvider, useGame } from '@/state/game';
import { loadInbox } from '@/lib/inbox';
import { preloadSfx } from '@/lib/sfx';
import { RaceProvider } from '@/state/race';
import { PText } from '@/components/ui';
import { useTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const t = useTheme();
  const { ready, toast, profile, garage } = useGame();
  const pathname = usePathname();
  const [fontsLoaded] = useFonts({
    Jersey25_400Regular, PixelifySans_400Regular, PressStart2P_400Regular, Silkscreen_400Regular, Silkscreen_700Bold,
  });
  useEffect(() => {
    if (fontsLoaded && ready) {
      SplashScreen.hideAsync().catch(() => {});
      preloadSfx();
      loadInbox();
    }
  }, [fontsLoaded, ready]);
  // Expo Go is killed by iOS well before a real app would be; hand decoded images back whenever we leave the foreground
  // and every few minutes while open, so memory cannot creep up over a long session
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') Image.clearMemoryCache().catch(() => {}); });
    const id = setInterval(() => { Image.clearMemoryCache().catch(() => {}); }, 4 * 60 * 1000);
    return () => { sub.remove(); clearInterval(id); };
  }, []);
  if (!fontsLoaded || !ready) return null;
  // first launch: sign up before anything else. People who already have a garage or a linked account skip it.
  const needsWelcome = !profile.onboarded && garage.length === 0 && !profile.googleLinked;
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="card/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="car/[n]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="caught/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="badges" options={{ presentation: 'modal' }} />
        <Stack.Screen name="friends" options={{ presentation: 'modal' }} />
        <Stack.Screen name="duel/[name]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="signed-in" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="profile/[name]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="poster" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exam" options={{ presentation: 'modal' }} />
        <Stack.Screen name="spin" options={{ presentation: 'modal' }} />
        <Stack.Screen name="trophies" options={{ presentation: 'modal' }} />
        <Stack.Screen name="clubs" options={{ presentation: 'modal' }} />
        <Stack.Screen name="post/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="season" options={{ presentation: 'modal' }} />
        <Stack.Screen name="race" options={{ presentation: 'modal' }} />
      </Stack>
      {needsWelcome && pathname !== '/signed-in' ? <Redirect href="/welcome" /> : null}
      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 54, left: 12, right: 12, backgroundColor: t.gold, borderWidth: 3, borderColor: t.panel, padding: 10 }}>
          <PText style={{ color: t.panel, fontSize: 17 }}>{toast}</PText>
        </View>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GameProvider>
        <RaceProvider>
          <Shell />
        </RaceProvider>
      </GameProvider>
    </GestureHandlerRootView>
  );
}
