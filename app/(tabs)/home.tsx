import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { WeeklyStrip } from '@/components/WeeklyStrip';
import { GameplanBlockCard } from '@/components/sanctuary/GameplanBlockCard';
import { LoadingFallback } from '@/components/routing/LoadingFallback';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';
import { useWorkoutNavigation } from '@/hooks/useWorkoutNavigation';
import { prefetchLibraryCatalogs } from '@/lib/catalog/library';
import { isProtocolDateStale } from '@/lib/gameplan/generateStubGameplan';
import { getDailyIronFocus } from '@/lib/gameplan/engine/iron/dupLogic';
import {
  getMicrocycleDay,
  getTodayDayIndex,
  MICROCYCLE_DAY_LABELS,
} from '@/lib/gameplan/microcycleWeek';
import {
  hasCompletedFoundationScan,
  useSommaStore,
} from '@/store/useSommaStore';
import type { GameplanBlock, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';

const LONG_DAY_LABELS = [
  'Segunda',
  'Terca',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sabado',
  'Domingo',
] as const;

function clampDayIndex(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(7, Math.max(1, Math.round(parsed)));
}

function splitFromFocusLabel(label: string): 'push' | 'pull' | 'legs' | null {
  const normalized = label.toLowerCase();
  if (normalized.includes('push')) return 'push';
  if (normalized.includes('pull')) return 'pull';
  if (normalized.includes('leg')) return 'legs';
  return null;
}

function ironSlotIndexForDay(microcycle: MicrocycleDay[] | null, dayIndex: number): number {
  if (!microcycle?.length) return dayIndex;

  const ironDays = microcycle
    .filter((day) => day.blocks.some((block) => block.pillar === 'iron'))
    .map((day) => day.day_index)
    .sort((a, b) => a - b);
  const index = ironDays.indexOf(dayIndex);
  return index >= 0 ? index + 1 : dayIndex;
}

function findIronBlock(day: MicrocycleDay | null): GameplanBlock | null {
  return day?.blocks.find((block) => block.pillar === 'iron' && block.iron?.exercises.length) ?? null;
}

function formatTempo(exercise: IronExercisePrescription): string {
  return exercise.tempo?.join('-') ?? '3-1-1-1';
}

function formatRepTarget(exercise: IronExercisePrescription): string {
  return exercise.target_rep_range ?? `${exercise.target_reps} reps`;
}

function displayExerciseName(exercise: IronExercisePrescription): string {
  return exercise.display_name ?? exercise.slug ?? exercise.exercise_id;
}

function focusCopy(day: MicrocycleDay | null, microcycle: MicrocycleDay[] | null): string {
  if (!day || day.is_rest_day) return 'Rest / Recovery';

  const split = splitFromFocusLabel(day.focus_label);
  if (!split) return day.focus_label;

  const focus = getDailyIronFocus(ironSlotIndexForDay(microcycle, day.day_index), split);
  return focus.focus.replace(/_/g, ' ').toUpperCase();
}

function nutritionSummary(day: MicrocycleDay | null): string | null {
  const nutrition = day?.blocks.find((block) => block.nutrition?.nutrition_target)?.nutrition;
  const target = nutrition?.nutrition_target;
  if (!target) return null;

  return `${target.total_calories} kcal · ${target.carbs_g}g C · ${target.protein_g}g P · ${target.water_ml}ml`;
}

/** Immersive Daily Iron Dashboard — direct protocol surface for Text-Only Elite. */
export default function DailyCommandScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dayIndex?: string }>();
  const storeHydrated = useStoreHydrated();
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userBiological = useSommaStore((state) => state.user_biological);
  const weeklyMicrocycle = useSommaStore((state) => state.weeklyMicrocycle);
  const protocolDate = useSommaStore((state) => state.protocolDate);
  const weekStartDate = useSommaStore((state) => state.weekStartDate);
  const selectedDayIndex = useSommaStore((state) => state.selectedDayIndex);
  const setSelectedDayIndex = useSommaStore((state) => state.setSelectedDayIndex);
  const gameplanLoading = useSommaStore((state) => state.gameplan_loading);
  const gameplanError = useSommaStore((state) => state.gameplan_error);
  const clearGameplanError = useSommaStore((state) => state.clearGameplanError);
  const performanceSyncing = useSommaStore((state) => state.performance_syncing);
  const ensureDailyGameplan = useSommaStore((state) => state.ensureDailyGameplan);
  const fetchDailyGameplanAsync = useSommaStore((state) => state.fetchDailyGameplanAsync);
  const regenerateDailyGameplan = useSommaStore((state) => state.regenerateDailyGameplan);
  const { openBlock } = useWorkoutNavigation();

  const todayDayIndex = getTodayDayIndex(weekStartDate);
  const requestedDayIndex = clampDayIndex(params.dayIndex);

  useEffect(() => {
    if (requestedDayIndex && requestedDayIndex !== selectedDayIndex) {
      setSelectedDayIndex(requestedDayIndex);
    }
  }, [requestedDayIndex, selectedDayIndex, setSelectedDayIndex]);

  const activeDayIndex = requestedDayIndex ?? selectedDayIndex;
  const selectedDay = getMicrocycleDay(weeklyMicrocycle, activeDayIndex);
  const ironBlock = findIronBlock(selectedDay);
  const ironExercises = ironBlock?.iron?.exercises ?? [];
  const ancillaryBlocks = (selectedDay?.blocks ?? []).filter((block) => block.pillar !== 'iron');
  const isToday = activeDayIndex === todayDayIndex;

  const foundationComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  const dayLabel = LONG_DAY_LABELS[activeDayIndex - 1] ?? 'Dia';
  const compactDayLabel = MICROCYCLE_DAY_LABELS[activeDayIndex - 1] ?? 'Day';
  const dailyFocus = useMemo(
    () => focusCopy(selectedDay, weeklyMicrocycle),
    [selectedDay, weeklyMicrocycle],
  );
  const nutritionLine = nutritionSummary(selectedDay);

  useEffect(() => {
    if (!storeHydrated || !foundationComplete) return;

    if (isProtocolDateStale(protocolDate) || !weeklyMicrocycle) {
      fetchDailyGameplanAsync();
      return;
    }

    ensureDailyGameplan();
  }, [
    storeHydrated,
    foundationComplete,
    protocolDate,
    weeklyMicrocycle,
    ensureDailyGameplan,
    fetchDailyGameplanAsync,
  ]);

  useEffect(() => {
    if (!storeHydrated || !foundationComplete) return;
    void prefetchLibraryCatalogs();
  }, [storeHydrated, foundationComplete]);

  if (!storeHydrated) {
    return <LoadingFallback message="Restoring your sanctuary state..." />;
  }

  if (!foundationComplete) {
    return (
      <SafeAreaView className="flex-1 bg-[#0F1512]">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-body text-[10px] uppercase tracking-[0.34em] text-[#6B7568]">
            Foundation required
          </Text>
          <Text className="mt-4 text-center font-display text-3xl leading-10 text-[#E8E4DC]">
            Complete your biological baseline.
          </Text>
          <Text className="mt-3 text-center font-body text-sm leading-6 text-[#8A9488]">
            The Iron protocol unlocks after equipment, goals and passport data are calibrated.
          </Text>
          <Pressable
            onPress={() => router.push('/(auth)/foundation')}
            accessibilityRole="button"
            accessibilityLabel="Complete Foundation Scan"
            className="mt-8 rounded-2xl bg-[#BFA06A] px-6 py-4 active:opacity-85"
          >
            <Text className="font-body-bold text-xs uppercase tracking-[0.24em] text-[#0F1512]">
              Realizar Foundation Scan
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0F1512]">
      <WeeklyStrip
        microcycle={weeklyMicrocycle}
        selectedDayIndex={activeDayIndex}
        todayDayIndex={todayDayIndex}
        onSelectDay={setSelectedDayIndex}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-36 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8">
          <Text className="font-body text-[10px] uppercase leading-5 tracking-[0.34em] text-[#6B7568]">
            {isToday ? 'Protocolo de Hoje' : `Visualizando ${dayLabel}`}
          </Text>
          <Text className="mt-3 font-display-bold text-4xl leading-[46px] text-[#E8E4DC]">
            {selectedDay?.focus_label ?? 'Descanso Ativo'}
          </Text>
          <Text className="mt-2 font-body-medium text-sm uppercase leading-6 tracking-[0.18em] text-[#BFA06A]">
            {dailyFocus}
          </Text>
          {nutritionLine ? (
            <Text className="mt-3 font-body text-xs leading-5 text-[#8A9488]">
              Fueling · {nutritionLine}
            </Text>
          ) : null}
        </View>

        {performanceSyncing ? (
          <View className="mb-5 rounded-2xl border border-[#BFA06A]/20 bg-[#BFA06A]/5 px-5 py-3">
            <Text className="font-body text-xs leading-5 text-[#BFA06A]">
              Integrating session · recalibrating protocol...
            </Text>
          </View>
        ) : null}

        {gameplanError ? (
          <View className="mb-6 rounded-3xl border border-red-500/35 bg-red-950/30 px-6 py-7">
            <Text className="text-center font-body text-[10px] uppercase tracking-[0.28em] text-red-400/90">
              Neural Link Failed
            </Text>
            <Text className="mt-4 text-center font-body text-sm leading-6 text-[#E8C4C4]">
              {gameplanError}
            </Text>
            <Pressable
              onPress={() => {
                clearGameplanError();
                void regenerateDailyGameplan();
              }}
              disabled={gameplanLoading || performanceSyncing}
              accessibilityRole="button"
              accessibilityLabel="Retry protocol generation"
              className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 active:opacity-80"
            >
              <Text className="text-center font-body-medium text-xs uppercase tracking-[0.24em] text-red-300">
                Re-establish Link
              </Text>
            </Pressable>
          </View>
        ) : null}

        {gameplanLoading && !weeklyMicrocycle && !gameplanError ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#BFA06A" />
            <Text className="mt-4 font-body text-sm leading-6 text-[#8A9488]">
              Experts are arranging your ritual...
            </Text>
          </View>
        ) : null}

        {!gameplanError && ironExercises.length > 0 ? (
          <View className="gap-5">
            <View className="gap-4">
              {ironExercises.map((exercise, index) => (
                <View
                  key={`${exercise.exercise_id}-${index}`}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] p-5"
                >
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="min-w-0 flex-1">
                      <Text className="font-body text-[10px] uppercase tracking-[0.26em] text-[#6B7568]">
                        Exercise {index + 1}
                      </Text>
                      <Text className="mt-2 font-body-semibold text-xl leading-7 text-[#E8E4DC]">
                        {displayExerciseName(exercise)}
                      </Text>
                    </View>
                    <View className="rounded-xl border border-[#BFA06A]/30 bg-[#BFA06A]/10 px-3 py-2">
                      <Text className="font-body-bold text-xs uppercase tracking-[0.12em] text-[#BFA06A]">
                        {exercise.target_sets} x {formatRepTarget(exercise)}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-4 rounded-2xl border border-white/8 bg-[#0A0E0C]/70 px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="font-body text-[10px] uppercase tracking-[0.28em] text-[#6B7568]">
                        Tempo
                      </Text>
                      <Text className="font-body-bold text-sm tracking-[0.2em] text-[#BFA06A]">
                        {formatTempo(exercise)}
                      </Text>
                    </View>

                    {exercise.cue_card ? (
                      <View className="mt-4 gap-3">
                        <Text className="font-body text-sm leading-6 text-[#C8C4BC]">
                          <Text className="font-body-bold text-[#BFA06A]">Setup: </Text>
                          {exercise.cue_card.setup}
                        </Text>
                        <Text className="font-body text-sm leading-6 text-[#C8C4BC]">
                          <Text className="font-body-bold text-[#BFA06A]">Vector: </Text>
                          {exercise.cue_card.vector}
                        </Text>
                        <Text className="font-body text-sm leading-6 text-[#C8C4BC]">
                          <Text className="font-body-bold text-[#BFA06A]">Catch: </Text>
                          {exercise.cue_card.catch}
                        </Text>
                        <Text className="font-body text-sm leading-6 text-[#8A9488]">
                          <Text className="font-body-bold text-[#BFA06A]">Anti-pattern: </Text>
                          {exercise.cue_card.anti_pattern}
                        </Text>
                      </View>
                    ) : (
                      <Text className="mt-4 font-body text-sm leading-6 text-[#8A9488]">
                        Control the eccentric, own the catch, and stop when technique degrades.
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {ancillaryBlocks.length > 0 ? (
              <View className="gap-3">
                <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
                  Biological Maintenance
                </Text>
                {ancillaryBlocks.map((block) => (
                  <GameplanBlockCard
                    key={block.id}
                    block={block}
                    onPress={block.pillar === 'longevity' ? () => undefined : () => openBlock(block)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : !gameplanError ? (
          <View className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-10">
            <Text className="text-center font-body text-[10px] uppercase tracking-[0.28em] text-[#6B7568]">
              {compactDayLabel} · Recovery
            </Text>
            <Text className="mt-4 text-center font-display text-2xl leading-9 text-[#C8C4BC]">
              Biochemical Recovery Phase.
            </Text>
            <Text className="mt-3 text-center font-body text-sm leading-6 text-[#8A9488]">
              Today protects your nervous system, hydration and tissue adaptation. No Iron protocol is scheduled.
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => regenerateDailyGameplan()}
          disabled={gameplanLoading || performanceSyncing}
          accessibilityRole="button"
          accessibilityLabel="Recalibrate weekly protocol"
          className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 active:opacity-80"
        >
          <Text className="font-body-medium text-xs uppercase tracking-[0.24em] text-[#8A9488]">
            Recalibrate
          </Text>
          <Text className="mt-1 font-body text-xs leading-5 text-[#6B7568]">
            Rebuild this week&apos;s microcycle on-device
          </Text>
        </Pressable>
      </ScrollView>

      {isToday && ironBlock && ironExercises.length > 0 ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#0F1512] px-5 pb-5 pt-4">
          <Pressable
            onPress={() => openBlock(ironBlock)}
            disabled={gameplanLoading || performanceSyncing}
            accessibilityRole="button"
            accessibilityLabel="Start Iron protocol"
            className="rounded-2xl bg-[#BFA06A] py-4 active:opacity-85"
            style={{
              shadowColor: '#BFA06A',
              shadowOpacity: 0.24,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text className="text-center font-body-bold text-sm uppercase tracking-[0.22em] text-[#0F1512]">
              Iniciar Protocolo de Ferro
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
