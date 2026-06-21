/** Week helpers for Edge Functions. Canonical source: lib/gameplan/microcycleWeek.ts — keep in sync. */

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekStartMonday(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function getDayIndexForDate(dateKey: string, weekStartDate: string): number {
  const date = new Date(`${dateKey}T12:00:00`);
  const start = new Date(`${weekStartDate}T12:00:00`);
  if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime())) return 1;
  const diffDays = Math.round((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.min(7, Math.max(1, diffDays + 1));
}
