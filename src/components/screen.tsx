import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';

const BG_LIGHT = require('../../assets/bg-light-v2.jpg');
const BG_DARK = require('../../assets/bg-dark-v2.jpg');

/** A screen on the app's garage wallpaper with the same tinted scrim the web app lays over it. */
export function Screen({ children, edges = ['top'], style, plain }: { children: React.ReactNode; edges?: Edge[]; style?: ViewStyle; plain?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      {plain ? null : (
        <>
          <Image source={t.dark ? BG_DARK : BG_LIGHT} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.dark ? 'rgba(27,31,39,.62)' : 'rgba(240,238,231,.6)' }]} />
        </>
      )}
      <SafeAreaView edges={edges} style={[{ flex: 1 }, style]}>
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}>{children}</View>
      </SafeAreaView>
    </View>
  );
}
