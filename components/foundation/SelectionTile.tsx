import { Pressable, Text, View } from 'react-native';

interface SelectionTileProps {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

export function SelectionTile({
  label,
  subtitle,
  selected,
  onPress,
  accessibilityLabel,
}: SelectionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      className={`overflow-hidden rounded-2xl border px-5 py-4 active:opacity-90 ${
        selected
          ? 'border-matte-gold/60 bg-matte-gold/10'
          : 'border-white/10 bg-white/[0.04]'
      }`}
      style={
        selected
          ? {
              shadowColor: '#BFA06A',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
            }
          : undefined
      }
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`font-display text-xl ${selected ? 'text-matte-gold' : 'text-[#E8E4DC]'}`}
        >
          {label}
        </Text>
        {selected ? (
          <View className="h-2 w-2 rounded-full bg-matte-gold" />
        ) : null}
      </View>
      {subtitle ? (
        <Text className="mt-2 font-body text-sm leading-5 text-[#8A9488]">{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}
