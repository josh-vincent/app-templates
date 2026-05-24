// Mounts whichever modal the celebrations queue points at. Sits at app root
// so it overlays every screen.

import React from 'react';

import PokeBurst from './PokeBurst';
import RunningOutModal from './RunningOutModal';
import StreakModal from './StreakModal';
import WonModal from './WonModal';
import { useCelebrations } from '@/lib/celebrations';

export default function CelebrationsHost() {
  const { active, dismiss } = useCelebrations();
  return (
    <>
      <WonModal
        visible={active?.kind === 'won'}
        payload={active?.kind === 'won' ? active.payload : null}
        onDismiss={dismiss}
      />
      <RunningOutModal
        visible={active?.kind === 'runningOut'}
        payload={active?.kind === 'runningOut' ? active.payload : null}
        onDismiss={dismiss}
      />
      <StreakModal
        visible={active?.kind === 'streak'}
        payload={active?.kind === 'streak' ? active.payload : null}
        onDismiss={dismiss}
      />
      {/* Pokes have their own queue (Convex inbox) — render unconditionally
          and let the component decide when to animate. Doesn't interfere
          with the celebrations modal queue above. */}
      <PokeBurst />
    </>
  );
}
