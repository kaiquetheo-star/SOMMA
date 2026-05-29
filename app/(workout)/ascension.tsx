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
/** Guaranteed return to Daily Command — independent of background sync */
const NAV_DELAY_MS = 800;

/** The Ascension Flare — brief lock, background sync, always return to Sanctuary */
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
  const routerRef = useRef(router);
  routerRef.current = router;

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.85);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    glowOpacity.value = withTiming(1, {
      duration: FLARE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    glowScale.value = withTiming(1.15, {
      duration: FLARE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [glowOpacity, glowScale]);

  useEffect(() => {
    const navTimer = setTimeout(() => {
      try {
        routerRef.current.replace('/(tabs)/home');
      } catch {
        routerRef.current.push('/(tabs)/home');
      }
    }, NAV_DELAY_MS);

    return () => clearTimeout(navTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (!cancelled) setStatusLine('Integrating…');
        const completion = completionFromParams(params);
        if (completion) {
          await completeWorkout(completion);
        }
      } catch {
        if (!cancelled) setStatusLine('Saved locally · sync pending');
      }
    })();

    return () => {
      cancelled = true;
    };
    // Mount-once: route params and store action are fixed for this transition screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
