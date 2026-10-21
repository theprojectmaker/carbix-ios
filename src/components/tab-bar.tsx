import type { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play } from '@/lib/sfx';
import { Plate } from './plate';
import { fonts } from '@/theme/theme';

const INK = '#141C27';
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

/** The web app's nav: text-only chunky keys — navy plastic, the active one a raised red plate. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: INK, borderTopWidth: 4, borderTopColor: INK, paddingTop: 8, paddingHorizontal: 4, paddingBottom: 0 }}>
      {state.routes.map((route, i) => {
        const on = state.index === i;
        const label = String(descriptors[route.key].options.title ?? route.name).toUpperCase();
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            onPress={() => {
              play('tab');
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, marginTop: on ? -3 : 0 }}>
            {({ pressed }) => (
              <Plate
                color={on ? '#D8402F' : '#2C3E58'}
                pressed={pressed}
                depth={on ? 4 : 2}
                hi={on ? 'rgba(232,112,95,.95)' : 'rgba(93,130,172,.95)'}
                lo={on ? 'rgba(152,38,26,.55)' : 'rgba(0,0,0,.34)'}
                style={{ height: (on ? 62 : 58) + insets.bottom, justifyContent: 'flex-start', paddingTop: on ? 16 : 14, alignItems: 'center' }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontFamily: fonts.display, fontSize: 21, color: on ? '#fff' : '#D7E2F0', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,.6)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 }}>
                  {label}
                </Text>
              </Plate>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
