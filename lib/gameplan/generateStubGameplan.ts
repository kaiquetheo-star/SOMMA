// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  dateForDayIndex,
  getDayIndexForDate,
  getWeekStartMonday,
  spreadTrainingDayIndices,
} from '@/lib/gameplan/microcycleWeek';
import type { DailyGameplan, GameplanBlock, MicrocycleDay } from '@/types/gameplan';
import type { EquipmentTag, FocusPreference } from '@/store/useSommaStore';
import { DEFAULT_TRAINING_DAYS_PER_WEEK } from '@/types/biological';
import { todayDateKey } from '@/lib/shared/dateUtils';

function ironSubtitle(equipment: EquipmentTag[]): string {
  if (equipment.includes('barbell') || equipment.includes('full_gym')) {
    return 'Barbell bench · 4×8 · AI load pending';
  }
  if (equipment.includes('dumbbells')) {
    return 'Dumbbell press · 4×10 · AI load pending';
  }
  return 'Push-up progression · 4×12 · bodyweight';
}

function createBlock(
  partial: Omit<GameplanBlock, 'order' | 'status'> & { order: number },
): GameplanBlock {
  return { ...partial, status: 'pending' };
}

/** Deterministic stub gameplan from foundation data until Edge Function ships */
export function generateStubGameplan(
  focus: FocusPreference,
  equipment: EquipmentTag[],
  trainingDaysPerWeek?: number,
): DailyGameplan {
  const blocks: GameplanBlock[] = [];
  let order = 0;

  blocks.push(
    createBlock({
      id: 'block-main-iron',
      pillar: 'iron',
      title: 'Main Ritual: Iron',
      subtitle: ironSubtitle(equipment),
      duration_minutes: 45,
      order: order++,
    }),
  );

  if (focus.nutrition > 0) {
    blocks.push(
      createBlock({
        id: 'block-nutrition-placeholder',
        pillar: 'nutrition',
        title: 'Nutrition Placeholder',
        subtitle: 'Fueling and recovery guidance coming soon',
        duration_minutes: 5,
        order: order++,
        nutrition: {
          goal: null,
          note: 'Future nutrition coaching placeholder',
        },
      }),
    );
  }

  const date = todayDateKey();
  const week_start_date = getWeekStartMonday(date);
  const training_days_per_week = trainingDaysPerWeek ?? DEFAULT_TRAINING_DAYS_PER_WEEK;
  const trainingIndices = new Set(spreadTrainingDayIndices(training_days_per_week));

  const microcycle: MicrocycleDay[] = Array.from({ length: 7 }, (_, index) => {
    const day_index = index + 1;
    const isTraining = trainingIndices.has(day_index);
    return {
      day_index,
      is_rest_day: !isTraining,
      focus_label: isTraining ? 'Stub protocol' : 'Rest & Recovery',
      date: dateForDayIndex(week_start_date, day_index),
      blocks: isTraining ? blocks : [],
    };
  });

  const todayIndex = getDayIndexForDate(date, week_start_date);
  const todayBlocks =
    microcycle.find((day) => day.day_index === todayIndex)?.blocks ?? [];

  return {
    date,
    week_start_date,
    training_days_per_week,
    microcycle,
    blocks: todayBlocks,
    generated_at: new Date().toISOString(),
  };
}

export function isProtocolDateStale(protocolDate: string | null): boolean {
  if (!protocolDate) return true;
  return protocolDate !== todayDateKey();
}

export function isGameplanStale(gameplan: DailyGameplan | null): boolean {
  if (!gameplan) return true;
  return isProtocolDateStale(gameplan.date);
}
