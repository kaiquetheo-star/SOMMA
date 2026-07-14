import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { SommaColors } from '@/constants/theme';
import { hapticRestTick, hapticSetLogged } from '@/lib/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RestTimerOverlayProps {
  remaining: number;
  total: number;
  onSkip: () => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SIZE = 220;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Quiet Luxury rest overlay — Obsidian glass + Matte Gold radial progress (Reanimated).
 * Haptics: medium on open, light when the timer completes.
 */
export function RestTimerOverlay({ remaining, total, onSkip }: RestTimerOverlayProps) {
  const progress = useSharedValue(total > 0 ? remaining / total : 0);
  const completedRef = useRef(false);

  useEffect(() => {
    void hapticSetLogged();
  }, []);

  useEffect(() => {
    const next = total > 0 ? Math.max(0, remaining / total) : 0;
    progress.value = withTiming(next, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    if (remaining <= 0 && !completedRef.current) {
      completedRef.current = true;
      void hapticRestTick();
    }
  }, [remaining, total, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View
      className="absolute inset-0 z-10 items-center justify-center bg-obsidian px-8"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
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

      <Pressable onPress={onSkip} className="mt-12 active:opacity-70">
        <Text className="font-body text-xs uppercase tracking-[0.35em] text-[#6B7568]">
          Skip rest
        </Text>
      </Pressable>
    </View>
  );
}
