import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FlowAsanaPrescription } from '@/types/gameplan';

export type FlowSessionStatus = 'idle' | 'active' | 'complete';

export interface UseFlowAsanaSessionOptions {
  asanas: FlowAsanaPrescription[];
}

export function useFlowAsanaSession({ asanas }: UseFlowAsanaSessionOptions) {
  const sortedAsanas = useMemo(
    () => [...asanas].sort((a, b) => a.order - b.order),
    [asanas],
  );

  const [status, setStatus] = useState<FlowSessionStatus>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const statusRef = useRef(status);
  const currentIndexRef = useRef(currentIndex);
  const secondsLeftRef = useRef(secondsLeft);
  const completeFiredRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  const currentAsana = sortedAsanas[currentIndex] ?? null;
  const totalPoses = sortedAsanas.length;

  const armPoseTimer = useCallback(
    (index: number) => {
      const pose = sortedAsanas[index];
      if (!pose) return;
      setSecondsLeft(Math.max(1, pose.hold_seconds));
    },
    [sortedAsanas],
  );

  const completeSession = useCallback(() => {
    if (completeFiredRef.current) return;
    completeFiredRef.current = true;
    setStatus('complete');
    setSecondsLeft(0);
  }, []);

  const advancePose = useCallback(() => {
    const index = currentIndexRef.current;
    if (index >= sortedAsanas.length - 1) {
      completeSession();
      return;
    }
    const next = index + 1;
    setCurrentIndex(next);
    armPoseTimer(next);
  }, [sortedAsanas.length, armPoseTimer, completeSession]);

  const start = useCallback(() => {
    if (sortedAsanas.length === 0) return;
    completeFiredRef.current = false;
    setCurrentIndex(0);
    setTotalElapsed(0);
    setStatus('active');
    armPoseTimer(0);
  }, [sortedAsanas.length, armPoseTimer]);

  const goNext = useCallback(() => {
    if (statusRef.current !== 'active') return;
    advancePose();
  }, [advancePose]);

  const goPrev = useCallback(() => {
    if (statusRef.current !== 'active') return;
    const index = currentIndexRef.current;
    if (index <= 0) {
      armPoseTimer(0);
      return;
    }
    const prev = index - 1;
    setCurrentIndex(prev);
    armPoseTimer(prev);
  }, [armPoseTimer]);

  useEffect(() => {
    if (status !== 'active') return;

    const interval = setInterval(() => {
      setTotalElapsed((t) => t + 1);
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== 'active' || secondsLeft > 0 || totalPoses === 0) return;
    advancePose();
  }, [secondsLeft, status, advancePose, totalPoses]);

  return {
    sortedAsanas,
    status,
    currentIndex,
    currentAsana,
    totalPoses,
    secondsLeft,
    totalElapsed,
    start,
    goNext,
    goPrev,
    canGoPrev: currentIndex > 0,
    isLastPose: currentIndex >= totalPoses - 1,
  };
}
