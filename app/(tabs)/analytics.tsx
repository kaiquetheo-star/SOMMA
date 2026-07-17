import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsistencyCalendar } from '@/components/analytics/ConsistencyCalendar';
import { BiologicalPassportSummary } from '@/components/analytics/BiologicalPassportSummary';
import { BiologicalPassportForm } from '@/components/foundation/BiologicalPassportForm';
import { DamageControlToggle } from '@/components/sanctuary/DamageControlToggle';
import { useSommaStore } from '@/store/useSommaStore';
import {
  initialBiologicalProfile,
  isBiologicalProfileComplete,
  normalizeBodyFatFields,
  type BiologicalProfile,
} from '@/types/biological';

/** Biological Passport — read, edit, and session controls */
export default function AnalyticsScreen() {
  const router = useRouter();
  const storedBiological = useSommaStore((state) => state.user_biological);
  const setUserBiological = useSommaStore((state) => state.setUserBiological);
  const resetStore = useSommaStore((state) => state.resetStore);
  const performanceLogs = useSommaStore((state) => state.performance_logs);
  const weeklyMicrocycle = useSommaStore((state) => state.weeklyMicrocycle);
  const selectedDayIndex = useSommaStore((state) => state.selectedDayIndex);
  const damageControlActiveDates = useSommaStore((state) => state.damageControlActiveDates);
  const toggleDamageControlDate = useSommaStore((state) => state.toggleDamageControlDate);

  const [draft, setDraft] = useState<BiologicalProfile>(storedBiological);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(storedBiological);
  }, [storedBiological]);

  const handleDraftChange = useCallback((patch: Partial<BiologicalProfile>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSavePassport = async () => {
    if (!isBiologicalProfileComplete(draft)) {
      Alert.alert(
        'Incomplete passport',
        'Date of birth, weight, height, baseline stress (1–10), and training frequency (1–7 days) are required.',
      );
      return;
    }

    setSaving(true);
    try {
      const normalized: BiologicalProfile = {
        ...draft,
        current_injuries: draft.current_injuries?.trim() || null,
        ...normalizeBodyFatFields(draft),
      };
      setUserBiological(normalized);

      Alert.alert('Passport updated', 'Your biological baseline is saved on this device.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save to the cloud.';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(storedBiological ?? { ...initialBiologicalProfile });
  };

  const hasChanges =
    JSON.stringify(draft) !== JSON.stringify(storedBiological ?? initialBiologicalProfile);
  const selectedDate =
    weeklyMicrocycle?.find((day) => day.day_index === selectedDayIndex)?.date ??
    new Date().toISOString().slice(0, 10);
  const damageControlActive = damageControlActiveDates.includes(selectedDate);

  const handleResetDevice = async () => {
    await resetStore();
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-8 pb-12 pt-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
          Biological Passport
        </Text>
        <Text className="mt-3 font-display-bold text-3xl text-[#E8E4DC]">Your markers</Text>
        <Text className="mt-4 font-body text-sm leading-6 text-[#8A9488]">
          Anthropometric baseline, weekly training frequency, and per-pillar goals for the clinic
          coaches, plus consistency signals from your local training record.
        </Text>

        <View className="mt-8 gap-8">
            <BiologicalPassportSummary profile={draft} />

            <ConsistencyCalendar
              performanceLogs={performanceLogs}
              weeklyMicrocycle={weeklyMicrocycle}
            />

            <DamageControlToggle
              date={selectedDate}
              active={damageControlActive}
              onToggle={() => toggleDamageControlDate(selectedDate)}
            />

            <View className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                Future Signal Layer
              </Text>
              <Text className="mt-3 font-display text-2xl leading-8 text-[#E8E4DC]">
                Biological optimization, simplified
              </Text>
              <Text className="mt-3 font-body text-sm leading-6 text-[#8A9488]">
                Biological optimization is driven by consistent training, nutrition, and recovery.
                Advanced biomarker tracking is coming in a future update.
              </Text>
            </View>

            <View className="gap-4">
              <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                Edit baseline
              </Text>
              <BiologicalPassportForm value={draft} onChange={handleDraftChange} />

              <View className="flex-row gap-3">
                <Pressable
                  onPress={handleDiscard}
                  disabled={!hasChanges || saving}
                  className={`flex-1 rounded-2xl border px-4 py-4 ${
                    hasChanges && !saving
                      ? 'border-white/15 bg-white/5 active:opacity-80'
                      : 'border-white/5 bg-white/[0.02] opacity-40'
                  }`}
                >
                  <Text className="text-center font-body-medium text-xs uppercase tracking-[0.25em] text-[#8A9488]">
                    Discard
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSavePassport}
                  disabled={saving}
                  className="flex-[2] overflow-hidden rounded-2xl border border-matte-gold/40 bg-matte-gold/10 px-4 py-4 active:opacity-80"
                >
                  {saving ? (
                    <ActivityIndicator color="#BFA06A" />
                  ) : (
                    <Text className="text-center font-body-medium text-xs uppercase tracking-[0.3em] text-matte-gold">
                      Save passport
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>

        <View className="mt-12 gap-3">
          <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
            Device
          </Text>

          <Pressable
            onPress={handleResetDevice}
            accessibilityRole="button"
            accessibilityLabel="Reset all local SOMMA data"
            className="rounded-2xl border border-blood-red/30 bg-blood-red/10 px-5 py-4 active:opacity-80"
          >
            <Text className="font-body-medium text-sm uppercase tracking-[0.25em] text-blood-red">
              Reset device data
            </Text>
            <Text className="mt-1 font-body text-xs text-[#8A9488]">
              Clears all local protocols, logs, and passport data on this device.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
