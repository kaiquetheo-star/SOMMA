import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';

import { ExerciseCueCard } from '@/components/iron/ExerciseCueCard';
import { RirSelector } from '@/components/iron/RirSelector';
import { RestTimerOverlay } from '@/components/iron/RestTimerOverlay';
import { ValueStepper } from '@/components/iron/ValueStepper';
import { LoadingFallback } from '@/components/routing/LoadingFallback';
import { WorkoutShell } from '@/components/workout/WorkoutShell';
import {
  resolveIronExercise,
  type IronExerciseTemplate,
} from '@/constants/iron-exercises';
import { useRequireDailyScan } from '@/hooks/useRequireDailyScan';
import { useStoreHydrating } from '@/hooks/useStoreHydrated';
import { useWorkoutBlockReady } from '@/hooks/useWorkoutBlockReady';
import { useWorkoutNavigation } from '@/hooks/useWorkoutNavigation';
import { useRestTimer } from '@/hooks/useRestTimer';
import {
  fetchLibraryExercises,
  getExerciseById,
  type LibraryExercise,
} from '@/lib/catalog/library';
import { unlockRestTimerAudio } from '@/lib/audio/restTimerChime';
import {
  ironExerciseLogsFromPendingSession,
  lastLoggedWeightFromPerformanceHistory,
} from '@/lib/iron/lastLoggedWeight';
import { resolveIronExerciseView } from '@/lib/iron/resolveExercise';
import { hapticSetLogged } from '@/lib/haptics';
import { targetWeightFromPassport } from '@/lib/physics/rmCalculator';
import type { IronExerciseBiomechanics } from '@/types/catalog';
import type { IronExercisePrescription } from '@/types/gameplan';
import type { IronSetLog } from '@/types/performance';
import { useSommaStore } from '@/store/useSommaStore';

type IronPhase = 'lifting' | 'rir_gate' | 'resting' | 'done';

interface PendingSetCapture {
  weight_kg: number;
  reps: number;
}

interface ExerciseDraft {
  weight: number;
  reps: number;
  logs: IronSetLog[];
  currentSet: number;
  phase: IronPhase;
  pendingSet: PendingSetCapture | null;
  pendingReportedRir: number | null;
  restBeforeSet: number;
}

const DEFAULT_REST_SECONDS = 90;

function draftKey(index: number, exerciseId: string): string {
  return `${index}:${exerciseId}`;
}

function lastLoggedWeightFromSession(
  exerciseId: string,
  sessionLogs: { exercise_id: string; sets: IronSetLog[] }[],
): number | null {
  const entry = sessionLogs.find((row) => row.exercise_id === exerciseId);
  const lastSet = entry?.sets[entry.sets.length - 1];
  return lastSet?.weight_kg != null && lastSet.weight_kg > 0 ? lastSet.weight_kg : null;
}

function biomechanicsFromLibrary(library: LibraryExercise | null): IronExerciseBiomechanics | null {
  if (!library?.primary_muscle && library?.cns_fatigue_cost == null) return null;
  return {
    primary_muscle: library.primary_muscle,
    synergist_muscles: library.synergist_muscles,
    cns_fatigue_cost: library.cns_fatigue_cost,
    joint_stress_profile: library.joint_stress_profile,
    stretch_mediated_hypertrophy: library.stretch_mediated_hypertrophy,
  };
}

function stubPrescriptionFromTemplate(
  template: IronExerciseTemplate,
  biological: ReturnType<typeof useSommaStore.getState>['user_biological'],
): IronExercisePrescription {
  const targetWeightKg = targetWeightFromPassport(biological, {
    id: template.id,
    name: template.name,
    equipment_required: template.equipment_required,
  });

  return {
    exercise_id: template.id,
    target_sets: template.total_sets,
    target_reps: template.target_reps,
    target_weight_kg: targetWeightKg,
    target_rep_range: `${template.target_reps - 2}-${template.target_reps} @ 2 RIR`,
    target_rir: 2,
    rest_seconds: template.rest_seconds,
    alternative_exercise_id: null,
  };
}

export default function IronModeScreen() {
  const { blockId, title } = useLocalSearchParams<{ blockId?: string; title?: string }>();
  useRequireDailyScan({ blockId, title, pillar: 'iron' });
  const { activeBlock, isReady, waitingForBlock } = useWorkoutBlockReady(blockId);
  const isHydrating = useStoreHydrating();
  const { finishBlock } = useWorkoutNavigation();
  const equipment = useSommaStore((state) => state.user_environment.available_equipment);
  const userBiological = useSommaStore((state) => state.user_biological);
  const performanceLogs = useSommaStore((state) => state.performance_logs);
  const pendingSession = useSommaStore((state) => state.pendingSession);
  const logIronSet = useSommaStore((state) => state.logIronSet);

  const localFallback = useMemo(() => resolveIronExercise(equipment), [equipment]);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalog, setCatalog] = useState<LibraryExercise[]>([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [adaptedOverrideByIndex, setAdaptedOverrideByIndex] = useState<Record<number, string>>(
    {},
  );
  const [currentSet, setCurrentSet] = useState(1);
  const [weight, setWeight] = useState(localFallback.target_weight_kg);
  const [reps, setReps] = useState(localFallback.target_reps);
  const [logs, setLogs] = useState<IronSetLog[]>([]);
  const [phase, setPhase] = useState<IronPhase>('lifting');
  const [pendingSet, setPendingSet] = useState<PendingSetCapture | null>(null);
  const [pendingReportedRir, setPendingReportedRir] = useState<number | null>(null);
  const [restBeforeSet, setRestBeforeSet] = useState(0);
  const [allExerciseLogs, setAllExerciseLogs] = useState<
    { exercise_id: string; exercise_name: string; sets: IronSetLog[] }[]
  >([]);
  const exerciseDraftsRef = useRef<Record<string, ExerciseDraft>>({});
  const activeExerciseKeyRef = useRef<string | null>(null);
  const restoredPendingSessionRef = useRef<string | null>(null);

  const resolvedBlockId = blockId ?? 'block-main-iron';
  const prescriptions = activeBlock?.iron?.exercises ?? [];

  useEffect(() => {
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
    if (!isDev) return;
    const state = useSommaStore.getState();
    const ironBlock = state.weeklyMicrocycle
      ?.flatMap((day) => day.blocks ?? [])
      .find((block) => block.pillar === 'iron');
    console.log('[SOMMA Iron] mount', {
      isHydrating: state.isHydrating,
      performance_logs_length: state.performance_logs.length,
      iron_exercises_length: ironBlock?.iron?.exercises?.length ?? prescriptions.length,
    });
  }, [isHydrating, prescriptions.length]);

  const exerciseQueue = useMemo(() => {
    if (!prescriptions.length) {
      const fallbackPrescription = stubPrescriptionFromTemplate(localFallback, userBiological);
      return [
        resolveIronExerciseView({
          prescription: fallbackPrescription,
          library: null,
          fallbackName: localFallback.name,
          fallbackWeight: fallbackPrescription.target_weight_kg ?? 0,
          fallbackReps: localFallback.target_reps,
          fallbackSets: localFallback.total_sets,
          libraryCatalog: catalog,
        }),
      ];
    }

    return prescriptions.map((prescription, index) => {
      const overrideId = adaptedOverrideByIndex[index];
      const activeId = overrideId ?? prescription.exercise_id;
      const libraryRow = getExerciseById(catalog, activeId);
      const exerciseSlug = prescription.slug ?? libraryRow?.slug ?? null;
      const historyKg = lastLoggedWeightFromPerformanceHistory(
        activeId,
        performanceLogs,
        pendingSession,
        resolvedBlockId,
        exerciseSlug,
      );
      return resolveIronExerciseView({
        prescription,
        library: libraryRow,
        fallbackName: localFallback.name,
        fallbackWeight: prescription.target_weight_kg ?? historyKg ?? 0,
        fallbackReps: prescription.target_reps,
        fallbackSets: prescription.target_sets,
        exerciseIdOverride: overrideId,
        libraryCatalog: catalog,
      });
    });
  }, [
    prescriptions,
    catalog,
    localFallback,
    userBiological,
    adaptedOverrideByIndex,
    performanceLogs,
    pendingSession,
    resolvedBlockId,
  ]);

  const exercise = exerciseQueue[exerciseIndex] ?? exerciseQueue[0];
  const activeLibrary = useMemo(
    () => getExerciseById(catalog, exercise?.exercise_id ?? ''),
    [catalog, exercise?.exercise_id],
  );
  const totalSets = exercise?.target_sets ?? 4;
  const activePrescription = prescriptions[exerciseIndex];

  const prescribedTargetKg = useMemo(() => {
    const raw = prescriptions.length ? activePrescription?.target_weight_kg : null;
    return raw != null && raw > 0 ? raw : null;
  }, [prescriptions.length, activePrescription?.target_weight_kg]);

  const isBodyweight = weight <= 0;
  const exerciseComplete = logs.length >= totalSets;

  useEffect(() => {
    if (restoredPendingSessionRef.current === resolvedBlockId) return;
    const restored = ironExerciseLogsFromPendingSession(pendingSession, resolvedBlockId);
    if (restored.length === 0) return;

    restoredPendingSessionRef.current = resolvedBlockId;
    setAllExerciseLogs(restored);
  }, [pendingSession, resolvedBlockId]);

  useEffect(() => {
    if (!exercise) return;
    const key = draftKey(exerciseIndex, exercise.exercise_id);
    const prevKey = activeExerciseKeyRef.current;

    if (prevKey !== key) {
      activeExerciseKeyRef.current = key;
      const saved = exerciseDraftsRef.current[key];
      if (saved) {
        setWeight(saved.weight);
        setReps(saved.reps);
        setLogs(saved.logs);
        setCurrentSet(saved.currentSet);
        setPhase(saved.phase);
        setPendingSet(saved.pendingSet);
        setPendingReportedRir(saved.pendingReportedRir);
        setRestBeforeSet(saved.restBeforeSet);
        return;
      }

      const sessionWeight = lastLoggedWeightFromSession(exercise.exercise_id, allExerciseLogs);
      const historyWeight = lastLoggedWeightFromPerformanceHistory(
        exercise.exercise_id,
        performanceLogs,
        pendingSession,
        resolvedBlockId,
        exercise.exercise_slug,
      );
      const baseline =
        sessionWeight ??
        historyWeight ??
        (prescribedTargetKg != null && prescribedTargetKg > 0
          ? prescribedTargetKg
          : exercise.target_weight_kg);

      setWeight(baseline);
      setReps(exercise.target_reps);
      setCurrentSet(1);
      setLogs([]);
      setPhase('lifting');
      setPendingSet(null);
      setPendingReportedRir(null);
      setRestBeforeSet(0);
      return;
    }

    exerciseDraftsRef.current[key] = {
      weight,
      reps,
      logs,
      currentSet,
      phase,
      pendingSet,
      pendingReportedRir,
      restBeforeSet,
    };
  }, [
    allExerciseLogs,
    currentSet,
    exercise,
    exerciseIndex,
    logs,
    pendingReportedRir,
    pendingSession,
    pendingSet,
    performanceLogs,
    phase,
    prescribedTargetKg,
    reps,
    resolvedBlockId,
    restBeforeSet,
    weight,
  ]);

  useEffect(() => {
    let mounted = true;
    void fetchLibraryExercises()
      .then((rows) => {
        if (mounted) setCatalog(rows);
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const onRestComplete = useCallback(() => {
    if (!exercise) return;
    setRestBeforeSet(exercise.rest_seconds);
    if (currentSet >= totalSets) {
      setPhase('done');
      return;
    }
    setCurrentSet((s) => s + 1);
    setPhase('lifting');
  }, [currentSet, totalSets, exercise]);

  const { remaining, isActive, start, skip } = useRestTimer({ onComplete: onRestComplete });

  const handleAdapt = () => {
    const altId = exercise?.alternative_exercise_id;
    if (!altId || altId === exercise.exercise_id) {
      Alert.alert(
        'No alternative',
        'This movement has no pre-mapped swap in today’s protocol. Recalibrate to refresh options.',
      );
      return;
    }

    const altLibrary = getExerciseById(catalog, altId);
    if (!altLibrary) {
      Alert.alert('Catalog loading', 'Exercise encyclopedia not ready — try again in a moment.');
      return;
    }

    setAdaptedOverrideByIndex((prev) => ({ ...prev, [exerciseIndex]: altId }));
    setWeight(
      prescriptions?.[exerciseIndex]?.target_weight_kg ?? localFallback.target_weight_kg,
    );
    setReps(prescriptions?.[exerciseIndex]?.target_reps ?? localFallback.target_reps);
    setCurrentSet(1);
    setLogs([]);
    setPhase('lifting');
    setPendingSet(null);
    setPendingReportedRir(null);
    setRestBeforeSet(0);
    skip();
  };

  const handleSkipRest = () => {
    if (!exercise) return;
    setRestBeforeSet(Math.max(0, exercise.rest_seconds - remaining));
    skip();
  };

  const handleLogSet = () => {
    if (!exercise) return;
    setPendingSet({ weight_kg: weight, reps });
    setPendingReportedRir(null);
    setPhase('rir_gate');
  };

  const commitSetWithRir = async (reportedRir: number) => {
    if (!exercise || !pendingSet) return;

    const entry: IronSetLog = {
      set_index: currentSet,
      weight_kg: pendingSet.weight_kg,
      reps: pendingSet.reps,
      target_reps: exercise.target_reps,
      target_rir: exercise.target_rir,
      reported_rir: reportedRir,
      rest_seconds_used: restBeforeSet,
      logged_at: new Date().toISOString(),
    };
    setRestBeforeSet(0);
    setPendingSet(null);
    setPendingReportedRir(null);

    setLogs((prev) => [...prev, entry]);
    logIronSet({
      block_id: resolvedBlockId,
      exercise_id: exercise.exercise_id,
      exercise_slug: exercise.exercise_slug,
      exercise_name: exercise.name,
      set: entry,
      target_rir: exercise.target_rir,
    });

    // Close the RIR gate and start the rest timer immediately after logging —
    // before the haptic await so the UI responds without delay.
    if (currentSet >= totalSets) {
      setPhase('done');
    } else {
      setPhase('resting');
      start(exercise.rest_seconds);
    }

    await hapticSetLogged();
  };

  const handleConfirmRir = () => {
    if (pendingReportedRir == null) return;
    unlockRestTimerAudio();
    void commitSetWithRir(pendingReportedRir);
  };

  const advanceToNextExercise = () => {
    if (!exercise) return;

    setAllExerciseLogs((prev) => [
      ...prev,
      {
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.name,
        sets: logs,
      },
    ]);

    if (exerciseIndex < exerciseQueue.length - 1) {
      setExerciseIndex((index) => index + 1);
      return;
    }

    handleCompleteRitual([
      ...allExerciseLogs,
      { exercise_id: exercise.exercise_id, exercise_name: exercise.name, sets: logs },
    ]);
  };

  const handleCompleteRitual = (
    completedExercises = allExerciseLogs,
  ) => {
    const lastExercise = completedExercises[completedExercises.length - 1];
    const lastSet = lastExercise?.sets[lastExercise.sets.length - 1];

    finishBlock(resolvedBlockId, {
      pillar: 'iron',
      exercise_id: lastExercise?.exercise_id ?? exercise?.exercise_id ?? null,
      weight_used: lastSet?.weight_kg ?? null,
      reps_completed: (lastExercise?.sets ?? logs).reduce((sum, set) => sum + set.reps, 0),
      volume: completedExercises.reduce(
        (sum, entry) => sum + entry.sets.reduce((inner, set) => inner + set.reps, 0),
        0,
      ),
      actual_rest_seconds: lastSet?.rest_seconds_used ?? null,
    });
  };

  const canLogSet = phase === 'lifting' && !exerciseComplete;
  const inRirGate = phase === 'rir_gate' && pendingSet != null;
  const canCompleteExercise = exerciseComplete;
  const isLastExercise = exerciseIndex >= exerciseQueue.length - 1;
  const canCompleteRitual = canCompleteExercise && isLastExercise;
  const canAdvanceExercise = canCompleteExercise && !isLastExercise;

  if (isHydrating) {
    return (
      <LoadingFallback
        message="Restoring your session logs…"
        eyebrow="Iron · Strength"
      />
    );
  }

  if (!isReady || waitingForBlock) {
    return (
      <LoadingFallback
        message="Loading iron prescription…"
        eyebrow="Iron · Strength"
      />
    );
  }

  if (catalogLoading && prescriptions.length > 0) {
    return (
      <WorkoutShell eyebrow="Iron · Strength" title={title ?? 'Iron Mode'} accent="obsidian">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#BFA06A" />
          <Text className="mt-4 font-body text-sm text-[#8A9488]">Loading encyclopedia…</Text>
        </View>
      </WorkoutShell>
    );
  }

  return (
    <WorkoutShell
      eyebrow="Iron · Strength"
      title={title ?? 'Iron Mode'}
      accent="obsidian"
      onComplete={canCompleteRitual ? () => handleCompleteRitual() : undefined}
      completeDisabled={!canCompleteRitual}
      completeLabel={
        canCompleteRitual
          ? 'Complete Ritual'
          : canAdvanceExercise
            ? 'Next movement'
            : `Log ${totalSets} sets to finish`
      }
    >
      <View className="relative flex-1">
        {isActive ? (
          <RestTimerOverlay
            remaining={remaining}
            total={exercise?.rest_seconds ?? DEFAULT_REST_SECONDS}
            onSkip={handleSkipRest}
          />
        ) : null}

        <FlatList
          data={exerciseQueue}
          keyExtractor={(item, index) => `${item.exercise_id}-${index}`}
          showsVerticalScrollIndicator
          contentContainerClassName={`gap-5 ${canLogSet || inRirGate ? 'pb-36' : 'pb-4'}`}
          ListHeaderComponent={
            <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
              {exerciseQueue.length > 1
                ? `Full protocol · ${exerciseQueue.length} movements — scroll & tap to switch`
                : 'Prescribed movement'}
            </Text>
          }
          renderItem={({ item: queuedExercise, index }) => {
            const isActive = index === exerciseIndex;
            const queuedLibrary = getExerciseById(catalog, queuedExercise.exercise_id);
            const itemCanAdapt =
              Boolean(queuedExercise.alternative_exercise_id) &&
              queuedExercise.alternative_exercise_id !== queuedExercise.exercise_id;
            const cardClass = `gap-3 rounded-2xl border px-4 py-4 ${
              isActive
                ? 'border-matte-gold/35 bg-matte-gold/[0.06]'
                : 'border-white/8 bg-white/[0.02] opacity-80'
            }`;

            if (!isActive) {
              return (
                <Pressable
                  onPress={() => {
                    if (phase !== 'resting') setExerciseIndex(index);
                  }}
                  className={cardClass}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                        Movement {index + 1} of {exerciseQueue.length}
                      </Text>
                      <Text className="mt-2 font-display-bold text-lg text-[#E8E4DC]">
                        {queuedExercise.name}
                      </Text>
                      <Text className="mt-2 font-body text-sm text-[#8A9488]">
                        {queuedExercise.target_rep_range}
                      </Text>
                      <Text className="mt-1 font-body text-[10px] uppercase tracking-[0.25em] text-[#6B7568]">
                        {queuedExercise.target_sets} sets × {queuedExercise.target_reps} reps
                        {queuedExercise.execution_technique
                          ? ` · ${queuedExercise.execution_technique}`
                          : ''}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }

            return (
              <View className={cardClass}>
                <View className="gap-1">
                  <Text className="font-body text-[10px] uppercase tracking-[0.32em] text-[#6B7568]">
                    Movement {index + 1}/{exerciseQueue.length}
                  </Text>
                  <Text className="font-display-bold text-2xl leading-8 text-[#E8E4DC]">
                    {queuedExercise.name}
                  </Text>
                  <Text className="font-body text-[10px] uppercase tracking-[0.28em] text-matte-gold/80">
                    Set {Math.min(currentSet, totalSets)}/{totalSets}
                    {exerciseComplete ? ' · Complete' : ''}
                  </Text>
                </View>

                <ExerciseCueCard
                  instructions={queuedExercise.instructions ?? {}}
                  progressionNote={queuedExercise.progression_note}
                  biomechanics={biomechanicsFromLibrary(queuedLibrary)}
                />

                <View className="flex-row justify-end">
                      <Pressable
                        onPress={handleAdapt}
                        disabled={phase === 'resting' || !itemCanAdapt}
                        className={`rounded-xl border px-3 py-2 active:opacity-80 ${
                          itemCanAdapt
                            ? 'border-matte-gold/30 bg-matte-gold/10'
                            : 'border-white/10 bg-white/5 opacity-40'
                        }`}
                      >
                        <Text className="font-body text-[10px] uppercase tracking-[0.2em] text-matte-gold">
                          Adapt
                        </Text>
                      </Pressable>
                    </View>

                    {itemCanAdapt && activeLibrary ? (
                      <Text className="font-body text-xs text-[#6B7568]">
                        Swap ready ·{' '}
                        {getExerciseById(catalog, queuedExercise.alternative_exercise_id!)?.name ??
                          'alternative'}
                      </Text>
                    ) : null}

                <ValueStepper
                  label="Load"
                  value={weight}
                  unit={isBodyweight ? 'BW' : 'kg'}
                  step={isBodyweight ? 0 : 2.5}
                  min={0}
                  max={300}
                  onChange={setWeight}
                  disabled={!canLogSet || exerciseComplete}
                  allowDirectInput
                />

                <ValueStepper
                  label="Reps"
                  value={reps}
                  step={1}
                  min={1}
                  max={50}
                  onChange={setReps}
                  disabled={!canLogSet || exerciseComplete}
                  allowDirectInput
                />

                {logs.length > 0 ? (
                      <View className="gap-2">
                        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                          Logged sets
                        </Text>
                        {logs.map((log) => (
                          <View
                            key={`${log.set_index}-${log.logged_at}`}
                            className="flex-row justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3"
                          >
                            <Text className="font-body text-sm text-[#8A9488]">
                              Set {log.set_index}
                            </Text>
                            <Text className="font-body-medium text-sm text-[#E8E4DC]">
                              {log.weight_kg > 0 ? `${log.weight_kg} kg` : 'BW'} × {log.reps}
                              {log.reported_rir != null || log.rir != null
                                ? ` · ${log.reported_rir ?? log.rir} RIR`
                                : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                ) : null}

                {canAdvanceExercise ? (
                  <Pressable
                    onPress={advanceToNextExercise}
                    className="overflow-hidden rounded-2xl border border-matte-gold/40 bg-matte-gold/10 px-8 py-4 active:opacity-80"
                  >
                    <Text className="text-center font-body-medium text-sm uppercase tracking-[0.35em] text-matte-gold">
                      Next movement →
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />

        {inRirGate ? (
          <View className="absolute bottom-0 left-0 right-0 gap-4 rounded-2xl border border-matte-gold/35 bg-[#0A0E0C]/95 px-6 py-5">
            <RirSelector
              value={pendingReportedRir}
              prescribedRir={exercise?.target_rir ?? 2}
              onChange={setPendingReportedRir}
            />
            <Pressable
              onPress={handleConfirmRir}
              disabled={pendingReportedRir == null}
              className={`overflow-hidden rounded-2xl border px-8 py-4 active:opacity-80 ${
                pendingReportedRir != null
                  ? 'border-matte-gold/50 bg-matte-gold/15'
                  : 'border-white/10 bg-white/5 opacity-50'
              }`}
            >
              <Text className="text-center font-body-medium text-sm uppercase tracking-[0.35em] text-matte-gold">
                Confirm set {currentSet}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {exerciseComplete && !inRirGate && !isActive ? (
          <View className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-2xl border border-matte-gold bg-matte-gold px-8 py-5">
            <Text className="text-center font-display-bold text-sm uppercase tracking-[0.35em] text-obsidian">
              Exercise completed
            </Text>
          </View>
        ) : null}

        {canLogSet ? (
          <Pressable
            onPress={handleLogSet}
            className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-2xl border border-matte-gold/50 bg-matte-gold/15 px-8 py-5 active:opacity-80"
          >
            <Text className="text-center font-body-medium text-sm uppercase tracking-[0.35em] text-matte-gold">
              Log Set {currentSet}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </WorkoutShell>
  );
}
