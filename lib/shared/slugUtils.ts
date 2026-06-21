/** Shared slug normalization — single source of truth. */

export function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/-/g, '_');
}
