import React, { useEffect, useState } from 'react';

import { FlipCounter } from '@/components/flip-counter';
import { fetchLeaderboard } from '@/engine/api';

/** Every car caught by every spotter on Carbix, as a raceway flip-clock. Re-checked every 20 seconds while it is on screen. */
export function GlobalCatchCounter() {
  const [total, setTotal] = useState(0);
  const [spotters, setSpotters] = useState(0);
  useEffect(() => {
    let live = true;
    const load = async () => {
      const rows = await fetchLeaderboard();
      if (!live || !rows.length) return;
      setTotal(rows.reduce((a, r) => a + (Number((r as { caught?: number }).caught) || 0), 0));
      setSpotters(rows.length);
    };
    load();
    const id = setInterval(load, 20000);
    return () => { live = false; clearInterval(id); };
  }, []);
  return <FlipCounter value={total} label="CARS CAUGHT ON CARBIX" sub={spotters ? `LIVE  -  ${spotters} SPOTTERS` : 'LIVE'} />;
}
