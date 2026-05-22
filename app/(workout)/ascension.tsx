import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completionFromParams } from '@/hooks/useWorkoutNavigation';
import { useSommaStore } from '@/store/useSommaStore';

const FLARE_DURATION_MS = 3000;

/** The Ascension Flare — 3s lock, background sync, always return to Sanctuary */
export default function AscensionFlareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    blockId?: string;
    pillar?: string;
    rpe?: string;
    volume?: string;
    exerciseId?: string;
    weightUsed?: string;
    repsCompleted?: string;
    restSeconds?: string;
  }>();

  const completeWorkout = useSommaStore((state) => state.completeWorkout);

  const [statusLine, setStatusLine] = useState('Sealing your session');
  const hasRunRef = useRef(false);

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.85);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    glowOpacity.value = withTiming(1, {
      duration: FLARE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    glowScale.value = withTiming(1.15, {
      duration: FLARE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });

    const exitTimer = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, FLARE_DURATION_MS);

    void (async () => {
      try {
        setStatusLine('Integrating…');
        const completion = completionFromParams(params);
        if (completion) {
          await completeWorkout(completion);
        }
      } catch {
        setStatusLine('Saved locally · sync pending');
      }
    })();

    return () => {
      clearTimeout(exitTimer);
    };
  }, [completeWorkout, glowOpacity, glowScale, params, router]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.2,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <View className="flex-1 bg-[#0F1512]">
      <SafeAreaView className="flex-1" pointerEvents="none">
        <View className="flex-1 items-center justify-center px-10">
          <Animated.View
            style={[
              glowStyle,
              {
                width: 260,
                height: 260,
                borderRadius: 130,
                backgroundColor: '#BFA06A',
              },
            ]}
          />
          <Text className="mt-14 text-center font-display text-xl text-[#E8E4DC]">
            {statusLine}
          </Text>
          {params.blockId ? (
            <Text className="mt-3 text-center font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
              Returning to Daily Command
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
