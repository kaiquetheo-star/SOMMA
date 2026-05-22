import { useCallback, useEffect, useState } from 'react';

import type { BreathTempo } from '@/constants/breathwork';
import { BREATH_TEMPOS } from '@/constants/breathwork';
import {
  buildBreathTempoCatalog,
  resolveBreathTempoFromCatalog,
  type ResolvedBreathTempo,
} from '@/lib/breathwork/fromCatalog';
import {
  fetchLibraryFlowSpirit,
  type LibraryFlowSpiritSession,
} from '@/lib/catalog/library';

interface UseSpiritBreathCatalogResult {
  tempos: BreathTempo[];
  spiritSessions: LibraryFlowSpiritSession[];
  ready: boolean;
  resolve: (tempoId: string | undefined) => ResolvedBreathTempo;
}

/** Loads `library_flow_spirit` spirit rows and exposes DB-driven breath tempos */
export function useSpiritBreathCatalog(): UseSpiritBreathCatalogResult {
  const [spiritSessions, setSpiritSessions] = useState<LibraryFlowSpiritSession[]>([]);
  const [tempos, setTempos] = useState<BreathTempo[]>(BREATH_TEMPOS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    void fetchLibraryFlowSpirit().then((rows) => {
      if (!mounted) return;
      const spirit = rows.filter((row) => row.pillar === 'spirit');
      const catalogTempos = buildBreathTempoCatalog(rows);
      setSpiritSessions(spirit);
      if (catalogTempos.length > 0) {
        setTempos(catalogTempos);
      }
      setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const resolve = useCallback(
    (tempoId: string | undefined) =>
      resolveBreathTempoFromCatalog(tempoId, spiritSessions, tempos),
    [spiritSessions, tempos],
  );

  return { tempos, spiritSessions, ready, resolve };
}
