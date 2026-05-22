import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ConstellationStar, type ConstellationStarConfig } from '@/components/mastery/ConstellationStar';
import { SommaColors } from '@/constants/theme';
import type { FocusPreference, UserStats } from '@/store/useSommaStore';
import type { PerformanceLogEntry } from '@/types/performance';

const CANVAS = 300;
const CENTER = CANVAS / 2;

interface MasteryConstellationProps {
  stats: UserStats;
  focus: FocusPreference | null;
  performanceLogs: PerformanceLogEntry[];
}

function pillarSessionCounts(logs: PerformanceLogEntry[]) {
  let iron = 0;
  let combat = 0;
  let flowSpirit = 0;

  for (const log of logs) {
    if (log.pillar === 'iron') iron += 1;
    else if (log.pillar === 'combat') combat += 1;
    else flowSpirit += 1;
  }

  return { iron, combat, flowSpirit };
}

function Connector({
  x1,
  y1,
  x2,
  y2,
  opacity,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x1,
        top: y1,
        width: length,
        height: 1,
        backgroundColor: `rgba(191, 160, 106, ${opacity})`,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

/** Unified Constellation — draggable pillar stars sized by essence (FSD §3.2) */
export function MasteryConstellation({
  stats,
  focus,
  performanceLogs,
}: MasteryConstellationProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);

  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.35,
    transform: [{ scale: 0.94 + pulse.value * 0.08 }],
  }));

  const counts = pillarSessionCounts(performanceLogs);
  const focusWeights = focus ?? { iron: 25, combat: 25, flow: 25, spirit: 25 };

  const stars: ConstellationStarConfig[] = [
    {
      id: 'body',
      label: 'Body',
      essence: stats.body_essence,
      focusWeight: focusWeights.iron,
      sessionCount: counts.iron,
      accent: SommaColors.matteGold,
      glowColor: 'rgba(191, 160, 106, 0.2)',
      homeX: CENTER - 28,
      homeY: 24,
    },
    {
      id: 'combat',
      label: 'Combat',
      essence: stats.combat_mastery,
      focusWeight: focusWeights.combat,
      sessionCount: counts.combat,
      accent: SommaColors.darkCopper,
      glowColor: 'rgba(139, 69, 19, 0.25)',
      homeX: CANVAS - 80,
      homeY: CENTER - 20,
    },
    {
      id: 'spirit',
      label: 'Spirit',
      essence: stats.spirit_essence,
      focusWeight: focusWeights.spirit,
      sessionCount: counts.flowSpirit,
      accent: SommaColors.matteGold,
      glowColor: 'rgba(191, 160, 106, 0.18)',
      homeX: 36,
      homeY: CANVAS - 88,
    },
    {
      id: 'mind',
      label: 'Mind',
      essence: stats.mind_essence,
      focusWeight: focusWeights.flow,
      sessionCount: 0,
      accent: 'rgba(168, 176, 166, 0.95)',
      glowColor: 'rgba(168, 176, 166, 0.15)',
      homeX: 28,
      homeY: CENTER - 48,
    },
  ];

  const starCenters = stars.map((s) => ({
    x: s.homeX + 28,
    y: s.homeY + 20,
    opacity: 0.08 + (s.focusWeight / 100) * 0.22,
  }));

  return (
    <View className="items-center">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Unified Constellation
      </Text>
      <Text className="mt-2 max-w-xs text-center font-body text-sm leading-6 text-[#8A9488]">
        Drag the stars — size reflects essence, threads reflect your Foundation focus split.
      </Text>

      <View
        style={{ width: CANVAS, height: CANVAS, marginTop: 24 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]"
      >
        {starCenters.map((center, index) => (
          <Connector
            key={`link-${stars[index].id}`}
            x1={CENTER}
            y1={CENTER}
            x2={center.x}
            y2={center.y}
            opacity={center.opacity}
          />
        ))}

        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: CENTER - 24,
              top: CENTER - 24,
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(191, 160, 106, 0.35)',
              backgroundColor: 'rgba(191, 160, 106, 0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            },
            coreStyle,
          ]}
        >
          <Text className="font-display text-[10px] tracking-[0.2em] text-matte-gold">S</Text>
        </Animated.View>

        {stars.map((star) => (
          <ConstellationStar key={star.id} config={star} />
        ))}
      </View>

      <View className="mt-6 w-full flex-row flex-wrap justify-center gap-2">
        {stars.map((star) => (
          <View
            key={`chip-${star.id}`}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5"
          >
            <Text className="font-body text-[10px] uppercase tracking-[0.15em] text-[#8A9488]">
              {star.label}{' '}
              <Text className="text-matte-gold">
                {star.focusWeight}% focus
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
