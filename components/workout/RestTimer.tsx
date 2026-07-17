import { useEffect, useRef } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { SommaColors } from '@/constants/theme';
import { hapticRestStart, hapticRestWarning } from '@/lib/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RestTimerProps {
  /** Seconds left — driven by useRestTimer so the clock survives backgrounding. */
  remaining: number;
  /** Total prescribed rest in seconds. */
  total: number;
  onSkip: () => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SIZE = 220;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Quiet Luxury rest overlay — Obsidian/95 glass + Matte Gold radial progress.
 * Haptics: impactMedium on open, impactLight at 10s remaining
 * (notificationSuccess on finish fires from useRestTimer).
 */
export function RestTimer({ remaining, total, onSkip }: RestTimerProps) {
  const progress = useSharedValue(total > 0 ? remaining / total : 0);
  const warnedRef = useRef(false);

  useEffect(() => {
    void hapticRestStart();
  }, []);

  useEffect(() => {
    const next = total > 0 ? Math.max(0, remaining / total) : 0;
    progress.value = withTiming(next, {
      duration: 280,
      easing: Easing.inOut(Easing.ease),
    });
    if (remaining <= 10 && remaining > 0 && !warnedRef.current) {
      warnedRef.current = true;
      void hapticRestWarning();
    }
  }, [remaining, total, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View
      className="absolute inset-0 z-10 items-center justify-center px-8"
      style={[
        { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
        { backgroundColor: 'rgba(15, 21, 18, 0.95)' },
        Platform.OS === 'web'
          ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object)
          : null,
      ]}
    >
      <Text className="font-body text-[10px] uppercase tracking-[0.45em] text-matte-gold/80">
        Rest · Breathe
      </Text>

      <View className="mt-10 items-center justify-center">
        <Svg width={SIZE} height={SIZE}>
          <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={STROKE}
              fill="transparent"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={SommaColors.matteGold}
              strokeWidth={STROKE}
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              animatedProps={animatedProps}
            />
          </G>
        </Svg>
        <View className="absolute items-center">
          <Text className="font-display-bold text-6xl text-matte-gold">
            {formatTimer(Math.max(0, remaining))}
          </Text>
        </View>
      </View>

      <View className="absolute bottom-10 right-8">
        <Pressable onPress={onSkip} className="px-2 py-2 active:opacity-70">
          <Text className="font-body text-sm text-white/60">Pular descanso</Text>
        </Pressable>
      </View>
    </View>
  );
}
