import { ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MasteryConstellation } from '@/components/mastery/MasteryConstellation';
import { useSommaStore } from '@/store/useSommaStore';

/** The Unified Constellation — pillar essence star map (FSD §3.2) */
export default function MasteryScreen() {
  const userStats = useSommaStore((state) => state.user_stats);
  const focus = useSommaStore((state) => state.user_foundation.focus_preference);
  const performanceLogs = useSommaStore((state) => state.performance_logs);

  const totalSessions = performanceLogs.length;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-obsidian">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-8 pb-12 pt-8"
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
            Mastery
          </Text>
          <Text className="mt-3 font-display-bold text-3xl text-[#E8E4DC]">
            Unified Constellation
          </Text>
          <Text className="mt-4 font-body text-sm leading-6 text-[#8A9488]">
            Your four pillar stars reflect Foundation attunement and logged ritual volume.
          </Text>

          <View className="mt-10">
            <MasteryConstellation
              stats={userStats}
              focus={focus}
              performanceLogs={performanceLogs}
            />
          </View>

          <View className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
            <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
              Ritual archive
            </Text>
            <Text className="mt-2 font-display text-2xl text-matte-gold">{totalSessions}</Text>
            <Text className="mt-1 font-body text-xs text-[#8A9488]">
              Performance logs on device · syncs to Supabase when online
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
