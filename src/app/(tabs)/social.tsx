import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/screen';

import { Chip, PText } from '@/components/ui';
import { ClubsView } from '@/app/clubs';
import { FeedList } from '@/components/feed-list';
import { RankList } from '@/components/social-lists';
import { useGame } from '@/state/game';
import { useTheme } from '@/theme/theme';

/** Feed and leaderboard used to be two tabs; one place for everything other spotters are doing. */
export default function Social() {
  const t = useTheme();
  const g = useGame();
  const [seg, setSeg] = useState<'feed' | 'ranks' | 'clubs'>('feed');
  return (
    <Screen edges={[]}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <PText style={{ fontSize: 40, lineHeight: 42, color: t.red }}>SPOTTERS</PText>
          <PText style={{ color: t.muted, fontSize: 14, marginBottom: 6 }}>LV.{g.level}  {g.xp.toLocaleString()} XP</PText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip label="FEED" on={seg === 'feed'} onPress={() => setSeg('feed')} />
          <Chip label="LEADERBOARD" on={seg === 'ranks'} onPress={() => setSeg('ranks')} />
          <Chip label="CLUBS" on={seg === 'clubs'} onPress={() => setSeg('clubs')} />
        </View>
      </View>
      {seg === 'feed' ? <FeedList /> : seg === 'ranks' ? <RankList /> : <ClubsView embedded />}
    </Screen>
  );
}
