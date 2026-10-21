import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Screen } from '@/components/screen';

import { CarCard } from '@/components/car-card';
import { Btn, PText } from '@/components/ui';
import { useGame } from '@/state/game';

export default function CardScreen() {
  const g = useGame();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = g.garage.find((x) => String(x.id) === id);
  if (!c) {
    return (
      <Screen edges={['top', 'bottom']}>
        <PText>THAT CATCH ISN&apos;T IN THIS GARAGE.</PText>
        <Btn label="CLOSE" onPress={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <CarCard g={c} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn style={{ flex: 1 }} tone="red" label="DONE" onPress={() => router.back()} />
          <Btn
            style={{ flex: 1 }}
            tone="plain"
            label="DELETE"
            onPress={() =>
              Alert.alert('Delete this catch?', 'It will be removed from your garage and its XP will be lost.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { g.removeCatch(c.id); router.back(); } },
              ])
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
