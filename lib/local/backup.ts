import * as DocumentPicker from 'expo-document-picker';

import { isProtocolDateStale } from '@/lib/gameplan/generateStubGameplan';
import {
  isDegenerateMicrocycle,
  sanitizeMicrocycleIronVolume,
} from '@/lib/gameplan/microcycleValidation';
import { getTodayDayIndex } from '@/lib/gameplan/microcycleWeek';
import type {
  EquipmentTag,
  FocusPreference,
  UserEnvironment,
  UserFoundation,
  UserStats,
} from '@/store/useSommaStore';
import {
  DEFAULT_TRAINING_DAYS_PER_WEEK,
  initialBiologicalProfile,
  normalizeBodyFatFields,
  type BiologicalProfile,
} from '@/types/biological';
import type { MicrocycleDay } from '@/types/gameplan';
import type {
  PerformanceLogEntry,
  PerformanceQueueItem,
  WorkoutSessionSummary,
} from '@/types/performance';

export const SOMMA_BACKUP_VERSION = 1;
export const SOMMA_STORAGE_KEY = 'somma-offline-store';

/** Fields mirrored from `useSommaStore` persist `partialize`. */
export interface SommaPersistedSnapshot {
  user_environment: UserEnvironment;
  user_stats: UserStats;
  user_foundation: UserFoundation;
  user_biological: BiologicalProfile;
  weeklyMicrocycle: MicrocycleDay[] | null;
  protocolDate: string | null;
  weekStartDate: string | null;
  protocolGeneratedAt: string | null;
  selectedDayIndex: number;
  readinessScanDate: string | null;
  subjectiveReadiness: number | null;
  performance_logs: PerformanceLogEntry[];
  performanceQueue: PerformanceQueueItem[];
  lastWorkoutSummary: WorkoutSessionSummary | null;
}

export interface SommaBackupFile {
  somma_backup_version: number;
  exported_at: string;
  storage_key: string;
  state: SommaPersistedSnapshot;
}

export function snapshotFromStoreState(state: {
  user_environment: UserEnvironment;
  user_stats: UserStats;
  user_foundation: UserFoundation;
  user_biological: BiologicalProfile;
  weeklyMicrocycle: MicrocycleDay[] | null;
  protocolDate: string | null;
  weekStartDate: string | null;
  protocolGeneratedAt: string | null;
  selectedDayIndex: number;
  readinessScanDate: string | null;
  subjectiveReadiness: number | null;
  performance_logs: PerformanceLogEntry[];
  performanceQueue: PerformanceQueueItem[];
  lastWorkoutSummary: WorkoutSessionSummary | null;
}): SommaPersistedSnapshot {
  return {
    user_environment: state.user_environment,
    user_stats: state.user_stats,
    user_foundation: state.user_foundation,
    user_biological: state.user_biological,
    weeklyMicrocycle: state.weeklyMicrocycle,
    protocolDate: state.protocolDate,
    weekStartDate: state.weekStartDate,
    protocolGeneratedAt: state.protocolGeneratedAt,
    selectedDayIndex: state.selectedDayIndex,
    readinessScanDate: state.readinessScanDate,
    subjectiveReadiness: state.subjectiveReadiness,
    performance_logs: state.performance_logs,
    performanceQueue: state.performanceQueue,
    lastWorkoutSummary: state.lastWorkoutSummary,
  };
}

export function buildSommaBackupFile(state: SommaPersistedSnapshot): SommaBackupFile {
  return {
    somma_backup_version: SOMMA_BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    storage_key: SOMMA_STORAGE_KEY,
    state,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractStatePayload(parsed: unknown): Record<string, unknown> | null {
  if (!isRecord(parsed)) return null;

  if (isRecord(parsed.state)) {
    return parsed.state;
  }

  if ('performance_logs' in parsed || 'user_biological' in parsed) {
    return parsed;
  }

  return null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Align imported rows with the same rules as persist `onRehydrateStorage`. */
export function normalizePersistedSnapshot(raw: unknown): SommaPersistedSnapshot | null {
  const payload = extractStatePayload(raw);
  if (!payload) return null;

  const user_biological: BiologicalProfile = {
    ...initialBiologicalProfile,
    ...(isRecord(payload.user_biological)
      ? (payload.user_biological as unknown as BiologicalProfile)
      : {}),
    training_days_per_week:
      (isRecord(payload.user_biological) &&
        typeof payload.user_biological.training_days_per_week === 'number'
        ? payload.user_biological.training_days_per_week
        : null) ?? DEFAULT_TRAINING_DAYS_PER_WEEK,
  };

  let weeklyMicrocycle: MicrocycleDay[] | null = asArray<MicrocycleDay>(payload.weeklyMicrocycle);
  if (weeklyMicrocycle.length === 0) {
    weeklyMicrocycle = null;
  }

  const weekStartDate = asStringOrNull(payload.weekStartDate);
  let protocolDate = asStringOrNull(payload.protocolDate);
  let protocolGeneratedAt = asStringOrNull(payload.protocolGeneratedAt);
  let selectedDayIndex =
    typeof payload.selectedDayIndex === 'number' ? payload.selectedDayIndex : getTodayDayIndex(weekStartDate);

  const legacyPlan =
    isRecord(payload.currentGameplan) || isRecord(payload.daily_gameplan)
      ? ((payload.currentGameplan ?? payload.daily_gameplan) as {
          microcycle?: MicrocycleDay[];
          date?: string;
          week_start_date?: string;
          generated_at?: string;
        })
      : null;

  if (!weeklyMicrocycle?.length && legacyPlan?.microcycle?.length) {
    weeklyMicrocycle = legacyPlan.microcycle;
    protocolDate = legacyPlan.date ?? protocolDate;
    protocolGeneratedAt = legacyPlan.generated_at ?? protocolGeneratedAt;
  }

  if (weeklyMicrocycle?.length) {
    weeklyMicrocycle = sanitizeMicrocycleIronVolume(weeklyMicrocycle);
  }

  if (!selectedDayIndex) {
    selectedDayIndex = getTodayDayIndex(weekStartDate);
  } else if (isProtocolDateStale(protocolDate)) {
    selectedDayIndex = getTodayDayIndex(weekStartDate);
  }

  let readinessScanDate = asStringOrNull(payload.readinessScanDate);
  let subjectiveReadiness = asNumberOrNull(payload.subjectiveReadiness);
  const today = new Date().toISOString().slice(0, 10);
  if (readinessScanDate && readinessScanDate !== today) {
    readinessScanDate = null;
    subjectiveReadiness = null;
  }

  const expectedTraining =
    user_biological.training_days_per_week ?? DEFAULT_TRAINING_DAYS_PER_WEEK;
  if (weeklyMicrocycle && isDegenerateMicrocycle(weeklyMicrocycle, expectedTraining)) {
    weeklyMicrocycle = null;
    protocolDate = null;
    protocolGeneratedAt = null;
  }

  const user_environment: UserEnvironment = {
    available_equipment: asArray<EquipmentTag>(
      isRecord(payload.user_environment) ? payload.user_environment.available_equipment : [],
    ),
    updated_at: isRecord(payload.user_environment)
      ? asStringOrNull(payload.user_environment.updated_at)
      : null,
  };

  const user_stats: UserStats = {
    iron_sessions_completed:
      isRecord(payload.user_stats) && typeof payload.user_stats.iron_sessions_completed === 'number'
        ? payload.user_stats.iron_sessions_completed
        : 0,
    nutrition_checkins_completed:
      isRecord(payload.user_stats) && typeof payload.user_stats.nutrition_checkins_completed === 'number'
        ? payload.user_stats.nutrition_checkins_completed
        : 0,
  };

  const user_foundation: UserFoundation = {
    focus_preference: isRecord(payload.user_foundation)
      ? (payload.user_foundation.focus_preference as FocusPreference | null)
      : null,
    foundation_completed_at: isRecord(payload.user_foundation)
      ? asStringOrNull(payload.user_foundation.foundation_completed_at)
      : null,
  };

  const user_biological_merged: BiologicalProfile = {
    ...user_biological,
    ...normalizeBodyFatFields(user_biological),
  };

  return {
    user_environment,
    user_stats,
    user_foundation,
    user_biological: user_biological_merged,
    weeklyMicrocycle: weeklyMicrocycle?.length ? weeklyMicrocycle : null,
    protocolDate,
    weekStartDate,
    protocolGeneratedAt,
    selectedDayIndex,
    readinessScanDate,
    subjectiveReadiness,
    performance_logs: asArray<PerformanceLogEntry>(payload.performance_logs),
    performanceQueue: asArray<PerformanceQueueItem>(payload.performanceQueue),
    lastWorkoutSummary: (payload.lastWorkoutSummary as WorkoutSessionSummary | null) ?? null,
  };
}

export function parseSommaBackupJson(text: string): SommaBackupFile | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const state = normalizePersistedSnapshot(parsed);
    if (!state) return null;

    if (isRecord(parsed) && typeof parsed.somma_backup_version === 'number') {
      return {
        somma_backup_version: parsed.somma_backup_version,
        exported_at:
          typeof parsed.exported_at === 'string' ? parsed.exported_at : new Date().toISOString(),
        storage_key:
          typeof parsed.storage_key === 'string' ? parsed.storage_key : SOMMA_STORAGE_KEY,
        state,
      };
    }

    return buildSommaBackupFile(state);
  } catch {
    return null;
  }
}

export function downloadSommaBackup(file: SommaBackupFile): void {
  const json = JSON.stringify(file, null, 2);
  const filename = `somma-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (typeof document === 'undefined') {
    throw new Error('Export is only available in the browser.');
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function pickSommaBackupJson(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  const response = await fetch(result.assets[0].uri);
  if (!response.ok) {
    throw new Error('Could not read the selected file.');
  }

  return response.text();
}
