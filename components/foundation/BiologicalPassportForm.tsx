import { Text, View } from 'react-native';

import { SelectionTile } from '@/components/foundation/SelectionTile';
import { TrainingFrequencySelect } from '@/components/foundation/TrainingFrequencySelect';
import { ValueStepper } from '@/components/iron/ValueStepper';
import {
  ageFromDateOfBirth,
  FIXED_GOAL_IRON,
  FIXED_HEIGHT_CM,
  FIXED_NUTRITION_GOAL,
  type MesocyclePhase,
  type BiologicalProfile,
  type PreferredSplit,
} from '@/types/biological';

interface BiologicalPassportFormProps {
  value: BiologicalProfile;
  onChange: (patch: Partial<BiologicalProfile>) => void;
}

const MESOCYCLE_PHASE_OPTIONS: Array<{
  id: MesocyclePhase;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'bulking',
    label: 'Bulking',
    subtitle: 'Ganhando massa, superavit calorico',
  },
  {
    id: 'cutting',
    label: 'Cutting',
    subtitle: 'Perdendo gordura, deficit calorico',
  },
  {
    id: 'maintenance',
    label: 'Manutencao',
    subtitle: 'Mantendo peso atual',
  },
  {
    id: 'deload',
    label: 'Deload',
    subtitle: 'Semana de recuperacao ativa',
  },
];

const PREFERRED_SPLIT_OPTIONS: Array<{
  id: PreferredSplit;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'abcdef',
    label: 'ABCDEF Specialization',
    subtitle: 'Recommended for X-Frame: six unique specialized days + Day 7 recovery.',
  },
  {
    id: 'ppl_x2',
    label: 'PPL x2',
    subtitle: 'Legacy push/pull/legs rotation repeated twice per week.',
  },
];

export function BiologicalPassportForm({ value, onChange }: BiologicalPassportFormProps) {
  const age = ageFromDateOfBirth(value.date_of_birth);
  const selectedMesocyclePhase = value.mesocycle_phase ?? 'maintenance';
  const selectedPreferredSplit = value.preferred_split ?? 'abcdef';

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

      <View className="gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5">
        <View>
          <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/70">
            Preferred Split
          </Text>
          <Text className="mt-2 font-body text-xs leading-5 text-[#6B7568]">
            Choose the weekly Iron architecture. ABCDEF is the default for shoulder width,
            posterior balance, and non-redundant specialization.
          </Text>
        </View>

        {PREFERRED_SPLIT_OPTIONS.map((option) => (
          <SelectionTile
            key={option.id}
            label={option.label}
            subtitle={option.subtitle}
            selected={selectedPreferredSplit === option.id}
            onPress={() => onChange({ preferred_split: option.id })}
            accessibilityLabel={`Select ${option.label} preferred split`}
          />
        ))}
      </View>

      <View className="gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5">
        <View>
          <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/70">
            Mesocycle phase
          </Text>
          <Text className="mt-2 font-body text-xs leading-5 text-[#6B7568]">
            Controls weekly Iron volume: compounds stay moderate, isolations can climb during cutting,
            and deload reduces systemic load.
          </Text>
        </View>

        {MESOCYCLE_PHASE_OPTIONS.map((option) => (
          <SelectionTile
            key={option.id}
            label={option.label}
            subtitle={option.subtitle}
            selected={selectedMesocyclePhase === option.id}
            onPress={() => onChange({ mesocycle_phase: option.id })}
            accessibilityLabel={`Select ${option.label} mesocycle phase`}
          />
        ))}
      </View>
    </View>
  );
}
