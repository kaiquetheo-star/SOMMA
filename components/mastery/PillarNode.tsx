import { Text, View } from 'react-native';

const MIN_DIAMETER = 52;
const MAX_DIAMETER = 76;

export interface PillarNodeConfig {
  id: string;
  label: string;
  essence: number;
  focusWeight: number;
  sessionCount: number;
}

interface PillarNodeProps {
  config: PillarNodeConfig;
}

/** Fixed-layout pillar disc — size and opacity reflect essence and focus weight. */
export function PillarNode({ config }: PillarNodeProps) {
  const essenceClamped = Math.min(100, Math.max(0, config.essence));
  const focusClamped = Math.min(100, Math.max(0, config.focusWeight));

  const diameter =
    MIN_DIAMETER + (essenceClamped / 100) * (MAX_DIAMETER - MIN_DIAMETER);
  const fillOpacity = 0.35 + (focusClamped / 100) * 0.5;
  const ringOpacity = 0.2 + (focusClamped / 100) * 0.35;

  return (
    <View
      className="items-center justify-center px-2"
      accessibilityRole="text"
      accessibilityLabel={`${config.label} pillar, ${essenceClamped} percent essence, ${focusClamped} percent focus`}
    >
      <View
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderWidth: 1,
          borderColor: `rgba(191, 160, 106, ${ringOpacity})`,
          backgroundColor: `rgba(191, 160, 106, ${fillOpacity * 0.35})`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: diameter * 0.42,
            height: diameter * 0.42,
            borderRadius: (diameter * 0.42) / 2,
            backgroundColor: `rgba(232, 228, 220, ${fillOpacity})`,
          }}
        />
      </View>

      <Text
        className="mt-3 text-center font-body text-[10px] uppercase tracking-[0.28em] text-[#8A9488]"
        numberOfLines={1}
      >
        {config.label}
      </Text>
      <Text className="mt-1 font-body-medium text-sm text-[#E8E4DC]">{essenceClamped}%</Text>
      <Text className="mt-0.5 font-body text-[10px] text-[#6B7568]">
        {config.sessionCount} session{config.sessionCount === 1 ? '' : 's'}
      </Text>
    </View>
  );
}
