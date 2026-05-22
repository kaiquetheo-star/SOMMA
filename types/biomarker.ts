import type { BiomarkerCategory } from '@/constants/biomarkers';

export type BiomarkerSource = 'manual' | 'lab_upload';

export interface BiomarkerReading {
  id: string;
  user_id: string;
  marker_id: string;
  value: number;
  unit: string;
  recorded_at: string;
  source: BiomarkerSource;
  document_id: string | null;
  notes: string | null;
}

export interface BiomarkerDocument {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  byte_size: number | null;
  uploaded_at: string;
}

/** Latest reading per catalog marker_id */
export type BiomarkerLatestMap = Record<string, BiomarkerReading>;

export interface BiomarkerCatalogEntry {
  id: string;
  name: string;
  category: BiomarkerCategory;
  unit: string;
  optimalHint: string;
}
