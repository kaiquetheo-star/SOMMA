import type { LibraryFlowSpiritSession } from '@/types/catalog';

/** Parse "Boat (Navasana)" → english + sanskrit labels */
export function parseFlowSessionNames(sessionName: string): {
  englishName: string;
  sanskritName: string | null;
} {
  const match = sessionName.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { englishName: match[1].trim(), sanskritName: match[2].trim() };
  }
  return { englishName: sessionName.trim(), sanskritName: null };
}

/** Build InstructionPanel-ready cues from flow catalog row (text-only Elite) */
export function flowSpiritInstructions(
  row: LibraryFlowSpiritSession,
): Record<string, string> {
  if (row.biomechanical_instructions && Object.keys(row.biomechanical_instructions).length > 0) {
    return row.biomechanical_instructions;
  }

  const instructions: Record<string, string> = {};
  if (row.description?.trim()) {
    instructions.setup = row.description.trim();
  }
  if (row.target_recovery_zones.length > 0) {
    instructions.cues = row.target_recovery_zones
      .map((zone) => zone.replace(/_/g, ' '))
      .join(' · ');
  }
  return instructions;
}
