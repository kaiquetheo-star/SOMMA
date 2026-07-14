import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ExerciseTempo } from '@/types/catalog';

const PHASE_LABELS = ['Excêntrica', 'Pausa', 'Concêntrica', 'Pausa'] as const;

interface TempoVisualizerProps {
  tempo?: ExerciseTempo | null;
  /** Seconds to dwell on each phase for the light progression (dev UX). */
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

/**
 * Quiet Luxury tempo — four Matte Gold / Obsidian pills instead of raw `[3,1,X,0]`.
 */
export function TempoVisualizer({ tempo, cycleMs = 1400 }: TempoVisualizerProps) {
  const phases = useMemo(() => {
    if (!tempo || tempo.length < 4) return null;
    return PHASE_LABELS.map((label, index) => ({
      label,
      value: formatPhaseValue(tempo[index]!),
    }));
  }, [tempo]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!phases) return;
    const id = setInterval(() => {
      setActiveIndex((current) => (current + 1) % phases.length);
    }, cycleMs);
    return () => clearInterval(id);
  }, [phases, cycleMs]);

  if (!phases) return null;

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
              key={phase.label}
              className={`min-w-[72px] flex-1 rounded-2xl px-3 py-2.5 ${
                active
                  ? 'border border-matte-gold/50 bg-matte-gold/15'
                  : 'border border-white/8 bg-white/[0.04]'
              }`}
            >
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

interface CueGlassCardProps {
  setup?: string | null;
  vector?: string | null;
  catchCue?: string | null;
}

/**
 * Collapsible glassmorphism cue card — setup / vector / catch.
 */
export function CueGlassCard({ setup, vector, catchCue }: CueGlassCardProps) {
  const [expanded, setExpanded] = useState(false);
  const entries = [
    setup ? { key: 'setup', label: 'Setup', value: setup } : null,
    vector ? { key: 'vector', label: 'Vector', value: vector } : null,
    catchCue ? { key: 'catch', label: 'Catch', value: catchCue } : null,
  ].filter((entry): entry is { key: string; label: string; value: string } => entry != null);

  if (entries.length === 0) return null;

  return (
    <View className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between px-4 py-3 active:opacity-80"
      >
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/80">
          Cue card
        </Text>
        <Text className="font-body text-sm text-matte-gold/70">{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded ? (
        <View className="gap-3 border-t border-white/5 px-4 pb-4 pt-3">
          {entries.map((entry) => (
            <View key={entry.key}>
              <Text className="font-body text-[9px] uppercase tracking-[0.3em] text-[#6B7568]">
                {entry.label}
              </Text>
              <Text className="mt-1 font-body text-sm leading-5 text-[#C8CFC4]">{entry.value}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="px-4 pb-3">
          <Text className="font-body text-xs leading-5 text-[#8A9488]" numberOfLines={2}>
            {entries[0]?.value}
          </Text>
        </View>
      )}
    </View>
  );
}
