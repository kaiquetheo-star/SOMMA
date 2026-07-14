import { useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextStyle } from 'react-native';

import type { BiometricCheckpoint } from '@/lib/gameplan/engine/adaptiveStateMachine';
import { isWeightStable } from '@/lib/gameplan/engine/adaptiveStateMachine';
import { webTextInputProps } from '@/lib/ux/webTextInput';

interface WeeklyBiometricCheckinProps {
  checkpoints: BiometricCheckpoint[];
  onAddCheckpoint: (checkpoint: BiometricCheckpoint) => void;
}

export function WeeklyBiometricCheckin({ checkpoints, onAddCheckpoint }: WeeklyBiometricCheckinProps) {
  const [weightDraft, setWeightDraft] = useState('');
  const [bodyFatDraft, setBodyFatDraft] = useState('');

  const lastCheckpoint = checkpoints[checkpoints.length - 1] ?? null;
  const stabilityMessage = useMemo(() => {
    if (!checkpoints.length) return 'Nenhum check-in biométrico registrado ainda.';
    return isWeightStable(checkpoints)
      ? 'Peso estável nos últimos 14 dias — ajuste calórico adaptado automaticamente.'
      : 'Pendência de peso instável — continue acompanhando semanalmente.';
  }, [checkpoints]);

  const formattedHistory = useMemo(
    () => [...checkpoints].reverse().slice(0, 4),
    [checkpoints],
  );

  const submitEnabled = Boolean(Number.parseFloat(weightDraft) > 0);

  const onSubmit = () => {
    const weight = Number.parseFloat(weightDraft.replace(',', '.'));
    if (!Number.isFinite(weight) || weight <= 0) return;

    const bodyFat = Number.parseFloat(bodyFatDraft.replace(',', '.'));
    onAddCheckpoint({
      date: new Date().toISOString().slice(0, 10),
      weight_kg: weight,
      body_fat_percentage: Number.isFinite(bodyFat) ? bodyFat : undefined,
    });
    setWeightDraft('');
    setBodyFatDraft('');
  };

  return (
    <View className="mb-6 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Weekly Biometric Check-in
      </Text>
      <Text className="mt-3 font-display text-2xl text-[#E8E4DC]">Acompanhamento corporal</Text>
      <Text className="mt-2 font-body text-sm leading-6 text-[#8A9488]">{stabilityMessage}</Text>

      {lastCheckpoint ? (
        <View className="mt-4 rounded-3xl border border-white/10 bg-[#0A0E0C]/80 px-4 py-4">
          <Text className="font-body text-xs uppercase tracking-[0.3em] text-[#6B7568]">Último registro</Text>
          <Text className="mt-2 font-body-semibold text-lg text-[#E8E4DC]">
            {lastCheckpoint.weight_kg.toFixed(1)} kg{lastCheckpoint.body_fat_percentage != null ? ` · ${lastCheckpoint.body_fat_percentage.toFixed(1)}%` : ''}
          </Text>
          <Text className="mt-1 font-body text-xs text-[#8A9488]">{lastCheckpoint.date}</Text>
        </View>
      ) : null}

      <View className="mt-5 gap-3">
        <View className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <Text className="font-body text-xs uppercase tracking-[0.32em] text-[#6B7568]">Peso (kg)</Text>
          <TextInput
            value={weightDraft}
            onChangeText={setWeightDraft}
            keyboardType={Platform.OS === 'web' ? 'decimal-pad' : 'decimal-pad'}
            inputMode="decimal"
            placeholder="Ex: 78.5"
            placeholderTextColor="#4E5B52"
            className="mt-3 rounded-2xl border border-white/10 bg-[#0F1512] px-4 py-3 font-display text-xl text-[#E8E4DC]"
            style={Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined}
            {...webTextInputProps()}
          />
        </View>

        <View className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <Text className="font-body text-xs uppercase tracking-[0.32em] text-[#6B7568]">Gordura corporal (%)</Text>
          <TextInput
            value={bodyFatDraft}
            onChangeText={setBodyFatDraft}
            keyboardType={Platform.OS === 'web' ? 'decimal-pad' : 'decimal-pad'}
            inputMode="decimal"
            placeholder="Opcional"
            placeholderTextColor="#4E5B52"
            className="mt-3 rounded-2xl border border-white/10 bg-[#0F1512] px-4 py-3 font-display text-xl text-[#E8E4DC]"
            style={Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined}
            {...webTextInputProps()}
          />
        </View>
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={!submitEnabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !submitEnabled }}
        className="mt-5 rounded-2xl bg-[#BFA06A] py-4"
        style={{ opacity: submitEnabled ? 1 : 0.4 }}
      >
        <Text className="text-center font-body-bold text-sm uppercase tracking-[0.22em] text-[#0F1512]">
          Registrar Check-in
        </Text>
      </Pressable>

      {formattedHistory.length > 0 ? (
        <View className="mt-6 gap-3">
          {formattedHistory.map((checkpoint) => (
            <View
              key={checkpoint.date}
              className="rounded-2xl border border-white/10 bg-[#0A0E0C]/85 px-4 py-3"
            >
              <Text className="font-body-semibold text-sm text-[#E8E4DC]">
                {checkpoint.date}
              </Text>
              <Text className="mt-1 font-body text-sm text-[#8A9488]">
                {checkpoint.weight_kg.toFixed(1)} kg{checkpoint.body_fat_percentage != null ? ` · ${checkpoint.body_fat_percentage.toFixed(1)}%` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
