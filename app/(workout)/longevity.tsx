import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LoadingFallback } from '@/components/routing/LoadingFallback';
import { WorkoutShell } from '@/components/workout/WorkoutShell';
import { useWorkoutBlockReady } from '@/hooks/useWorkoutBlockReady';
import { useWorkoutNavigation } from '@/hooks/useWorkoutNavigation';
import { hapticButtonTap } from '@/lib/haptics';

/**
 * Post-Iron biological maintenance — mobility cues, core, Zone-2 flush.
 * Completing marks the longevity block done and returns via Ascension.
 */
export default function LongevityModeScreen() {
  const { blockId, title } = useLocalSearchParams<{ blockId?: string; title?: string }>();
  const { activeBlock, isReady, waitingForBlock } = useWorkoutBlockReady(blockId);
  const { finishBlock } = useWorkoutNavigation();

  const prescription = activeBlock?.longevity;
  const checklist = useMemo(() => {
    if (!prescription) return [];
    return [
      ...prescription.mobility_cues.map((cue) => ({ id: `cue:${cue}`, label: cue, group: 'Mobilidade' })),
      { id: 'core', label: prescription.core_exercise, group: 'Core' },
      { id: 'cardio', label: prescription.cardio_prescription, group: 'Cardio' },
    ];
  }, [prescription]);

  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());

  const toggleItem = (id: string) => {
    void hapticButtonTap();
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked = checklist.length > 0 && checklist.every((item) => doneIds.has(item.id));

  if (waitingForBlock || !isReady) {
    return <LoadingFallback message="Preparando protocolo de mobilidade..." />;
  }

  if (!prescription) {
    return (
      <WorkoutShell eyebrow="Longevity" title={title ?? 'Manutenção Biológica'} accent="dark">
        <Text className="font-body text-sm leading-6 text-[#8A9488]">
          Nenhum protocolo de mobilidade prescrito para este bloco.
        </Text>
      </WorkoutShell>
    );
  }

  return (
    <WorkoutShell
      eyebrow="Pós-treino · Longevity"
      title={title || prescription.title}
      accent="dark"
      completeLabel="Concluir Mobilidade"
      completeDisabled={!allChecked}
      onComplete={() => {
        void hapticButtonTap();
        finishBlock(blockId ?? activeBlock?.id ?? '', { pillar: 'longevity' });
      }}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className="font-body text-[10px] uppercase tracking-[0.32em] text-[#6B8E78]">
          Foco
        </Text>
        <Text className="mt-2 font-display text-2xl leading-8 text-[#E8E4DC]">
          {prescription.mobility_focus}
        </Text>
        <Text className="mt-3 font-body text-sm leading-6 text-[#8A9488]">
          Marque cada bloco após executar. O flush metabólico fecha o dia de ferro.
        </Text>

        <View className="mt-8 gap-3">
          {checklist.map((item) => {
            const checked = doneIds.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleItem(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={item.label}
                className={`rounded-2xl border px-4 py-4 active:opacity-85 ${
                  checked
                    ? 'border-[#6B8E78]/55 bg-[#6B8E78]/15'
                    : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <Text className="font-body text-[10px] uppercase tracking-[0.28em] text-[#6B8E78]">
                  {item.group}
                </Text>
                <View className="mt-2 flex-row items-start gap-3">
                  <View
                    className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border ${
                      checked ? 'border-[#6B8E78] bg-[#6B8E78]' : 'border-white/20'
                    }`}
                  >
                    {checked ? (
                      <Text className="font-body-bold text-[10px] text-[#0F1512]">✓</Text>
                    ) : null}
                  </View>
                  <Text
                    className={`flex-1 font-body text-sm leading-6 ${
                      checked ? 'text-[#C8C4BC]' : 'text-[#E8E4DC]'
                    }`}
                  >
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-6 mb-4 text-center font-body text-[10px] uppercase tracking-[0.28em] text-[#6B7568]">
          {doneIds.size}/{checklist.length} concluídos · {prescription.duration_minutes} min
        </Text>
      </ScrollView>
    </WorkoutShell>
  );
}
