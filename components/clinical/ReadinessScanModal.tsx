import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ValueStepper } from '@/components/iron/ValueStepper';
import type { ReadinessScan } from '@/lib/gameplan/engine/adaptiveStateMachine';

interface ReadinessScanModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (scan: ReadinessScan) => void;
  existingScan?: ReadinessScan | null;
}

const CATEGORY_LABELS: Array<keyof Omit<ReadinessScan, 'timestamp'>> = [
  'sleep_quality',
  'muscle_soreness',
  'energy_level',
  'stress_level',
  'mobility_feeling',
];

function clampReadinessScore(value: number): ReadinessScan['sleep_quality'] {
  const rounded = Math.min(5, Math.max(1, Math.round(value)));
  return rounded as ReadinessScan['sleep_quality'];
}

const CATEGORY_TITLES: Record<keyof Omit<ReadinessScan, 'timestamp'>, string> = {
  sleep_quality: 'Qualidade do sono',
  muscle_soreness: 'Dor muscular',
  energy_level: 'Nível de energia',
  stress_level: 'Nível de estresse',
  mobility_feeling: 'Mobilidade / movimento',
};

export function ReadinessScanModal({ visible, onClose, onSubmit, existingScan }: ReadinessScanModalProps) {
  const [sleepQuality, setSleepQuality] = useState<ReadinessScan['sleep_quality']>(existingScan?.sleep_quality ?? 3);
  const [muscleSoreness, setMuscleSoreness] = useState<ReadinessScan['muscle_soreness']>(existingScan?.muscle_soreness ?? 3);
  const [energyLevel, setEnergyLevel] = useState<ReadinessScan['energy_level']>(existingScan?.energy_level ?? 3);
  const [stressLevel, setStressLevel] = useState<ReadinessScan['stress_level']>(existingScan?.stress_level ?? 3);
  const [mobilityFeeling, setMobilityFeeling] = useState<ReadinessScan['mobility_feeling']>(existingScan?.mobility_feeling ?? 3);

  useEffect(() => {
    if (!visible) return;
    setSleepQuality(existingScan?.sleep_quality ?? 3);
    setMuscleSoreness(existingScan?.muscle_soreness ?? 3);
    setEnergyLevel(existingScan?.energy_level ?? 3);
    setStressLevel(existingScan?.stress_level ?? 3);
    setMobilityFeeling(existingScan?.mobility_feeling ?? 3);
  }, [visible, existingScan]);

  if (!visible) return null;

  const onSubmitScan = () => {
    onSubmit({
      sleep_quality: sleepQuality,
      muscle_soreness: muscleSoreness,
      energy_level: energyLevel,
      stress_level: stressLevel,
      mobility_feeling: mobilityFeeling,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <View className="absolute inset-0 z-50 bg-black/85 px-5 py-8">
      <View className="h-full flex-1 rounded-[32px] border border-white/10 bg-[#0F1512] p-6 shadow-2xl shadow-black/40">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-body text-[10px] uppercase tracking-[0.32em] text-[#BFA06A]">
              Clinical Readiness
            </Text>
            <Text className="mt-3 font-display text-3xl text-[#E8E4DC]">Check-in de Prontidão</Text>
            <Text className="mt-2 font-body text-sm leading-6 text-[#8A9488]">
              Capture seu estado antes da próxima sessão e deixe o protocolo reagir localmente.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar modal de readiness"
            className="rounded-full border border-white/10 px-4 py-2"
          >
            <Text className="font-body text-xs uppercase tracking-[0.35em] text-[#E8E4DC]">Fechar</Text>
          </Pressable>
        </View>

        <ScrollView
          className="mt-8 flex-1"
          contentContainerClassName="gap-3 pb-2"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {CATEGORY_LABELS.map((field) => {
            const value =
              field === 'sleep_quality'
                ? sleepQuality
                : field === 'muscle_soreness'
                  ? muscleSoreness
                  : field === 'energy_level'
                    ? energyLevel
                    : field === 'stress_level'
                      ? stressLevel
                      : mobilityFeeling;
            const setter =
              field === 'sleep_quality'
                ? setSleepQuality
                : field === 'muscle_soreness'
                  ? setMuscleSoreness
                  : field === 'energy_level'
                    ? setEnergyLevel
                    : field === 'stress_level'
                      ? setStressLevel
                      : setMobilityFeeling;

            return (
              <View key={field} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <ValueStepper
                  label={CATEGORY_TITLES[field]}
                  value={value}
                  step={1}
                  min={1}
                  max={5}
                  compact
                  onChange={(next) => setter(clampReadinessScore(next))}
                />
              </View>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={onSubmitScan}
          accessibilityRole="button"
          accessibilityLabel="Enviar readiness scan"
          className="mt-4 rounded-2xl bg-[#BFA06A] py-4"
        >
          <Text className="text-center font-body-bold text-sm uppercase tracking-[0.22em] text-[#0F1512]">
            Registrar Check-in
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
