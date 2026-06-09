import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { MicrocycleDay } from '@/types/gameplan';

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'] as const;

interface WeeklyStripProps {
  microcycle: MicrocycleDay[] | null;
  selectedDayIndex: number;
  todayDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
}

function dayState(dayIndex: number, todayDayIndex: number): 'past' | 'today' | 'future' {
  if (dayIndex === todayDayIndex) return 'today';
  return dayIndex < todayDayIndex ? 'past' : 'future';
}

export function WeeklyStrip({
  microcycle,
  selectedDayIndex,
  todayDayIndex,
  onSelectDay,
}: WeeklyStripProps) {
  const router = useRouter();

  return (
    <View className="border-b border-white/10 bg-[#0F1512] pb-3 pt-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4"
      >
        {DAYS.map((day, index) => {
          const dayIndex = index + 1;
          const state = dayState(dayIndex, todayDayIndex);
          const isSelected = selectedDayIndex === dayIndex;
          const protocolDay = microcycle?.find((entry) => entry.day_index === dayIndex);
          const hasIron = protocolDay?.blocks.some((block) => block.pillar === 'iron') === true;

          return (
            <Pressable
              key={day}
              onPress={() => {
                onSelectDay(dayIndex);
                router.push(`/(tabs)/home?dayIndex=${dayIndex}` as Href);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${day}${state === 'today' ? ', hoje' : ''}${hasIron ? ', protocolo de ferro' : ', recuperacao'}`}
              className={`h-14 w-12 items-center justify-center rounded-2xl border active:opacity-85 ${
                isSelected || state === 'today'
                  ? 'border-[#BFA06A] bg-[#BFA06A]/20'
                  : state === 'past'
                    ? 'border-white/5 bg-[#0A0E0C] opacity-45'
                    : 'border-white/10 bg-white/5 opacity-70'
              }`}
              style={
                isSelected
                  ? {
                      shadowColor: '#BFA06A',
                      shadowOpacity: 0.25,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 0 },
                    }
                  : undefined
              }
            >
              <Text
                className={`font-body-medium text-xs ${
                  isSelected || state === 'today' ? 'text-[#BFA06A]' : 'text-[#8A9488]'
                }`}
              >
                {day}
              </Text>
              <View
                className={`mt-1.5 h-1.5 w-1.5 rounded-full ${
                  hasIron
                    ? isSelected || state === 'today'
                      ? 'bg-[#BFA06A]'
                      : 'bg-white/30'
                    : 'bg-transparent'
                }`}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
