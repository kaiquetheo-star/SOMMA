import { Pressable, Text, View } from 'react-native';

import type { BreathTempo } from '@/constants/breathwork';

interface TempoSelectorProps {
  tempos: BreathTempo[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function TempoSelector({ tempos, selectedId, onSelect, disabled }: TempoSelectorProps) {
  return (
    <View className="gap-2">
      {tempos.map((tempo) => {
        const selected = tempo.id === selectedId;
        return (
          <Pressable
            key={tempo.id}
            onPress={() => onSelect(tempo.id)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`rounded-2xl border px-4 py-3 active:opacity-85 ${
              selected
                ? 'border-matte-gold/50 bg-matte-gold/10'
                : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <Text
              className={`font-display text-lg ${selected ? 'text-matte-gold' : 'text-[#E8E4DC]'}`}
            >
              {tempo.name}
            </Text>
            <Text className="mt-1 font-body text-xs text-[#8A9488]">{tempo.subtitle}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
