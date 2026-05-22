import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BREATH_TEMPOS,
  getNextPhase,
  getPhaseDuration,
  type BreathPhaseKind,
  type BreathTempo,
} from '@/constants/breathwork';
import { hapticPhaseChange, hapticRestTick } from '@/lib/haptics';

export type BreathSessionStatus = 'idle' | 'running' | 'paused' | 'complete';

interface UseBreathworkEngineOptions {
  initialTempoId?: string;
  /** Override default cycle count (e.g. from AI duration_minutes) */
  targetCycles?: number;
  /** Breath tempos from `library_flow_spirit` — defaults to offline constants */
  tempos?: BreathTempo[];
}

function resolvePhaseEntry(
  tempo: BreathTempo,
  start: BreathPhaseKind,
): { phase: BreathPhaseKind; seconds: number } | 'cycle_complete' {
  let phase = start;
  let guard = 0;

  while (guard < 8) {
    const seconds = getPhaseDuration(tempo, phase);
    if (seconds > 0) {
      return { phase, seconds };
    }
    const next = getNextPhase(tempo, phase);
    if (next === 'cycle_complete') {
      return 'cycle_complete';
    }
    phase = next;
    guard += 1;
  }

  return { phase: 'inhale', seconds: tempo.inhale };
}

export function useBreathworkEngine({
  initialTempoId = '4-7-8',
  targetCycles,
  tempos: temposOption,
}: UseBreathworkEngineOptions = {}) {
  const catalog = temposOption?.length ? temposOption : BREATH_TEMPOS;

  const [tempo, setTempo] = useState<BreathTempo>(
    () => catalog.find((item) => item.id === initialTempoId) ?? catalog[0],
  );
  const totalCycles = targetCycles ?? tempo.defaultCycles;
  const totalCyclesRef = useRef(totalCycles);
  const [status, setStatus] = useState<BreathSessionStatus>('idle');
  const [phase, setPhase] = useState<BreathPhaseKind>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const statusRef = useRef(status);
  const tempoRef = useRef(tempo);
  const phaseRef = useRef(phase);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    totalCyclesRef.current = totalCycles;
  }, [totalCycles]);

  const applyPhase = useCallback((entry: { phase: BreathPhaseKind; seconds: number }) => {
    setPhase(entry.phase);
    setSecondsLeft(entry.seconds);
  }, []);

  const advancePhase = useCallback(() => {
    const activeTempo = tempoRef.current;
    const currentPhase = phaseRef.current;
    const nextStep = getNextPhase(activeTempo, currentPhase);

    if (nextStep === 'cycle_complete') {
      setCycleIndex((current) => {
        const nextCycle = current + 1;
        if (nextCycle >= totalCyclesRef.current) {
          setStatus('complete');
          setSecondsLeft(0);
          return nextCycle;
        }

        const entry = resolvePhaseEntry(activeTempo, 'inhale');
        if (entry !== 'cycle_complete') {
          applyPhase(entry);
          hapticPhaseChange();
        } else {
          setStatus('complete');
        }
        return nextCycle;
      });
      return;
    }

    const entry = resolvePhaseEntry(activeTempo, nextStep);
    if (entry === 'cycle_complete') {
      setStatus('complete');
      return;
    }
    applyPhase(entry);
    hapticPhaseChange();
  }, [applyPhase]);

  useEffect(() => {
    if (status !== 'running' || secondsLeft > 0) return;
    advancePhase();
  }, [secondsLeft, status, advancePhase]);

  useEffect(() => {
    if (status !== 'running') return;

    const interval = setInterval(() => {
      setTotalElapsed((value) => value + 1);
      setSecondsLeft((prev) => {
        if (prev > 1) {
          if (prev <= 4) hapticRestTick();
          return prev - 1;
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const start = useCallback(() => {
    const entry = resolvePhaseEntry(tempo, 'inhale');
    if (entry === 'cycle_complete') return;

    setCycleIndex(0);
    setTotalElapsed(0);
    applyPhase(entry);
    setStatus('running');
    hapticPhaseChange();
  }, [applyPhase, tempo]);

  const pause = useCallback(() => {
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current === 'complete') return;
    setStatus('running');
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setPhase('inhale');
    setSecondsLeft(0);
    setCycleIndex(0);
    setTotalElapsed(0);
  }, []);

  useEffect(() => {
    const next = catalog.find((item) => item.id === initialTempoId);
    if (next) setTempo(next);
  }, [catalog, initialTempoId]);

  const selectTempo = useCallback(
    (tempoId: string) => {
      const next = catalog.find((item) => item.id === tempoId);
      if (next) setTempo(next);
    },
    [catalog],
  );

  const phaseDuration = getPhaseDuration(tempo, phase);

  return {
    tempo,
    status,
    phase,
    secondsLeft,
    phaseDuration,
    cycleIndex,
    totalCycles,
    totalElapsed,
    start,
    pause,
    resume,
    reset,
    selectTempo,
    tempos: catalog,
  };
}
