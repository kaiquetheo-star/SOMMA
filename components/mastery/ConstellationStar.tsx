import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const CANVAS = 300;
const STAR_HIT = 56;

export interface ConstellationStarConfig {
  id: string;
  label: string;
  essence: number;
  focusWeight: number;
  sessionCount: number;
  accent: string;
  glowColor: string;
  homeX: number;
  homeY: number;
}

interface ConstellationStarProps {
  config: ConstellationStarConfig;
}

export function ConstellationStar({ config }: ConstellationStarProps) {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      scale.value = withSpring(1.12);
    })
    .onUpdate((e) => {
      const nextX = startX.value + e.translationX;
      const nextY = startY.value + e.translationY;
      const minX = -config.homeX + 20;
      const maxX = CANVAS - config.homeX - STAR_HIT - 20;
      const minY = -config.homeY + 20;
      const maxY = CANVAS - config.homeY - STAR_HIT - 20;
      offsetX.value = Math.min(maxX, Math.max(minX, nextX));
      offsetY.value = Math.min(maxY, Math.max(minY, nextY));
    })
    .onEnd(() => {
      scale.value = withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  const radius = 14 + (Math.min(100, config.essence) / 100) * 16;
  const glowOpacity = 0.15 + (config.focusWeight / 100) * 0.35;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: config.homeX,
            top: config.homeY,
            width: STAR_HIT,
            alignItems: 'center',
          },
          animatedStyle,
        ]}
      >
        <View
          style={{
            width: radius * 2.8,
            height: radius * 2.8,
            borderRadius: radius * 1.4,
            borderWidth: 1,
            borderColor: `${config.accent}44`,
            backgroundColor: config.glowColor.replace(
              /[\d.]+\)$/,
              `${glowOpacity})`,
            ),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: radius,
              height: radius,
              borderRadius: radius / 2,
              backgroundColor: config.accent,
              opacity: 0.75,
            }}
          />
        </View>
        <Text className="mt-2 font-body text-[9px] uppercase tracking-[0.2em] text-[#8A9488]">
          {config.label}
        </Text>
        <Text className="font-body-medium text-xs text-matte-gold">{config.essence}%</Text>
        {config.sessionCount > 0 ? (
          <View className="mt-1 rounded-full border border-white/10 bg-white/10 px-2 py-0.5">
            <Text className="font-body text-[8px] text-[#A8B0A4]">
              {config.sessionCount} sessions
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
