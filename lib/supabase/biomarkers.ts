import { getSupabase } from '@/lib/supabase/client';
import type { BiomarkerDocument, BiomarkerLatestMap, BiomarkerReading } from '@/types/biomarker';

const BIOMARKER_BUCKET = 'biomarker-labs';

function mapReading(row: Record<string, unknown>): BiomarkerReading {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    marker_id: String(row.marker_id),
    value: Number(row.value),
    unit: String(row.unit),
    recorded_at: String(row.recorded_at),
    source: row.source === 'lab_upload' ? 'lab_upload' : 'manual',
    document_id: row.document_id != null ? String(row.document_id) : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
  };
}

function mapDocument(row: Record<string, unknown>): BiomarkerDocument {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    storage_path: String(row.storage_path),
    file_name: String(row.file_name),
    mime_type: typeof row.mime_type === 'string' ? row.mime_type : null,
    byte_size: row.byte_size != null ? Number(row.byte_size) : null,
    uploaded_at: String(row.uploaded_at),
  };
}

/** Latest reading per marker_id for the signed-in user */
export async function fetchLatestBiomarkerReadings(userId: string): Promise<BiomarkerLatestMap> {
  const supabase = getSupabase();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from('biomarker_readings')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false });

  if (error) throw error;

  const latest: BiomarkerLatestMap = {};
  for (const row of data ?? []) {
    const reading = mapReading(row as Record<string, unknown>);
    if (!latest[reading.marker_id]) {
      latest[reading.marker_id] = reading;
    }
  }
  return latest;
}

export async function fetchBiomarkerDocuments(userId: string): Promise<BiomarkerDocument[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('biomarker_documents')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })
    .limit(12);

  if (error) throw error;
  return (data ?? []).map((row) => mapDocument(row as Record<string, unknown>));
}

export async function insertBiomarkerReading(input: {
  userId: string;
  markerId: string;
  value: number;
  unit: string;
  source?: 'manual' | 'lab_upload';
  documentId?: string | null;
  notes?: string | null;
}): Promise<BiomarkerReading> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('biomarker_readings')
    .insert({
      user_id: input.userId,
      marker_id: input.markerId,
      value: input.value,
      unit: input.unit,
      source: input.source ?? 'manual',
      document_id: input.documentId ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapReading(data as Record<string, unknown>);
}

export interface LabUploadInput {
  userId: string;
  uri: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
}

/** Upload lab file to Storage and register metadata row */
export async function uploadBiomarkerLabDocument(
  input: LabUploadInput,
): Promise<BiomarkerDocument> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const documentId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const safeName = input.fileName.replace(/[^\w.\-]+/g, '_');
  const storagePath = `${input.userId}/${documentId}/${safeName}`;

  const response = await fetch(input.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(BIOMARKER_BUCKET)
    .upload(storagePath, blob, {
      contentType: input.mimeType ?? 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('biomarker_documents')
    .insert({
      id: documentId,
      user_id: input.userId,
      storage_path: storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapDocument(data as Record<string, unknown>);
}
