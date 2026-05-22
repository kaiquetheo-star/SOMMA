import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { BreathPhaseKind } from '@/constants/breathwork';

const SCALE_MIN = 0.78;
const SCALE_MAX = 1.2;

interface BreathOrbVisualizerProps {
  phase: BreathPhaseKind;
  phaseDurationSec: number;
  isActive: boolean;
}

export function BreathOrbVisualizer({
  phase,
  phaseDurationSec,
  isActive,
}: BreathOrbVisualizerProps) {
  const scale = useSharedValue(SCALE_MIN);
  const glow = useSharedValue(0.12);

  useEffect(() => {
    if (!isActive) {
      scale.value = withTiming(SCALE_MIN, { duration: 600, easing: Easing.inOut(Easing.sin) });
      glow.value = withTiming(0.08, { duration: 600 });
      return;
    }

    const durationMs = Math.max(phaseDurationSec, 1) * 1000;

    if (phase === 'inhale') {
      scale.value = withTiming(SCALE_MAX, {
        duration: durationMs,
        easing: Easing.inOut(Easing.sin),
      });
      glow.value = withTiming(0.28, { duration: durationMs });
      return;
    }

    if (phase === 'hold') {
      scale.value = withTiming(SCALE_MAX, { duration: 400, easing: Easing.inOut(Easing.sin) });
      glow.value = withTiming(0.32, { duration: 400 });
      return;
    }

    if (phase === 'exhale') {
      scale.value = withTiming(SCALE_MIN, {
        duration: durationMs,
        easing: Easing.inOut(Easing.sin),
      });
      glow.value = withTiming(0.1, { duration: durationMs });
      return;
    }

    scale.value = withTiming(SCALE_MIN, { duration: durationMs, easing: Easing.inOut(Easing.sin) });
    glow.value = withTiming(0.08, { duration: durationMs });
  }, [phase, phaseDurationSec, isActive, scale, glow]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.85 + glow.value,
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * 1.15 }],
    opacity: glow.value * 0.6,
  }));

  return (
    <View className="flex-1 items-center justify-center">
      <Animated.View
        style={[
          haloStyle,
          {
            position: 'absolute',
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: 'rgba(74, 93, 68, 0.15)',
          },
        ]}
      />
      <Animated.View
        style={[
          orbStyle,
          {
            width: 168,
            height: 168,
            borderRadius: 84,
            backgroundColor: 'rgba(191, 160, 106, 0.14)',
            borderWidth: 1,
            borderColor: 'rgba(191, 160, 106, 0.4)',
          },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          width: 240,
          height: 240,
          borderRadius: 120,
          borderWidth: 1,
          borderColor: 'rgba(74, 93, 68, 0.2)',
        }}
      />
    </View>
  );
}
