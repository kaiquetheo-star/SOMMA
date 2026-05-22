import { Text, View } from 'react-native';

import { comboDisplayText, type CombatCombo } from '@/constants/combat';

interface ComboDisplayProps {
  combo: CombatCombo;
  phaseLabel: string;
}

export function ComboDisplay({ combo, phaseLabel }: ComboDisplayProps) {
  return (
    <View className="items-center rounded-2xl border border-dark-copper/40 bg-dark-copper/10 px-6 py-10">
      <Text className="font-body text-[10px] uppercase tracking-[0.5em] text-blood-red">
        {phaseLabel}
      </Text>
      <Text className="mt-6 text-center font-display-bold text-3xl leading-tight text-[#E8E4DC]">
        {comboDisplayText(combo)}
      </Text>
    </View>
  );
}
