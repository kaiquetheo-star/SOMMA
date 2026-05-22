import { Text, View } from 'react-native';

import { BREATH_PHASE_LABELS, type BreathPhaseKind } from '@/constants/breathwork';

interface BreathPhaseHudProps {
  phase: BreathPhaseKind;
  secondsLeft: number;
  cycleIndex: number;
  totalCycles: number;
}

export function BreathPhaseHud({ phase, secondsLeft, cycleIndex, totalCycles }: BreathPhaseHudProps) {
  return (
    <View className="items-center">
      <Text className="font-display-bold text-4xl tracking-wide text-matte-gold">
        {BREATH_PHASE_LABELS[phase]}
      </Text>
      <Text className="mt-3 font-display text-5xl text-[#E8E4DC]">{secondsLeft}</Text>
      <Text className="mt-6 font-body text-[10px] uppercase tracking-[0.4em] text-[#6B7568]">
        Cycle {Math.min(cycleIndex + 1, totalCycles)} · {totalCycles}
      </Text>
    </View>
  );
}
