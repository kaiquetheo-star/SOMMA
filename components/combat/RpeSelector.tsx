import { Pressable, Text, View } from 'react-native';

interface RpeSelectorProps {
  value: number | null;
  onChange: (rpe: number) => void;
}

export function RpeSelector({ value, onChange }: RpeSelectorProps) {
  return (
    <View className="gap-3">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Rate perceived exertion (1–10)
      </Text>
      <View className="flex-row flex-wrap justify-center gap-2">
        {Array.from({ length: 10 }, (_, index) => {
          const rpe = index + 1;
          const selected = value === rpe;
          return (
            <Pressable
              key={rpe}
              onPress={() => onChange(rpe)}
              accessibilityRole="button"
              accessibilityLabel={`RPE ${rpe}`}
              className={`h-11 w-11 items-center justify-center rounded-full border ${
                selected
                  ? 'border-matte-gold bg-matte-gold/20'
                  : 'border-white/15 bg-white/[0.04]'
              }`}
            >
              <Text
                className={`font-body-medium text-sm ${
                  selected ? 'text-matte-gold' : 'text-[#8A9488]'
                }`}
              >
                {rpe}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
