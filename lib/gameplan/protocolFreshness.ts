function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isProtocolDateStale(protocolDate: string | null): boolean {
  if (!protocolDate) return true;
  return protocolDate !== todayDateKey();
}
