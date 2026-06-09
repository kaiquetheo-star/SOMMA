import { Text, View } from 'react-native';

import type { MicrocycleDay } from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';

interface ConsistencyCalendarProps {
  performanceLogs: PerformanceLogEntry[];
  weeklyMicrocycle: MicrocycleDay[] | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MATTE_GOLD = '#BFA06A';

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastThirtyDays(): string[] {
  const today = new Date();
  const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start.getTime() - (29 - index) * DAY_MS);
    return dateKey(day);
  });
}

function dayLabel(date: string): string {
  return String(Number(date.slice(-2)));
}

function collectCompletedDates(
  performanceLogs: PerformanceLogEntry[],
  weeklyMicrocycle: MicrocycleDay[] | null,
): Set<string> {
  const completed = new Set<string>();

  for (const log of performanceLogs) {
    if (log.timestamp) completed.add(log.timestamp.slice(0, 10));
  }

  for (const day of weeklyMicrocycle ?? []) {
    const hasCompletedBlock = (day.blocks ?? []).some((block) => block.status === 'completed');
    if (hasCompletedBlock && day.date) completed.add(day.date);

    for (const block of day.blocks ?? []) {
      if (block.completed_at) completed.add(block.completed_at.slice(0, 10));
    }
  }

  return completed;
}

export function ConsistencyCalendar({
  performanceLogs,
  weeklyMicrocycle,
}: ConsistencyCalendarProps) {
  const days = lastThirtyDays();
  const completedDates = collectCompletedDates(performanceLogs, weeklyMicrocycle);
  const completedCount = days.filter((day) => completedDates.has(day)).length;

  return (
    <View className="rounded-3xl border border-white/10 bg-[#0F1512] p-5">
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
            Consistency Matrix
          </Text>
          <Text className="mt-2 font-display text-2xl text-[#E8E4DC]">
            Últimos 30 dias
          </Text>
        </View>
        <Text className="font-body-medium text-xs uppercase tracking-[0.25em] text-matte-gold">
          {completedCount}/30
        </Text>
      </View>

      <View className="mt-5 flex-row flex-wrap gap-2">
        {days.map((day) => {
          const completed = completedDates.has(day);
          return (
            <View key={day} className="items-center gap-1">
              <View
                className="h-5 w-5 rounded-md border"
                style={{
                  backgroundColor: completed ? MATTE_GOLD : 'rgba(255,255,255,0.06)',
                  borderColor: completed ? MATTE_GOLD : 'rgba(255,255,255,0.08)',
                  opacity: completed ? 0.95 : 0.55,
                }}
              />
              <Text className="font-body text-[9px] text-[#6B7568]">{dayLabel(day)}</Text>
            </View>
          );
        })}
      </View>

      <Text className="mt-4 font-body text-xs leading-5 text-[#8A9488]">
        Cada ponto dourado representa pelo menos um bloco ou sessão concluída no dia.
      </Text>
    </View>
  );
}
