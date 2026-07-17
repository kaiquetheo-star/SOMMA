import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { hapticButtonTap } from '@/lib/haptics';
import { webTextInputProps } from '@/lib/ux/webTextInput';

interface StepperRowProps {
  label: string;
  value: number;
  unit?: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Allow typing the value directly (required for web load entry). */
  allowDirectInput?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDisplay(value: number, step: number): string {
  return step < 1
    ? value.toFixed(1)
    : Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
}

/** 48×48 touch targets, Inter bold controls, Matte Gold value. */
function StepperRow({
  label,
  value,
  unit,
  step,
  min,
  max,
  onChange,
  disabled = false,
  allowDirectInput = false,
}: StepperRowProps) {
  const [draft, setDraft] = useState(formatDisplay(value, step));

  useEffect(() => {
    setDraft(formatDisplay(value, step));
  }, [value, step]);

  const adjust = (direction: -1 | 1) => {
    void hapticButtonTap();
    onChange(clamp(Math.round((value + direction * step) * 10) / 10, min, max));
  };

  const commitDraft = (text: string) => {
    const normalized = text.replace(',', '.').trim();
    const parsed = Number.parseFloat(normalized);
    if (normalized === '' || !Number.isFinite(parsed)) {
      setDraft(formatDisplay(value, step));
      return;
    }
    const next = clamp(parsed, min, max);
    onChange(next);
    setDraft(formatDisplay(next, step));
  };

  return (
    <View className={disabled ? 'opacity-50' : ''}>
      <Text className="text-center font-body text-[10px] uppercase tracking-[0.4em] text-[#6B7568]">
        {label}
      </Text>
      <View className="mt-2 flex-row items-center justify-center gap-7">
        <Pressable
          onPress={() => adjust(-1)}
          disabled={disabled || step === 0}
          accessibilityLabel={`Diminuir ${label}`}
          hitSlop={8}
          className="h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] active:bg-matte-gold/15"
        >
          <Text className="font-body-medium text-2xl font-bold text-[#E8E4DC]">−</Text>
        </Pressable>

        <View className="min-w-[112px] items-center" pointerEvents="box-none">
          {allowDirectInput ? (
            <View className="flex-row items-baseline justify-center gap-1">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onBlur={() => commitDraft(draft)}
                onSubmitEditing={() => commitDraft(draft)}
                editable={!disabled}
                keyboardType={Platform.OS === 'web' ? 'default' : 'decimal-pad'}
                inputMode="decimal"
                selectTextOnFocus
                accessibilityLabel={label}
                placeholder="0"
                placeholderTextColor="#4A5D44"
                className="min-w-[80px] text-center font-body-medium text-4xl text-matte-gold"
                style={
                  Platform.OS === 'web'
                    ? ({
                        outlineStyle: 'none',
                        padding: 0,
                        margin: 0,
                        borderWidth: 0,
                        backgroundColor: 'transparent',
                        cursor: disabled ? 'not-allowed' : 'text',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      } as object)
                    : { fontFamily: 'Inter' }
                }
                {...webTextInputProps()}
              />
              {unit ? <Text className="font-body text-lg text-matte-gold/80">{unit}</Text> : null}
            </View>
          ) : (
            <View className="flex-row items-baseline gap-1">
              <Text
                className="font-body-medium text-4xl text-matte-gold"
                style={{
                  fontFamily: Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : 'Inter',
                }}
              >
                {formatDisplay(value, step)}
              </Text>
              {unit ? <Text className="font-body text-lg text-matte-gold/80">{unit}</Text> : null}
            </View>
          )}
        </View>

        <Pressable
          onPress={() => adjust(1)}
          disabled={disabled || step === 0}
          accessibilityLabel={`Aumentar ${label}`}
          hitSlop={8}
          className="h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] active:bg-matte-gold/15"
        >
          <Text className="font-body-medium text-2xl font-bold text-[#E8E4DC]">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface SetLoggerProps {
  weight: number;
  reps: number;
  rir: number;
  targetRir: number;
  isBodyweight: boolean;
  setLabel: string;
  disabled?: boolean;
  onWeightChange: (value: number) => void;
  onRepsChange: (value: number) => void;
  onRirChange: (value: number) => void;
  onLog: () => void;
}

/**
 * Touch-first set capture — vertical Peso | Reps | RIR steppers with a
 * full-width Matte Gold "Log Set". Every tap answers with light haptics.
 */
export function SetLogger({
  weight,
  reps,
  rir,
  targetRir,
  isBodyweight,
  setLabel,
  disabled = false,
  onWeightChange,
  onRepsChange,
  onRirChange,
  onLog,
}: SetLoggerProps) {
  return (
    <View className="gap-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
      <StepperRow
        label="Peso (kg)"
        value={weight}
        unit={isBodyweight ? 'BW' : 'kg'}
        step={isBodyweight ? 0 : 2.5}
        min={0}
        max={300}
        onChange={onWeightChange}
        disabled={disabled}
        allowDirectInput={!isBodyweight}
      />

      <StepperRow
        label="Reps"
        value={reps}
        step={1}
        min={1}
        max={50}
        onChange={onRepsChange}
        disabled={disabled}
      />

      <View>
        <StepperRow
          label="RIR"
          value={rir}
          step={1}
          min={0}
          max={4}
          onChange={onRirChange}
          disabled={disabled}
        />
        <Text className="mt-1 text-center font-body text-[10px] uppercase tracking-[0.25em] text-[#6B7568]">
          Prescrito · {targetRir} RIR
        </Text>
      </View>

      <Pressable
        onPress={onLog}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={setLabel}
        className={`w-full overflow-hidden rounded-2xl px-8 py-4 ${
          disabled ? 'bg-white/5 opacity-40' : 'bg-matte-gold active:opacity-85'
        }`}
      >
        <Text
          className={`text-center font-body-medium text-sm font-semibold uppercase tracking-[0.35em] ${
            disabled ? 'text-[#6B7568]' : 'text-obsidian'
          }`}
        >
          {setLabel}
        </Text>
      </Pressable>
    </View>
  );
}
