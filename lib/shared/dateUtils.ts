/** Shared date helpers — single source of truth for ISO date-key patterns. */

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dateKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
