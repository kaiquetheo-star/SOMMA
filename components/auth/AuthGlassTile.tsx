import { Pressable, Text, View } from 'react-native';

interface AuthGlassTileProps {
  label: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

export function AuthGlassTile({
  label,
  subtitle,
  onPress,
  disabled = false,
  accessibilityLabel,
}: AuthGlassTileProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      className={`overflow-hidden rounded-2xl border px-6 py-4 active:opacity-80 ${
        disabled
          ? 'border-white/5 bg-white/[0.02] opacity-50'
          : 'border-white/10 bg-white/[0.06]'
      }`}
      style={
        disabled
          ? undefined
          : {
              shadowColor: '#BFA06A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
            }
      }
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-body-medium text-sm uppercase tracking-[0.25em] text-[#E8E4DC]">
          {label}
        </Text>
      </View>
      {subtitle ? (
        <Text className="mt-1 font-body text-xs text-[#8A9488]">{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}
