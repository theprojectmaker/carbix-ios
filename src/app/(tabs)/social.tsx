import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/screen';

import { Chip, PText } from '@/components/ui';
import { FeedList, RankList } from '@/components/social-lists';
import { useGame } from '@/state/game';
import { useTheme } from '@/theme/theme';

/** Feed and leaderboard used to be two tabs; one place for everything other spotters are doing. */
export default function Social() {
  const t = useTheme();
  const g = useGame();
  const [seg, setSeg] = useState<'feed' | 'ranks'>('feed');
  return (
    <Screen edges={[]}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
        <PText style={{ fontSize: 34, color: t.red }}>FEED</PText>
        <PText style={{ color: t.muted }}>
          YOU: {g.xp.toLocaleString()} XP · LV.{g.level} {g.rank}
        </PText>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="FRIENDS FEED" on={seg === 'feed'} onPress={() => setSeg('feed')} />
          <Chip label="LEADERBOARD" on={seg === 'ranks'} onPress={() => setSeg('ranks')} />
        </View>
      </View>
      {seg === 'feed' ? <FeedList /> : <RankList />}
    </Screen>
  );
}
