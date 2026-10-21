import { Tabs } from 'expo-router';
import React from 'react';

import { AppHeader } from '@/components/app-header';
import { TabBar } from '@/components/tab-bar';

// Same five labels as the web app; the feed and the leaderboard share the FEED tab.
const TABS: { name: string; title: string }[] = [
  { name: 'home', title: 'Home' },
  { name: 'bix', title: 'Garage' },
  { name: 'index', title: 'Scan' },
  { name: 'map', title: 'Map' },
  { name: 'social', title: 'Feed' },
];

// The app opens on SCAN.
export const unstable_settings = { initialRouteName: 'index' };

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ freezeOnBlur: true, headerShown: true, header: () => <AppHeader /> }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}
