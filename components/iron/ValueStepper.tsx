import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { webTextInputProps } from '@/lib/ux/webTextInput';

interface ValueStepperProps {
  label: string;
  value: number;
  unit?: string;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Allow typing the value directly (required for web load entry) */
  allowDirectInput?: boolean;
  /** Single-row layout for dense modals (e.g. readiness check-in). */
  compact?: boolean;
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

export function ValueStepper({
  label,
  value,
  unit,
  step,
  min = 0,
  max = 999,
  onChange,
  disabled = false,
  allowDirectInput = false,
  compact = false,
}: ValueStepperProps) {
  const [draft, setDraft] = useState(formatDisplay(value, step));

  useEffect(() => {
    setDraft(formatDisplay(value, step));
  }, [value, step]);

  const decrement = () => onChange(clamp(Math.round((value - step) * 10) / 10, min, max));
  const increment = () => onChange(clamp(Math.round((value + step) * 10) / 10, min, max));

  const commitDraft = (text: string) => {
    const normalized = text.replace(',', '.').trim();
    if (normalized === '' || normalized === '.') {
      setDraft(formatDisplay(value, step));
      return;
    }
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      setDraft(formatDisplay(value, step));
      return;
    }
    const next = clamp(parsed, min, max);
    onChange(next);
    setDraft(formatDisplay(next, step));
  };

  if (compact) {
    return (
      <View
        className={`flex-row items-center gap-3 ${disabled ? 'opacity-50' : ''}`}
        style={{ zIndex: 2 }}
      >
        <Text
          className="min-w-0 flex-1 font-body text-[10px] uppercase tracking-[0.22em] text-[#6B7568]"
          numberOfLines={2}
        >
          {label}
        </Text>
        <Pressable
          onPress={decrement}
          disabled={disabled}
          accessibilityLabel={`Decrease ${label}`}
          hitSlop={10}
          className="h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] active:bg-matte-gold/15"
        >
          <Text className="font-body-medium text-xl text-[#E8E4DC]">−</Text>
        </Pressable>
        <Text
          className="min-w-[36px] text-center font-body-medium text-2xl text-[#E8E4DC]"
          style={{ fontFamily: Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : 'Inter' }}
        >
          {formatDisplay(value, step)}
        </Text>
        <Pressable
          onPress={increment}
          disabled={disabled}
          accessibilityLabel={`Increase ${label}`}
          hitSlop={10}
          className="h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] active:bg-matte-gold/15"
        >
          <Text className="font-body-medium text-xl text-[#E8E4DC]">+</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className={disabled ? 'opacity-50' : ''} style={{ zIndex: 2 }}>
      <Text className="text-center font-body text-[10px] uppercase tracking-[0.4em] text-[#6B7568]">
        {label}
      </Text>
      <View className="mt-3 flex-row items-center justify-center gap-8">
        <Pressable
          onPress={decrement}
          disabled={disabled}
          accessibilityLabel={`Decrease ${label}`}
          hitSlop={12}
          className="h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] active:bg-matte-gold/15"
        >
          <Text className="font-body-medium text-3xl text-[#E8E4DC]">−</Text>
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
                className="min-w-[80px] text-center font-body-medium text-5xl text-[#E8E4DC]"
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
              {unit ? (
                <Text className="font-body text-lg text-matte-gold/80">{unit}</Text>
              ) : null}
            </View>
          ) : (
            <>
              <Text
                className="font-body-medium text-5xl text-[#E8E4DC]"
                style={{ fontFamily: Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : 'Inter' }}
              >
                {formatDisplay(value, step)}
              </Text>
              {unit ? (
                <Text className="mt-1 font-body text-xs text-matte-gold/80">{unit}</Text>
              ) : null}
            </>
          )}
        </View>

        <Pressable
          onPress={increment}
          disabled={disabled}
          accessibilityLabel={`Increase ${label}`}
          hitSlop={12}
          className="h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] active:bg-matte-gold/15"
        >
          <Text className="font-body-medium text-3xl text-[#E8E4DC]">+</Text>
        </Pressable>
      </View>
      {allowDirectInput && !disabled ? (
        <Text className="mt-2 text-center font-body text-[10px] text-[#6B7568]">
          Tap to type · use − / + to step
        </Text>
      ) : null}
    </View>
  );
}
