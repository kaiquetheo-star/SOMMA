import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SommaColors } from '@/constants/theme';
import { PILLAR_TO_ESSENCE_INDEX } from '@/lib/sanctuary/attunement';
import type { UserStats } from '@/store/useSommaStore';
import type { WorkoutPillar } from '@/types/gameplan';

interface AttunementOrbsProps {
  stats: UserStats;
  /** Pillars with completed blocks today — boosts matching essence channels */
  completedPillars?: WorkoutPillar[];
}

function OrbRing({
  size,
  opacity,
  color,
}: {
  size: number;
  opacity: number;
  color: string;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: color,
        opacity,
      }}
    />
  );
}

function essenceIntensity(value: number, pillarBoost: boolean): number {
  const base = Math.min(1, Math.max(0, value) / 50);
  return pillarBoost ? Math.min(1, base + 0.35) : base;
}

const ESSENCE_CHANNELS = [
  { key: 'body', label: 'Body', field: 'body_essence' as const, accent: SommaColors.matteGold },
  { key: 'mind', label: 'Mind', field: 'mind_essence' as const, accent: 'rgba(168, 176, 166, 0.9)' },
  { key: 'spirit', label: 'Spirit', field: 'spirit_essence' as const, accent: SommaColors.matteGold },
  { key: 'combat', label: 'Combat', field: 'combat_mastery' as const, accent: SommaColors.darkCopper },
] as const;

const PILLAR_ORBITS: { pillar: WorkoutPillar; label: string; angleDeg: number }[] = [
  { pillar: 'iron', label: 'Iron', angleDeg: -90 },
  { pillar: 'combat', label: 'Combat', angleDeg: 30 },
  { pillar: 'spirit', label: 'Spirit', angleDeg: 150 },
];

const ORBIT_RADIUS = 92;

function PillarOrbitDot({
  label,
  angleDeg,
  isLit,
}: {
  label: string;
  angleDeg: number;
  isLit: boolean;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = Math.cos(rad) * ORBIT_RADIUS;
  const y = Math.sin(rad) * ORBIT_RADIUS;
  const glow = useSharedValue(isLit ? 1 : 0);

  useEffect(() => {
    glow.value = withTiming(isLit ? 1 : 0, { duration: 600, easing: Easing.out(Easing.cubic) });
    if (isLit) {
      glow.value = withSequence(
        withTiming(1.2, { duration: 280 }),
        withTiming(1, { duration: 400 }),
      );
    }
  }, [isLit, glow]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.65,
    transform: [{ scale: 0.85 + glow.value * 0.25 }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 100 + x - 18,
          top: 100 + y - 18,
          width: 36,
          alignItems: 'center',
        },
        dotStyle,
      ]}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: isLit ? SommaColors.matteGold : 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderColor: isLit ? SommaColors.matteGold : 'rgba(255,255,255,0.2)',
        }}
      />
      <Text
        className="mt-1 font-body text-[8px] uppercase tracking-[0.15em]"
        style={{ color: isLit ? SommaColors.matteGold : '#6B7568' }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

/** Concentric attunement rings — glow scales with essence + today's completed pillars */
export function AttunementOrbs({ stats, completedPillars = [] }: AttunementOrbsProps) {
  const completedSet = new Set(completedPillars);

  const pillarBoostByChannel = ESSENCE_CHANNELS.map((_, index) =>
    (Object.entries(PILLAR_TO_ESSENCE_INDEX) as [WorkoutPillar, number][]).some(
      ([pillar, channelIndex]) => channelIndex === index && completedSet.has(pillar),
    ),
  );

  const intensities = ESSENCE_CHANNELS.map((ch, index) =>
    essenceIntensity(stats[ch.field], pillarBoostByChannel[index]),
  );
  const blended =
    intensities.reduce((sum, value) => sum + value, 0) / ESSENCE_CHANNELS.length;

  const gold = `rgba(191, 160, 106, ${0.15 + blended * 0.45})`;
  const moss = `rgba(74, 93, 68, ${0.1 + blended * 0.3})`;

  const pulse = useSharedValue(0);
  const completionFlare = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);

  useEffect(() => {
    if (completedPillars.length === 0) return;
    completionFlare.value = withSequence(
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
      withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
    );
  }, [completedPillars.length, completionFlare]);

  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.35 + completionFlare.value * 0.15,
    transform: [{ scale: 0.96 + pulse.value * 0.08 + completionFlare.value * 0.06 }],
  }));

  return (
    <View className="items-center">
      <View className="items-center justify-center" style={{ width: 200, height: 200 }}>
        <OrbRing size={180} opacity={0.35 + blended * 0.2} color={moss} />
        <OrbRing size={140} opacity={0.45 + blended * 0.25} color={gold} />
        <OrbRing size={100} opacity={0.55 + blended * 0.35} color={gold} />

        {PILLAR_ORBITS.map((orbit) => (
          <PillarOrbitDot
            key={orbit.pillar}
            label={orbit.label}
            angleDeg={orbit.angleDeg}
            isLit={completedSet.has(orbit.pillar)}
          />
        ))}

        <Animated.View
          style={[
            {
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: `rgba(191, 160, 106, ${0.08 + blended * 0.2})`,
              borderWidth: 1,
              borderColor: gold,
            },
            coreStyle,
          ]}
        />
      </View>

      <View className="mt-4 w-full flex-row flex-wrap justify-center gap-2">
        {ESSENCE_CHANNELS.map((channel, index) => (
          <View
            key={channel.key}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5"
            style={{
              borderColor: pillarBoostByChannel[index]
                ? `${channel.accent}88`
                : `${channel.accent}33`,
              opacity: 0.65 + intensities[index] * 0.35,
            }}
          >
            <Text className="font-body text-[10px] uppercase tracking-[0.2em] text-[#8A9488]">
              {channel.label}{' '}
              <Text className="text-matte-gold">{stats[channel.field]}%</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
