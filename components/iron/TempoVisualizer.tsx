import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { ExerciseTempo } from '@/types/catalog';

const PHASE_LABELS = ['Excêntrica', 'Pausa', 'Concêntrica', 'Pausa'] as const;

export type TempoPhase = 'eccentric' | 'pause_bottom' | 'concentric' | 'pause_top';

const PHASE_INDEX: Record<TempoPhase, number> = {
  eccentric: 0,
  pause_bottom: 1,
  concentric: 2,
  pause_top: 3,
};

const PULSE_LOOP_MS = 1500;

interface TempoVisualizerProps {
  tempo?: ExerciseTempo | null;
  /** When provided, pins the highlighted pill to the given phase (no auto-cycle). */
  activePhase?: TempoPhase | null;
  /** Auto-cycle dwell per phase when no activePhase is driven externally. */
  cycleMs?: number;
}

function formatPhaseValue(value: string | number): string {
  if (typeof value === 'number') return `${value}s`;
  const trimmed = String(value).trim();
  if (!trimmed) return '—';
  if (/^x$/i.test(trimmed)) return 'X';
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}s`;
  return trimmed.toUpperCase();
}

/** Deterministic 1.5s Matte Gold pulse halo rendered inside the active pill. */
function PulseHalo() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: PULSE_LOOP_MS / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: PULSE_LOOP_MS / 2, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.05 + pulse.value * 0.1,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        haloStyle,
        {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 16,
          backgroundColor: '#BFA06A',
        },
      ]}
    />
  );
}

/**
 * Quiet Luxury tempo — four Matte Gold / Obsidian pills instead of raw `[3,1,X,0]`.
 * Active phase pill carries a subtle 1.5s Reanimated pulse.
 */
export function TempoVisualizer({ tempo, activePhase, cycleMs = 1500 }: TempoVisualizerProps) {
  const phases = useMemo(() => {
    if (!tempo || tempo.length < 4) return null;
    return PHASE_LABELS.map((label, index) => ({
      label,
      value: formatPhaseValue(tempo[index]!),
    }));
  }, [tempo]);

  const [cycleIndex, setCycleIndex] = useState(0);
  const externallyDriven = activePhase !== undefined;

  useEffect(() => {
    if (!phases || externallyDriven) return;
    const id = setInterval(() => {
      setCycleIndex((current) => (current + 1) % phases.length);
    }, cycleMs);
    return () => clearInterval(id);
  }, [phases, cycleMs, externallyDriven]);

  if (!phases) return null;

  const activeIndex = externallyDriven
    ? activePhase != null
      ? PHASE_INDEX[activePhase]
      : -1
    : cycleIndex;

  return (
    <View className="gap-2">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Tempo
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {phases.map((phase, index) => {
          const active = index === activeIndex;
          return (
            <View
              key={`${phase.label}-${index}`}
              className={`min-w-[72px] flex-1 overflow-hidden rounded-2xl border px-3 py-2.5 ${
                active
                  ? 'border-matte-gold bg-matte-gold/20'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {active ? <PulseHalo /> : null}
              <Text
                className={`font-body text-[9px] uppercase tracking-[0.2em] ${
                  active ? 'text-matte-gold' : 'text-[#6B7568]'
                }`}
              >
                {phase.label}
              </Text>
              <Text
                className={`mt-1 font-body-medium text-lg ${
                  active ? 'text-matte-gold' : 'text-[#E8E4DC]'
                }`}
              >
                {phase.value}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
