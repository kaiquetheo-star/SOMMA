import { Text, View } from 'react-native';

import { TrainingFrequencySelect } from '@/components/foundation/TrainingFrequencySelect';
import { ValueStepper } from '@/components/iron/ValueStepper';
import {
  ageFromDateOfBirth,
  FIXED_GOAL_IRON,
  FIXED_HEIGHT_CM,
  FIXED_NUTRITION_GOAL,
  type BiologicalProfile,
} from '@/types/biological';

interface BiologicalPassportFormProps {
  value: BiologicalProfile;
  onChange: (patch: Partial<BiologicalProfile>) => void;
}

export function BiologicalPassportForm({ value, onChange }: BiologicalPassportFormProps) {
  const age = ageFromDateOfBirth(value.date_of_birth);

  return (
    <View className="gap-6">
      <View className="gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/70">
          Permanent profile
        </Text>
        <View className="flex-row justify-between">
          <Text className="font-body text-xs text-[#6B7568]">Date of birth</Text>
          <Text className="font-body-medium text-sm text-[#E8E4DC]">
            {value.date_of_birth} {age != null ? `(${age}y)` : ''}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="font-body text-xs text-[#6B7568]">Height</Text>
          <Text className="font-body-medium text-sm text-[#E8E4DC]">{FIXED_HEIGHT_CM} cm</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="font-body text-xs text-[#6B7568]">Objective</Text>
          <Text className="max-w-[60%] text-right font-body-medium text-sm text-[#E8E4DC]">
            Functional Sustainable Hypertrophy
          </Text>
        </View>
        <Text className="font-body text-xs leading-5 text-[#6B7568]">
          Iron is fixed to {FIXED_GOAL_IRON}; nutrition is fixed to {FIXED_NUTRITION_GOAL}.
        </Text>
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

      <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <ValueStepper
          label="Baseline stress"
          value={value.baseline_stress_level ?? 5}
          unit="/ 10"
          step={1}
          min={1}
          max={10}
          onChange={(baseline_stress_level) => onChange({ baseline_stress_level })}
        />
        <Text className="mt-3 text-center font-body text-xs text-[#6B7568]">
          Baseline nervous-system load · 1 calm · 10 overloaded
        </Text>
      </View>

      <TrainingFrequencySelect
        value={value.training_days_per_week}
        onChange={(training_days_per_week) =>
          onChange({ training_days_per_week, frequency_iron: training_days_per_week })
        }
      />
    </View>
  );
}
