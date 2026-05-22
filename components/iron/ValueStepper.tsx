import { Pressable, Text, View } from 'react-native';

interface ValueStepperProps {
  label: string;
  value: number;
  unit?: string;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function ValueStepper({
  label,
  value,
  unit,
  step,
  min = 0,
  max = 999,
  onChange,
  disabled = false,
}: ValueStepperProps) {
  const decrement = () => onChange(Math.max(min, Math.round((value - step) * 10) / 10));
  const increment = () => onChange(Math.min(max, Math.round((value + step) * 10) / 10));

  const display =
    step < 1 ? value.toFixed(1) : Number.isInteger(value) ? String(value) : value.toFixed(1);

  return (
    <View className={disabled ? 'opacity-50' : ''}>
      <Text className="text-center font-body text-[10px] uppercase tracking-[0.4em] text-[#6B7568]">
        {label}
      </Text>
      <View className="mt-3 flex-row items-center justify-center gap-6">
        <Pressable
          onPress={decrement}
          disabled={disabled}
          accessibilityLabel={`Decrease ${label}`}
          className="h-12 w-12 items-center justify-center rounded-full border border-white/15 active:bg-white/10"
        >
          <Text className="font-body-medium text-2xl text-[#E8E4DC]">−</Text>
        </Pressable>
        <View className="min-w-[100px] items-center">
          <Text className="font-display-bold text-5xl text-[#E8E4DC]">{display}</Text>
          {unit ? (
            <Text className="mt-1 font-body text-xs text-matte-gold/80">{unit}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={increment}
          disabled={disabled}
          accessibilityLabel={`Increase ${label}`}
          className="h-12 w-12 items-center justify-center rounded-full border border-white/15 active:bg-white/10"
        >
          <Text className="font-body-medium text-2xl text-[#E8E4DC]">+</Text>
        </Pressable>
      </View>
    </View>
  );
}
