import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface WorkoutShellProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  onComplete?: () => void;
  footer?: ReactNode;
  completeLabel?: string;
  completeDisabled?: boolean;
  accent?: 'obsidian' | 'copper' | 'dark';
}

const ACCENT_BG = {
  obsidian: 'bg-obsidian',
  copper: 'bg-[#120A0A]',
  dark: 'bg-[#0D1210]',
} as const;

export function WorkoutShell({
  eyebrow,
  title,
  children,
  onComplete,
  footer,
  completeLabel = 'Complete Ritual',
  completeDisabled = false,
  accent = 'obsidian',
}: WorkoutShellProps) {
  const router = useRouter();

  return (
    <SafeAreaView className={`flex-1 ${ACCENT_BG[accent]}`}>
      <StatusBar style="light" />
      <View className="flex-1 px-6 pb-8 pt-4">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Exit workout"
          className="self-start py-2 active:opacity-60"
        >
          <Text className="font-body text-xs uppercase tracking-[0.3em] text-[#6B7568]">
            Exit
          </Text>
        </Pressable>

        <View className="mt-4">
          <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
            {eyebrow}
          </Text>
          <Text className="mt-3 font-display-bold text-3xl text-[#E8E4DC]">{title}</Text>
        </View>

        <View className="mt-8 flex-1">{children}</View>

        {footer ? (
          <View className="mt-4">{footer}</View>
        ) : onComplete ? (
          <Pressable
            onPress={onComplete}
            disabled={completeDisabled}
            accessibilityRole="button"
            accessibilityLabel="Complete ritual"
            accessibilityState={{ disabled: completeDisabled }}
            className={`mt-4 overflow-hidden rounded-2xl border px-8 py-5 ${
              completeDisabled
                ? 'border-white/5 bg-white/[0.02] opacity-40'
                : 'border-matte-gold/40 bg-matte-gold/10 active:opacity-80'
            }`}
          >
            <Text
              className={`text-center font-body-medium text-sm uppercase tracking-[0.35em] ${
                completeDisabled ? 'text-[#6B7568]' : 'text-matte-gold'
              }`}
            >
              {completeLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
