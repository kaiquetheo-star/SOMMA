#!/usr/bin/env -S npx tsx
/**
 * Extract Elite hypertrophy rows from supabase/seed_hypertrophy.sql
 * into a typed offline catalog: lib/catalog/eliteCatalog.ts
 *
 * Usage: npx tsx scripts/extractEliteCatalog.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SEED_PATH = join(ROOT, 'supabase', 'seed_hypertrophy.sql');
const OUT_PATH = join(ROOT, 'lib', 'catalog', 'eliteCatalog.ts');

const COLUMN_ORDER = [
  'slug',
  'name',
  'biomechanical_instructions',
  'equipment_required',
  'default_sets',
  'default_reps',
  'movement_pattern',
  'primary_muscle',
  'synergist_muscles',
  'cns_fatigue_cost',
  'joint_stress_profile',
  'stretch_mediated_hypertrophy',
] as const;

type SeedColumn = (typeof COLUMN_ORDER)[number];

interface EliteSeedRow {
  slug: string;
  name: string;
  biomechanical_instructions: Record<string, string>;
  equipment_required: string[];
  default_sets: number;
  default_reps: number;
  movement_pattern: string;
  primary_muscle: string;
  synergist_muscles: string[];
  cns_fatigue_cost: number;
  joint_stress_profile: string;
  stretch_mediated_hypertrophy: boolean;
}

/** Stable UUID5-style id from slug (deterministic offline identity). */
function eliteIdFromSlug(slug: string): string {
  const hex = createHash('sha1').update(`somma.elite.library_exercises:${slug}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join('-');
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function findValuesBlock(sql: string): string {
  const cleaned = stripSqlComments(sql);
  const insertMatch = cleaned.match(
    /insert\s+into\s+public\.library_exercises\s*\(([\s\S]*?)\)\s*values\s*/i,
  );
  if (!insertMatch || insertMatch.index == null) {
    throw new Error('Could not locate INSERT INTO public.library_exercises … VALUES');
  }

  const columnsRaw = insertMatch[1]!;
  const declared = columnsRaw
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (declared.join(',') !== COLUMN_ORDER.join(',')) {
    throw new Error(
      `Unexpected column order.\nExpected: ${COLUMN_ORDER.join(', ')}\nGot: ${declared.join(', ')}`,
    );
  }

  const valuesStart = insertMatch.index + insertMatch[0].length;
  const onConflict = cleaned.slice(valuesStart).search(/\bon\s+conflict\b/i);
  const valuesEnd = onConflict >= 0 ? valuesStart + onConflict : cleaned.length;
  return cleaned.slice(valuesStart, valuesEnd).trim();
}

function scanSqlLiteral(src: string, start: number): { value: string; next: number } {
  if (src[start] !== "'") {
    throw new Error(`Expected string literal at index ${start}`);
  }
  let i = start + 1;
  let out = '';
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === "'") {
      if (src[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return { value: out, next: i + 1 };
    }
    out += ch;
    i += 1;
  }
  throw new Error('Unterminated SQL string literal');
}

function scanSqlArray(src: string, start: number): { value: string[]; next: number } {
  const head = src.slice(start).match(/^array\s*\[/i);
  if (!head) {
    throw new Error(`Expected ARRAY[…] at index ${start}`);
  }
  let i = start + head[0].length;
  const items: string[] = [];

  while (i < src.length) {
    while (/\s/.test(src[i] ?? '')) i += 1;
    if (src[i] === ']') {
      i += 1;
      const cast = src.slice(i).match(/^::\w+(?:\[\])?/);
      if (cast) i += cast[0].length;
      return { value: items, next: i };
    }
    if (src[i] === ',') {
      i += 1;
      continue;
    }
    if (src[i] === "'") {
      const lit = scanSqlLiteral(src, i);
      items.push(lit.value);
      i = lit.next;
      continue;
    }
    throw new Error(`Unexpected token in ARRAY near index ${i}: ${src.slice(i, i + 20)}`);
  }
  throw new Error('Unterminated ARRAY literal');
}

function scanSqlValue(src: string, start: number): { value: unknown; next: number } {
  let i = start;
  while (/\s/.test(src[i] ?? '')) i += 1;

  if (src.slice(i, i + 5).toLowerCase() === 'array') {
    return scanSqlArray(src, i);
  }

  if (src[i] === "'") {
    const lit = scanSqlLiteral(src, i);
    i = lit.next;
    const cast = src.slice(i).match(/^::\w+/);
    if (cast) i += cast[0].length;
    return { value: lit.value, next: i };
  }

  if (/^(true|false)\b/i.test(src.slice(i))) {
    const m = src.slice(i).match(/^(true|false)/i)!;
    return { value: m[0]!.toLowerCase() === 'true', next: i + m[0]!.length };
  }

  if (/^(null)\b/i.test(src.slice(i))) {
    return { value: null, next: i + 4 };
  }

  const num = src.slice(i).match(/^-?\d+(?:\.\d+)?/);
  if (num) {
    return { value: Number(num[0]), next: i + num[0]!.length };
  }

  throw new Error(`Cannot parse SQL value at index ${i}: ${src.slice(i, i + 40)}`);
}

function splitValueTuples(valuesBlock: string): string[] {
  const tuples: string[] = [];
  let depth = 0;
  let inString = false;
  let start = -1;

  for (let i = 0; i < valuesBlock.length; i += 1) {
    const ch = valuesBlock[i]!;
    if (inString) {
      if (ch === "'" && valuesBlock[i + 1] === "'") {
        i += 1;
        continue;
      }
      if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") {
      inString = true;
      continue;
    }
    if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        tuples.push(valuesBlock.slice(start, i).trim());
        start = -1;
      }
    }
  }

  if (depth !== 0) {
    throw new Error('Unbalanced parentheses in VALUES block');
  }
  return tuples;
}

function parseTuple(tupleBody: string): EliteSeedRow {
  const fields: unknown[] = [];
  let i = 0;
  while (i < tupleBody.length) {
    while (/\s|,/.test(tupleBody[i] ?? '') && tupleBody[i] !== undefined) {
      if (tupleBody[i] === ',') {
        i += 1;
        break;
      }
      i += 1;
    }
    if (i >= tupleBody.length) break;
    const scanned = scanSqlValue(tupleBody, i);
    fields.push(scanned.value);
    i = scanned.next;
  }

  if (fields.length !== COLUMN_ORDER.length) {
    throw new Error(
      `Expected ${COLUMN_ORDER.length} columns, got ${fields.length} in tuple:\n${tupleBody.slice(0, 120)}…`,
    );
  }

  const record = Object.fromEntries(
    COLUMN_ORDER.map((col, idx) => [col, fields[idx]]),
  ) as Record<SeedColumn, unknown>;

  const slug = String(record.slug);
  const instructionsRaw = record.biomechanical_instructions;
  let instructions: Record<string, string>;
  if (typeof instructionsRaw === 'string') {
    const parsed: unknown = JSON.parse(instructionsRaw);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Invalid biomechanical_instructions JSON for ${slug}`);
    }
    instructions = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    );
  } else {
    throw new Error(`biomechanical_instructions must be JSON string for ${slug}`);
  }

  const equipment = record.equipment_required;
  const synergists = record.synergist_muscles;
  if (!Array.isArray(equipment) || !equipment.every((x) => typeof x === 'string')) {
    throw new Error(`equipment_required must be string[] for ${slug}`);
  }
  if (!Array.isArray(synergists) || !synergists.every((x) => typeof x === 'string')) {
    throw new Error(`synergist_muscles must be string[] for ${slug}`);
  }

  return {
    slug,
    name: String(record.name),
    biomechanical_instructions: instructions,
    equipment_required: equipment,
    default_sets: Number(record.default_sets),
    default_reps: Number(record.default_reps),
    movement_pattern: String(record.movement_pattern),
    primary_muscle: String(record.primary_muscle),
    synergist_muscles: synergists,
    cns_fatigue_cost: Number(record.cns_fatigue_cost),
    joint_stress_profile: String(record.joint_stress_profile),
    stretch_mediated_hypertrophy: Boolean(record.stretch_mediated_hypertrophy),
  };
}

function renderTs(rows: EliteSeedRow[]): string {
  const body = rows
    .map((row) => {
      const id = eliteIdFromSlug(row.slug);
      return `  {
    id: ${JSON.stringify(id)},
    slug: ${JSON.stringify(row.slug)},
    name: ${JSON.stringify(row.name)},
    biomechanical_instructions: ${JSON.stringify(row.biomechanical_instructions)},
    equipment_required: ${JSON.stringify(row.equipment_required)},
    default_sets: ${row.default_sets},
    default_reps: ${row.default_reps},
    movement_pattern: ${JSON.stringify(row.movement_pattern)},
    primary_muscle: ${JSON.stringify(row.primary_muscle)},
    synergist_muscles: ${JSON.stringify(row.synergist_muscles)},
    cns_fatigue_cost: ${row.cns_fatigue_cost},
    joint_stress_profile: ${JSON.stringify(row.joint_stress_profile)},
    stretch_mediated_hypertrophy: ${row.stretch_mediated_hypertrophy},
  }`;
    })
    .join(',\n');

  return `/**
 * Elite Hypertrophy offline catalog — generated from supabase/seed_hypertrophy.sql
 * Do not edit by hand. Regenerate with: npx tsx scripts/extractEliteCatalog.ts
 */
import type { LibraryExercise } from '@/types/catalog';

export const ELITE_EXERCISES: readonly LibraryExercise[] = [
${body},
];

export const ELITE_EXERCISE_COUNT = ELITE_EXERCISES.length;
`;
}

function main(): void {
  const sql = readFileSync(SEED_PATH, 'utf8');
  const valuesBlock = findValuesBlock(sql);
  const tuples = splitValueTuples(valuesBlock);
  const rows = tuples.map(parseTuple);

  const slugs = new Set<string>();
  for (const row of rows) {
    if (slugs.has(row.slug)) {
      throw new Error(`Duplicate slug in seed: ${row.slug}`);
    }
    slugs.add(row.slug);
  }

  writeFileSync(OUT_PATH, renderTs(rows), 'utf8');

  const hinge = rows.filter((r) => r.movement_pattern === 'hinge').length;
  const stretch = rows.filter((r) => r.stretch_mediated_hypertrophy).length;
  const joints = new Set(rows.map((r) => r.joint_stress_profile));

  console.log(`Wrote ${rows.length} exercises → ${OUT_PATH}`);
  console.log(`  hinge: ${hinge}`);
  console.log(`  stretch_mediated: ${stretch}`);
  console.log(`  joint_stress profiles: ${[...joints].sort().join(', ')}`);
}

main();
