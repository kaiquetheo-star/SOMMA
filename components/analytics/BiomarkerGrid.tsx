import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';

import { LogBiomarkerModal } from '@/components/analytics/LogBiomarkerModal';
import {
  BIOMARKER_CATEGORY_LABELS,
  BIOMARKER_PLACEHOLDERS,
  type BiomarkerPlaceholder,
} from '@/constants/biomarkers';
import type { BiomarkerDocument, BiomarkerLatestMap } from '@/types/biomarker';

interface BiomarkerGridProps {
  latest: BiomarkerLatestMap;
  documents: BiomarkerDocument[];
  loading?: boolean;
  uploading?: boolean;
  error?: string | null;
  onLogReading: (markerId: string, value: number, unit: string) => Promise<unknown>;
  onUploadLab: (
    uri: string,
    fileName: string,
    mimeType: string | null,
    byteSize: number | null,
  ) => Promise<unknown>;
  onRefresh?: () => void;
}

function formatValue(value: number, unit: string): string {
  const rounded = value < 10 ? value.toFixed(1) : Math.round(value * 10) / 10;
  return `${rounded}`;
}

function BiomarkerTile({
  marker,
  reading,
  onPress,
}: {
  marker: BiomarkerPlaceholder;
  reading?: { value: number; recorded_at: string };
  onPress: () => void;
}) {
  const hasValue = reading != null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${marker.name}, ${hasValue ? reading.value : 'not logged'}`}
      className="min-h-[120px] flex-1 basis-[47%] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 active:opacity-85"
      style={
        hasValue
          ? { borderColor: 'rgba(191, 160, 106, 0.28)', backgroundColor: 'rgba(191, 160, 106, 0.06)' }
          : undefined
      }
    >
      <Text className="font-body text-[9px] uppercase tracking-[0.3em] text-[#6B7568]">
        {BIOMARKER_CATEGORY_LABELS[marker.category]}
      </Text>
      <Text className="mt-2 font-display text-base text-[#E8E4DC]">{marker.name}</Text>
      <View className="mt-3 flex-row items-baseline gap-1">
        <Text
          className={`font-display-bold text-2xl ${hasValue ? 'text-matte-gold' : 'text-[#4A5D44]'}`}
        >
          {hasValue ? formatValue(reading.value, marker.unit) : '—'}
        </Text>
        <Text className="font-body text-xs text-[#6B7568]">{marker.unit}</Text>
      </View>
      <Text className="mt-2 font-body text-[10px] leading-4 text-[#6B7568]">
        {marker.optimalHint}
      </Text>
      <View
        className={`mt-3 self-start rounded-full border px-2 py-1 ${
          hasValue ? 'border-matte-gold/30 bg-matte-gold/10' : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <Text
          className={`font-body text-[9px] uppercase tracking-[0.2em] ${
            hasValue ? 'text-matte-gold/90' : 'text-[#6B7568]'
          }`}
        >
          {hasValue ? 'Tap to update' : 'Tap to log'}
        </Text>
      </View>
    </Pressable>
  );
}

/** Biomarker vault — latest readings + lab uploads */
export function BiomarkerGrid({
  latest,
  documents,
  loading,
  uploading,
  error,
  onLogReading,
  onUploadLab,
}: BiomarkerGridProps) {
  const [activeMarker, setActiveMarker] = useState<BiomarkerPlaceholder | null>(null);
  const [saving, setSaving] = useState(false);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      await onUploadLab(
        asset.uri,
        asset.name ?? 'lab-document',
        asset.mimeType ?? null,
        asset.size ?? null,
      );
      Alert.alert('Upload complete', 'Lab file stored in your biomarker vault.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      Alert.alert('Upload failed', message);
    }
  };

  const handleSave = async (value: number) => {
    if (!activeMarker) return;
    setSaving(true);
    try {
      await onLogReading(activeMarker.id, value, activeMarker.unit);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save.';
      Alert.alert('Save failed', message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-4">
      <View>
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Biomarker vault
        </Text>
        <Text className="mt-2 font-body text-sm leading-6 text-[#8A9488]">
          Log metabolic, cardio, and recovery markers. Lab PDFs and images persist to Supabase
          Storage.
        </Text>
      </View>

      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator color="#BFA06A" />
        </View>
      ) : null}

      {error ? (
        <View className="rounded-2xl border border-blood-red/25 bg-blood-red/10 px-4 py-3">
          <Text className="font-body text-xs text-blood-red">{error}</Text>
          <Text className="mt-1 font-body text-[10px] text-[#8A9488]">
            Run migration 011_biomarkers.sql if tables are missing.
          </Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {BIOMARKER_PLACEHOLDERS.map((marker) => (
          <BiomarkerTile
            key={marker.id}
            marker={marker}
            reading={latest[marker.id]}
            onPress={() => setActiveMarker(marker)}
          />
        ))}
      </View>

      <Pressable
        onPress={() => void handleUpload()}
        disabled={uploading}
        className="overflow-hidden rounded-2xl border border-dashed border-matte-gold/25 bg-matte-gold/5 px-5 py-4 active:opacity-80"
      >
        {uploading ? (
          <ActivityIndicator color="#BFA06A" />
        ) : (
          <>
            <Text className="font-body-medium text-xs uppercase tracking-[0.3em] text-matte-gold">
              Upload lab results
            </Text>
            <Text className="mt-1 font-body text-xs text-[#6B7568]">
              PDF · JPEG · PNG · up to 10 MB
            </Text>
          </>
        )}
      </Pressable>

      {documents.length > 0 ? (
        <View className="gap-2">
          <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
            Recent uploads
          </Text>
          {documents.slice(0, 5).map((doc) => (
            <View
              key={doc.id}
              className="flex-row items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
            >
              <Text className="max-w-[70%] font-body text-sm text-[#E8E4DC]" numberOfLines={1}>
                {doc.file_name}
              </Text>
              <Text className="font-body text-[10px] text-[#6B7568]">
                {new Date(doc.uploaded_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <LogBiomarkerModal
        visible={activeMarker != null}
        marker={activeMarker}
        currentValue={activeMarker ? latest[activeMarker.id]?.value : null}
        saving={saving}
        onClose={() => setActiveMarker(null)}
        onSave={handleSave}
      />
    </View>
  );
}
