/** Shared blueprint matching helpers — single source of truth. */

import type { IronDayBlueprintKey } from '@/lib/gameplan/engine/goldStandardBlueprint';
import { normalizeSlug } from '@/lib/shared/slugUtils';

export type { IronDayBlueprintKey };

export function inferIronDayBlueprintKey(focusLabel: string): IronDayBlueprintKey {
  const lower = focusLabel.toLowerCase();
  if (lower.includes('push')) return 'push';
  if (lower.includes('pull')) return 'pull';
  if (lower.includes('leg')) return 'legs';
  if (lower.includes('upper')) return 'upper';
  if (lower.includes('lower')) return 'lower';
  return 'full';
}

export function isTricepsMuscle(row: { primary_muscle?: string | null; name: string; slug: string }): boolean {
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return /tricep|pushdown/.test(blob);
}

export function isBicepsMuscle(row: { primary_muscle?: string | null; name: string; slug: string }): boolean {
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return /bicep|curl|brachialis/.test(blob) && !/leg curl|tricep/.test(blob);
}

export function normalizeSlugForCatalog(slug: string): string {
  return normalizeSlug(slug);
}
