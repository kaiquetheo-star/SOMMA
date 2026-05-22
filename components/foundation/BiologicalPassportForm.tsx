import { Pressable, Text, TextInput, View } from 'react-native';

import { ValueStepper } from '@/components/iron/ValueStepper';
import { RpeSelector } from '@/components/combat/RpeSelector';
import type { BiologicalProfile, CombatGoal, FlowGoal, IronGoal, SpiritGoal } from '@/types/biological';
import {
  COMBAT_GOALS,
  FLOW_GOALS,
  IRON_GOALS,
  SPIRIT_GOALS,
} from '@/types/biological';

interface BiologicalPassportFormProps {
  value: BiologicalProfile;
  onChange: (patch: Partial<BiologicalProfile>) => void;
}

interface GoalPickerProps<T extends string> {
  label: string;
  pillarAccent: string;
  options: readonly T[];
  value: T | null;
  onSelect: (goal: T | null) => void;
}

function GoalPicker<T extends string>({
  label,
  pillarAccent,
  options,
  value,
  onSelect,
}: GoalPickerProps<T>) {
  return (
    <View className="gap-3">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(isSelected ? null : option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${label}: ${option}`}
              className={`rounded-xl border px-4 py-2 active:opacity-75 ${
                isSelected
                  ? `border-${pillarAccent}/50 bg-${pillarAccent}/15`
                  : 'border-white/10 bg-white/[0.04]'
              }`}
            >
              <Text
                className={`font-body text-xs ${
                  isSelected ? `text-${pillarAccent}` : 'text-[#8A9488]'
                }`}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function BiologicalPassportForm({ value, onChange }: BiologicalPassportFormProps) {
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Date of birth
        </Text>
        <TextInput
          value={value.date_of_birth ?? ''}
          onChangeText={(text) => onChange({ date_of_birth: text.trim() || null })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#4A5D44"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-body text-base text-[#E8E4DC]"
        />
        <Text className="font-body text-xs text-[#6B7568]">Used to calibrate age-appropriate load.</Text>
      </View>

      <ValueStepper
        label="Body weight"
        value={value.weight_kg ?? 70}
        unit="kg"
        step={1}
        min={30}
        max={200}
        onChange={(weight_kg) => onChange({ weight_kg })}
      />

      <ValueStepper
        label="Height"
        value={value.height_cm ?? 170}
        unit="cm"
        step={1}
        min={120}
        max={230}
        onChange={(height_cm) => onChange({ height_cm })}
      />

      <View className="gap-2">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Body fat % (optional)
        </Text>
        <TextInput
          value={
            value.body_fat_percentage != null ? String(value.body_fat_percentage) : ''
          }
          onChangeText={(text) => {
            const trimmed = text.trim();
            if (!trimmed) {
              onChange({ body_fat_percentage: null });
              return;
            }
            const parsed = Number.parseFloat(trimmed);
            onChange({
              body_fat_percentage: Number.isFinite(parsed) ? parsed : null,
            });
          }}
          placeholder="e.g. 18"
          placeholderTextColor="#4A5D44"
          keyboardType="decimal-pad"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-body text-base text-[#E8E4DC]"
        />
      </View>

      <View className="gap-2">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Current injuries or limitations (optional)
        </Text>
        <TextInput
          value={value.current_injuries ?? ''}
          onChangeText={(text) =>
            onChange({ current_injuries: text.trim() ? text.trim() : null })
          }
          placeholder="e.g. Left shoulder impingement — avoid overhead press"
          placeholderTextColor="#4A5D44"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          className="min-h-[88px] rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-body text-sm leading-6 text-[#E8E4DC]"
        />
      </View>

      <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <RpeSelector
          value={value.baseline_stress_level}
          onChange={(baseline_stress_level) => onChange({ baseline_stress_level })}
        />
        <Text className="mt-3 text-center font-body text-xs text-[#6B7568]">
          Baseline nervous-system load · 1 calm · 10 overloaded
        </Text>
      </View>

      {/* ── Pillar Goals ─────────────────────────────────────────────────── */}
      <View className="gap-1">
        <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
          Pillar Goals
        </Text>
        <Text className="font-body text-xs leading-5 text-[#6B7568]">
          Each coach uses your declared objective to bias exercise selection,
          round structure, and recovery focus. Tap to select — tap again to clear.
        </Text>
      </View>

      <View className="gap-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-5">
        <GoalPicker<IronGoal>
          label="Iron · Strength training goal"
          pillarAccent="matte-gold"
          options={IRON_GOALS}
          value={value.goal_iron}
          onSelect={(goal_iron) => onChange({ goal_iron })}
        />

        <GoalPicker<CombatGoal>
          label="Combat · Blood & Bone goal"
          pillarAccent="blood-red"
          options={COMBAT_GOALS}
          value={value.goal_combat}
          onSelect={(goal_combat) => onChange({ goal_combat })}
        />

        <GoalPicker<FlowGoal>
          label="Flow · Mobility & movement goal"
          pillarAccent="[#8A9488]"
          options={FLOW_GOALS}
          value={value.goal_flow}
          onSelect={(goal_flow) => onChange({ goal_flow })}
        />

        <GoalPicker<SpiritGoal>
          label="Spirit · Breathwork & mind goal"
          pillarAccent="[#5B7A6E]"
          options={SPIRIT_GOALS}
          value={value.goal_spirit}
          onSelect={(goal_spirit) => onChange({ goal_spirit })}
        />
      </View>
    </View>
  );
}
