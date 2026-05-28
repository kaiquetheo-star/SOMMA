import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MasteryConstellation } from '@/components/mastery/MasteryConstellation';
import { useSommaStore } from '@/store/useSommaStore';

/** Mastery — pillar essence grid and focus telemetry */
export default function MasteryScreen() {
  const userStats = useSommaStore((state) => state.user_stats);
  const focus = useSommaStore((state) => state.user_foundation.focus_preference);
  const performanceLogs = useSommaStore((state) => state.performance_logs);

  const totalSessions = performanceLogs.length;

  return (
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
        <Text className="mt-4 max-w-xl font-body text-sm leading-6 text-[#8A9488]">
          Four pillars in a fixed symmetric grid. Essence and logged volume shape each disc;
          focus split is read as plain telemetry below.
        </Text>

        <View className="mt-10">
          <MasteryConstellation
            stats={userStats}
            focus={focus}
            performanceLogs={performanceLogs}
          />
        </View>

        <View className="mt-10 w-full max-w-md self-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
          <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
            Ritual archive
          </Text>
          <Text className="mt-2 font-display text-2xl text-matte-gold">{totalSessions}</Text>
          <Text className="mt-1 font-body text-xs text-[#8A9488]">
            Performance logs stored on this device
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
