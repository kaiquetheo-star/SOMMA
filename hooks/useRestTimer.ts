import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { playRestTenSecondChime, unlockRestTimerAudio } from '@/lib/audio/restTimerChime';
import { hapticRestComplete, hapticRestTick } from '@/lib/haptics';

interface UseRestTimerOptions {
  onComplete: () => void;
}

const TICK_MS = 250;

function remainingSecondsFromEnd(endAtMs: number): number {
  return Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
}

export function useRestTimer({ onComplete }: UseRestTimerOptions) {
  const [remaining, setRemaining] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const endAtMsRef = useRef<number | null>(null);
  const tenSecondChimeFiredRef = useRef(false);
  const completedRef = useRef(false);
  const lastTickSecondRef = useRef<number | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finishTimer = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    endAtMsRef.current = null;
    setIsActive(false);
    setRemaining(0);
    hapticRestComplete();
    onCompleteRef.current();
  }, []);

  const syncFromClock = useCallback(() => {
    const endAt = endAtMsRef.current;
    if (!endAt) return;

    const secs = remainingSecondsFromEnd(endAt);
    setRemaining(secs);

    if (secs === 10 && !tenSecondChimeFiredRef.current) {
      tenSecondChimeFiredRef.current = true;
      playRestTenSecondChime();
    }

    if (secs <= 4 && secs > 0 && lastTickSecondRef.current !== secs) {
      lastTickSecondRef.current = secs;
      hapticRestTick();
    }

    if (secs <= 0) {
      finishTimer();
    }
  }, [finishTimer]);

  const start = useCallback(
    (seconds: number) => {
      unlockRestTimerAudio();
      completedRef.current = false;
      tenSecondChimeFiredRef.current = false;
      lastTickSecondRef.current = null;
      endAtMsRef.current = Date.now() + seconds * 1000;
      setRemaining(seconds);
      setIsActive(true);
      syncFromClock();
    },
    [syncFromClock],
  );

  const skip = useCallback(() => {
    finishTimer();
  }, [finishTimer]);

  useEffect(() => {
    if (!isActive || endAtMsRef.current == null) return;

    const interval = setInterval(syncFromClock, TICK_MS);

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') syncFromClock();
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);

    if (typeof document !== 'undefined') {
      const onVisibility = () => {
        if (document.visibilityState === 'visible') syncFromClock();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        clearInterval(interval);
        subscription.remove();
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [isActive, syncFromClock]);

  return {
    remaining,
    isActive,
    start,
    skip,
    progress: isActive && remaining > 0 ? remaining : 0,
  };
}
