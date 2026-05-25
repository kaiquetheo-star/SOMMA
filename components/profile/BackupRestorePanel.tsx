import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import {
  buildSommaBackupFile,
  downloadSommaBackup,
  parseSommaBackupJson,
  pickSommaBackupJson,
  snapshotFromStoreState,
} from '@/lib/local/backup';
import { useSommaStore } from '@/store/useSommaStore';

export function BackupRestorePanel() {
  const restoreFromBackup = useSommaStore((state) => state.restoreFromBackup);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const busy = exporting || importing;

  const handleExport = useCallback(() => {
    setExporting(true);
    try {
      const state = useSommaStore.getState();
      const file = buildSommaBackupFile(snapshotFromStoreState(state));
      downloadSommaBackup(file);
      Alert.alert(
        'Backup exported',
        'Your SOMMA data was saved as a JSON file on this device.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed.';
      Alert.alert('Export failed', message);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (busy) return;

    setImporting(true);
    try {
      const text = await pickSommaBackupJson();
      if (!text) return;

      const file = parseSommaBackupJson(text);
      if (!file) {
        Alert.alert('Import failed', 'This file is not a valid SOMMA backup.');
        return;
      }

      await restoreFromBackup(file);

      const logCount = file.state.performance_logs.length;
      Alert.alert(
        'Backup restored',
        `Local store hydrated. ${logCount} performance log${logCount === 1 ? '' : 's'} loaded.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.';
      Alert.alert('Import failed', message);
    } finally {
      setImporting(false);
    }
  }, [busy, restoreFromBackup]);

  return (
    <View className="gap-4 border-t border-white/10 pt-8">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Backup & Restore
      </Text>
      <Text className="font-body text-xs leading-5 text-[#8A9488]">
        Export or import your full offline store — protocols, logs, passport, and telemetry.
      </Text>

      <Pressable
        onPress={handleExport}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Export SOMMA data"
        className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 active:opacity-80"
      >
        {exporting ? (
          <View className="flex-row items-center gap-3">
            <ActivityIndicator color="#BFA06A" size="small" />
            <Text className="font-body-medium text-xs uppercase tracking-[0.25em] text-[#8A9488]">
              Preparing export…
            </Text>
          </View>
        ) : (
          <>
            <Text className="font-body-medium text-sm uppercase tracking-[0.25em] text-[#E8E4DC]">
              Export data
            </Text>
            <Text className="mt-1 font-body text-xs text-[#6B7568]">
              Download somma-backup.json (full Zustand snapshot)
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => void handleImport()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Import SOMMA data"
        className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 active:opacity-80"
      >
        {importing ? (
          <View className="flex-row items-center gap-3">
            <ActivityIndicator color="#BFA06A" size="small" />
            <Text className="font-body-medium text-xs uppercase tracking-[0.25em] text-[#8A9488]">
              Restoring backup…
            </Text>
          </View>
        ) : (
          <>
            <Text className="font-body-medium text-sm uppercase tracking-[0.25em] text-[#E8E4DC]">
              Import data
            </Text>
            <Text className="mt-1 font-body text-xs text-[#6B7568]">
              Select a prior SOMMA backup JSON to hydrate this device
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
