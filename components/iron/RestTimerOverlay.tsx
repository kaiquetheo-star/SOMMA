import { Pressable, Text, View } from 'react-native';

interface RestTimerOverlayProps {
  remaining: number;
  total: number;
  onSkip: () => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RestTimerOverlay({ remaining, total, onSkip }: RestTimerOverlayProps) {
  const progress = total > 0 ? remaining / total : 0;

  return (
    <View className="absolute inset-0 z-10 items-center justify-center bg-obsidian/95 px-8">
      <Text className="font-body text-[10px] uppercase tracking-[0.45em] text-matte-gold/80">
        Rest · Breathe
      </Text>
      <Text className="mt-6 font-display-bold text-7xl text-matte-gold">
        {formatTimer(remaining)}
      </Text>
      <View className="mt-8 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <View
          className="h-full rounded-full bg-matte-gold/70"
          style={{ width: `${progress * 100}%` }}
        />
      </View>
      <Pressable onPress={onSkip} className="mt-10 active:opacity-70">
        <Text className="font-body text-xs uppercase tracking-[0.35em] text-[#6B7568]">
          Skip rest
        </Text>
      </Pressable>
    </View>
  );
}
