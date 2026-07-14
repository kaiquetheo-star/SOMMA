// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isProtocolDateStale(protocolDate: string | null): boolean {
  if (!protocolDate) return true;
  return protocolDate !== todayDateKey();
}
