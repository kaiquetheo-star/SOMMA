import { useCallback, useEffect, useState } from 'react';

import {
  fetchBiomarkerDocuments,
  fetchLatestBiomarkerReadings,
  insertBiomarkerReading,
  uploadBiomarkerLabDocument,
} from '@/lib/supabase/biomarkers';
import type { BiomarkerDocument, BiomarkerLatestMap } from '@/types/biomarker';

interface UseBiomarkerVaultOptions {
  userId: string | undefined;
  enabled?: boolean;
}

export function useBiomarkerVault({ userId, enabled = true }: UseBiomarkerVaultOptions) {
  const [latest, setLatest] = useState<BiomarkerLatestMap>({});
  const [documents, setDocuments] = useState<BiomarkerDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !enabled) return;

    setLoading(true);
    setError(null);
    try {
      const [readings, docs] = await Promise.all([
        fetchLatestBiomarkerReadings(userId),
        fetchBiomarkerDocuments(userId),
      ]);
      setLatest(readings);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load biomarkers.');
    } finally {
      setLoading(false);
    }
  }, [userId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logReading = useCallback(
    async (markerId: string, value: number, unit: string) => {
      if (!userId) throw new Error('Sign in to log biomarkers.');
      const reading = await insertBiomarkerReading({
        userId,
        markerId,
        value,
        unit,
        source: 'manual',
      });
      setLatest((prev) => ({ ...prev, [markerId]: reading }));
      return reading;
    },
    [userId],
  );

  const uploadLab = useCallback(
    async (uri: string, fileName: string, mimeType: string | null, byteSize: number | null) => {
      if (!userId) throw new Error('Sign in to upload labs.');
      setUploading(true);
      setError(null);
      try {
        const doc = await uploadBiomarkerLabDocument({
          userId,
          uri,
          fileName,
          mimeType,
          byteSize,
        });
        setDocuments((prev) => [doc, ...prev]);
        return doc;
      } finally {
        setUploading(false);
      }
    },
    [userId],
  );

  return {
    latest,
    documents,
    loading,
    uploading,
    error,
    refresh,
    logReading,
    uploadLab,
  };
}
