import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completionFromParams } from '@/hooks/useWorkoutNavigation';
import { useSommaStore } from '@/store/useSommaStore';

/** Minimum dwell before returning to the Sanctuary — no rushed exits. */
const FLARE_DURATION_MS = 3000;
const GLOW_FADE_MS = 500;
const GLOW_SIZE = 320;

/**
 * The Ascension Flare — full Obsidian, one soft Matte Gold radial glow,
 * background sync, then a quiet return home. No bars, no flashes, no bounce.
 */
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
  const routerRef = useRef(router);
  routerRef.current = router;

  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    glowOpacity.value = withTiming(1, {
      duration: GLOW_FADE_MS,
      easing: Easing.inOut(Easing.ease),
    });
  }, [glowOpacity]);

  useEffect(() => {
    const navTimer = setTimeout(() => {
      try {
        routerRef.current.replace('/(tabs)/home');
      } catch {
        routerRef.current.push('/(tabs)/home');
      }
    }, FLARE_DURATION_MS);

    return () => clearTimeout(navTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const completion = completionFromParams(params);
        if (completion && !cancelled) {
          await completeWorkout(completion);
        }
      } catch {
        // Saved locally — sync resumes in background; the flare stays serene.
      }
    })();

    return () => {
      cancelled = true;
    };
    // Mount-once: route params and store action are fixed for this transition screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.15,
  }));

  return (
    <View className="flex-1 bg-[#0F1512]">
      <SafeAreaView className="flex-1" pointerEvents="none">
        <View className="flex-1 items-center justify-center px-10">
          <View className="items-center justify-center">
            <Animated.View
              style={[
                glowStyle,
                {
                  position: 'absolute',
                  width: GLOW_SIZE,
                  height: GLOW_SIZE,
                  borderRadius: GLOW_SIZE / 2,
                  backgroundColor: '#BFA06A',
                },
                Platform.OS === 'web'
                  ? ({ filter: 'blur(100px)' } as object)
                  : {
                      shadowColor: '#BFA06A',
                      shadowOpacity: 1,
                      shadowRadius: 100,
                      shadowOffset: { width: 0, height: 0 },
                    },
              ]}
            />
            <Text className="text-center font-display text-3xl text-white">
              Protocolo Completo
            </Text>
            <Text className="mt-4 text-center font-body text-sm text-white/60">
              Retornando ao Sanctuary…
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
