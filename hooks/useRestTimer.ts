import { useCallback, useEffect, useRef, useState } from 'react';

import { hapticRestComplete, hapticRestTick } from '@/lib/haptics';

interface UseRestTimerOptions {
  onComplete: () => void;
}

export function useRestTimer({ onComplete }: UseRestTimerOptions) {
  const [remaining, setRemaining] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const start = useCallback((seconds: number) => {
    setRemaining(seconds);
    setIsActive(true);
  }, []);

  const skip = useCallback(() => {
    setIsActive(false);
    setRemaining(0);
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    if (!isActive || remaining <= 0) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          hapticRestComplete();
          onCompleteRef.current();
          return 0;
        }
        if (prev <= 4) {
          hapticRestTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, remaining]);

  return {
    remaining,
    isActive,
    start,
    skip,
    progress: isActive && remaining > 0 ? remaining : 0,
  };
}
