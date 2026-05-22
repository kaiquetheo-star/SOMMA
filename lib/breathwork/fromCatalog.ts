import type { BreathTempo } from '@/constants/breathwork';
import { BREATH_TEMPOS } from '@/constants/breathwork';
import type { LibraryFlowSpiritSession } from '@/lib/catalog/library';

/** Edge Function `tempo_id` → `library_flow_spirit.slug` */
export const EDGE_TEMPO_TO_SLUG: Record<string, string> = {
  tempo_478: 'recovery_478',
  tempo_box: 'tempo_box_breathwork',
  tempo_relax: 'relaxing_exhale',
  tempo_nsdr: 'nsdr_body_scan',
  '4-7-8': 'recovery_478',
  box: 'tempo_box_breathwork',
  relax: 'relaxing_exhale',
  nsdr: 'nsdr_body_scan',
};

const SLUG_TO_EDGE_TEMPO: Record<string, string> = Object.fromEntries(
  Object.entries(EDGE_TEMPO_TO_SLUG).map(([edge, slug]) => [slug, edge]),
);

function readSeconds(profile: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = profile[key];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return undefined;
}

/** Parse `tempo_profile` jsonb into engine-ready phase lengths */
export function parseTempoProfile(
  profile: Record<string, unknown>,
  durationMinutes: number,
): Pick<BreathTempo, 'inhale' | 'hold' | 'exhale' | 'holdEmpty' | 'defaultCycles'> {
  const inhale = readSeconds(profile, ['inhale_seconds', 'inhale']) ?? 4;
  const hold = readSeconds(profile, ['hold_seconds', 'hold']) ?? 0;
  const exhale = readSeconds(profile, ['exhale_seconds', 'exhale']) ?? 6;
  const holdEmpty =
    readSeconds(profile, ['hold_empty_seconds', 'holdEmpty', 'hold_empty']) ?? 0;
  const cyclesFromProfile = readSeconds(profile, ['cycles', 'default_cycles']);

  const cycleSec = inhale + hold + exhale + holdEmpty;
  const cyclesFromDuration =
    cycleSec > 0 ? Math.max(1, Math.round((durationMinutes * 60) / cycleSec)) : 4;

  return {
    inhale,
    hold,
    exhale,
    holdEmpty,
    defaultCycles: cyclesFromProfile ?? cyclesFromDuration,
  };
}

export interface BreathTempoFromCatalog extends BreathTempo {
  catalogId: string;
  slug: string;
  edgeTempoId?: string;
}

export function spiritSessionToBreathTempo(
  session: LibraryFlowSpiritSession,
): BreathTempoFromCatalog | null {
  if (session.pillar !== 'spirit') return null;

  const phases = parseTempoProfile(session.tempo_profile, session.duration_minutes);
  const edgeTempoId = SLUG_TO_EDGE_TEMPO[session.slug];

  return {
    id: session.slug,
    name: session.session_name,
    subtitle: session.description ?? 'Breathwork · catalog',
    ...phases,
    catalogId: session.id,
    slug: session.slug,
    edgeTempoId,
  };
}

/** All spirit rows with a usable breath tempo profile */
export function buildBreathTempoCatalog(
  sessions: LibraryFlowSpiritSession[],
): BreathTempoFromCatalog[] {
  return sessions
    .filter((row) => row.pillar === 'spirit')
    .map(spiritSessionToBreathTempo)
    .filter((row): row is BreathTempoFromCatalog => row != null);
}

export function findSpiritSessionByTempoId(
  sessions: LibraryFlowSpiritSession[],
  tempoId: string | undefined,
): LibraryFlowSpiritSession | null {
  if (!tempoId) return null;

  const slug = EDGE_TEMPO_TO_SLUG[tempoId] ?? tempoId.replace(/^tempo_/, '');
  const bySlug = sessions.find((row) => row.slug === slug);
  if (bySlug) return bySlug;

  const byId = sessions.find((row) => row.id === tempoId);
  if (byId) return byId;

  const byEdge = sessions.find(
    (row) => SLUG_TO_EDGE_TEMPO[row.slug] === tempoId || row.slug === tempoId,
  );
  return byEdge ?? null;
}

export interface ResolvedBreathTempo {
  tempo: BreathTempo;
  session: LibraryFlowSpiritSession | null;
  fromCatalog: boolean;
}

/** Resolve prescribed tempo — DB catalog first, then local fallback constants */
export function resolveBreathTempoFromCatalog(
  tempoId: string | undefined,
  sessions: LibraryFlowSpiritSession[],
  fallbackTempos: BreathTempo[] = BREATH_TEMPOS,
): ResolvedBreathTempo {
  const session = findSpiritSessionByTempoId(sessions, tempoId);
  if (session) {
    const fromDb = spiritSessionToBreathTempo(session);
    if (fromDb) {
      return { tempo: fromDb, session, fromCatalog: true };
    }
  }

  const lookupId = tempoId
    ? (EDGE_TEMPO_TO_SLUG[tempoId] ?? tempoId)
    : (fallbackTempos[0]?.id ?? 'recovery_478');

  const fallback =
    fallbackTempos.find((item) => item.id === lookupId) ?? fallbackTempos[0];

  return { tempo: fallback, session: null, fromCatalog: false };
}
