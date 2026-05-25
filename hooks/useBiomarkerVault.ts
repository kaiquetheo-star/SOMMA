import { useCallback, useState } from 'react';

import type { BiomarkerDocument, BiomarkerLatestMap, BiomarkerReading } from '@/types/biomarker';

interface UseBiomarkerVaultOptions {
  userId?: string;
  enabled?: boolean;
}

/** Local-only biomarker vault — persisted in session memory (device). */
export function useBiomarkerVault({ enabled = true }: UseBiomarkerVaultOptions = {}) {
  const [latest, setLatest] = useState<BiomarkerLatestMap>({});
  const [documents, setDocuments] = useState<BiomarkerDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(false);
    setError(null);
  }, [enabled]);

  const logReading = useCallback(
    async (markerId: string, value: number, unit: string) => {
      const reading: BiomarkerReading = {
        id: `local-biomarker-${markerId}-${Date.now()}`,
        user_id: 'local',
        marker_id: markerId,
        value,
        unit,
        recorded_at: new Date().toISOString(),
        source: 'manual',
        document_id: null,
        notes: null,
      };
      setLatest((prev) => ({ ...prev, [markerId]: reading }));
      return reading;
    },
    [],
  );

  const uploadLab = useCallback(
    async (uri: string, fileName: string, mimeType: string | null, byteSize: number | null) => {
      setUploading(true);
      setError(null);
      try {
        const doc: BiomarkerDocument = {
          id: `local-doc-${Date.now()}`,
          user_id: 'local',
          file_name: fileName,
          storage_path: uri,
          mime_type: mimeType,
          byte_size: byteSize,
          uploaded_at: new Date().toISOString(),
        };
        setDocuments((prev) => [doc, ...prev]);
        return doc;
      } finally {
        setUploading(false);
      }
    },
    [],
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
