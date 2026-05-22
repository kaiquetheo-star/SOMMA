import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttunementOrbsPanel } from '@/components/sanctuary/AttunementOrbsPanel';
import { GameplanBlockCard } from '@/components/sanctuary/GameplanBlockCard';
import { useUserStatsRealtime } from '@/hooks/useUserStatsRealtime';
import { useWorkoutNavigation } from '@/hooks/useWorkoutNavigation';
import { prefetchLibraryCatalogs } from '@/lib/catalog/library';
import { isGameplanStale } from '@/lib/gameplan/generateStubGameplan';
import { useAuth } from '@/providers/AuthProvider';
import { hasCompletedFoundationScan, useSommaStore } from '@/store/useSommaStore';

/** The Daily Command — Sanctuary hub (FSD §3.2) */
export default function DailyCommandScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userStats = useSommaStore((state) => state.user_stats);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userBiological = useSommaStore((state) => state.user_biological);
  const currentGameplan = useSommaStore((state) => state.currentGameplan);
  const gameplanLoading = useSommaStore((state) => state.gameplan_loading);
  const gameplanSource = useSommaStore((state) => state.gameplan_source);
  const performanceSyncing = useSommaStore((state) => state.performance_syncing);
  const ensureDailyGameplan = useSommaStore((state) => state.ensureDailyGameplan);
  const fetchDailyGameplanAsync = useSommaStore((state) => state.fetchDailyGameplanAsync);
  const regenerateDailyGameplan = useSommaStore((state) => state.regenerateDailyGameplan);

  const { openBlock } = useWorkoutNavigation();

  useUserStatsRealtime(user?.id);

  const foundationComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  useEffect(() => {
    if (!foundationComplete) return;

    if (isGameplanStale(currentGameplan)) {
      fetchDailyGameplanAsync();
      return;
    }

    ensureDailyGameplan();
  }, [foundationComplete, currentGameplan, ensureDailyGameplan, fetchDailyGameplanAsync]);

  useEffect(() => {
    if (!foundationComplete) return;
    void prefetchLibraryCatalogs();
  }, [foundationComplete]);

  const completedCount =
    currentGameplan?.blocks.filter((block) => block.status === 'completed').length ?? 0;
  const totalCount = currentGameplan?.blocks.length ?? 0;

  const sourceLabel =
    gameplanSource === 'ai'
      ? 'AI protocol'
      : gameplanSource === 'deterministic'
        ? 'Expert protocol'
        : gameplanSource === 'fallback'
          ? 'Fallback protocol'
          : gameplanSource === 'stub'
            ? 'Local protocol'
            : null;

  return (
    <SafeAreaView className="flex-1 bg-[#0F1512]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-8 pb-12 pt-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
          The Sanctuary
        </Text>
        <Text className="mt-3 font-display-bold text-3xl text-[#E8E4DC]">Daily Command</Text>

        <View className="mt-8 items-center">
          <AttunementOrbsPanel
            stats={userStats}
            biological={userBiological}
            gameplan={currentGameplan}
          />
        </View>

        {foundationComplete ? (
          <View className="mt-10 gap-3">
            <View className="flex-row items-end justify-between">
              <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                Today&apos;s protocol
              </Text>
              {gameplanLoading || performanceSyncing ? (
                <ActivityIndicator size="small" color="#BFA06A" />
              ) : (
                <Text className="font-body text-xs text-matte-gold/80">
                  {completedCount}/{totalCount} complete
                  {sourceLabel ? ` · ${sourceLabel}` : ''}
                </Text>
              )}
            </View>

            {performanceSyncing ? (
              <View className="overflow-hidden rounded-2xl border border-matte-gold/20 bg-matte-gold/5 px-5 py-3">
                <Text className="font-body text-xs text-matte-gold/90">
                  Integrating session · recalibrating protocol…
                </Text>
              </View>
            ) : null}

            {gameplanLoading && !currentGameplan ? (
              <View className="items-center py-12">
                <Text className="font-body text-sm text-[#8A9488]">
                  Experts are arranging your ritual…
                </Text>
              </View>
            ) : null}

            {currentGameplan
              ? currentGameplan.blocks
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((block) => (
                    <GameplanBlockCard
                      key={block.id}
                      block={block}
                      onPress={() => openBlock(block)}
                    />
                  ))
              : null}

            <Pressable
              onPress={() => regenerateDailyGameplan()}
              disabled={gameplanLoading || performanceSyncing}
              accessibilityRole="button"
              accessibilityLabel="Recalibrate daily protocol"
              className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-5 py-4 active:opacity-80"
            >
              <Text className="font-body-medium text-xs uppercase tracking-[0.3em] text-[#8A9488]">
                Recalibrate
              </Text>
              <Text className="mt-1 font-body text-xs text-[#6B7568]">
                Invoke AI Edge Function · refresh today&apos;s blocks
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/(auth)/foundation')}
            accessibilityRole="button"
            accessibilityLabel="Begin Foundation Scan"
            className="mt-10 overflow-hidden rounded-2xl border border-matte-gold/25 bg-white/5 px-5 py-4 active:opacity-75"
          >
            <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-matte-gold/80">
              Protocol awaiting
            </Text>
            <Text className="mt-2 font-display text-xl text-[#E8E4DC]">
              Complete your Foundation Scan
            </Text>
            <Text className="mt-2 font-body text-sm leading-6 text-[#8A9488]">
              Your AI-curated blocks will appear here once attunement is established.
            </Text>
            <Text className="mt-4 font-body-medium text-xs uppercase tracking-[0.3em] text-matte-gold">
              Begin Foundation Scan →
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
