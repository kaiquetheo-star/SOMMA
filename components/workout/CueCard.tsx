import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { hapticButtonTap } from '@/lib/haptics';

interface CueCardProps {
  setup?: string | null;
  vector?: string | null;
  catch?: string | null;
  anti_pattern?: string | null;
}

interface CueEntry {
  key: string;
  label: string;
  glyph: string;
  value: string;
  tone: 'default' | 'warning';
}

const EXPAND_MS = 300;

/**
 * Glassmorphism cue card — collapsed shows setup only; expanding reveals
 * vector, catch and anti-pattern with subtle glyphs. Quiet Luxury, no noise.
 */
export function CueCard({ setup, vector, catch: catchCue, anti_pattern }: CueCardProps) {
  const [expanded, setExpanded] = useState(false);

  const detailEntries: CueEntry[] = [
    vector ? { key: 'vector', label: 'Vetor', glyph: '→', value: vector, tone: 'default' as const } : null,
    catchCue ? { key: 'catch', label: 'Catch', glyph: '✦', value: catchCue, tone: 'default' as const } : null,
    anti_pattern
      ? { key: 'anti_pattern', label: 'Anti-padrão', glyph: '✕', value: anti_pattern, tone: 'warning' as const }
      : null,
  ].filter((entry): entry is CueEntry => entry != null);

  if (!setup && detailEntries.length === 0) return null;

  const toggle = () => {
    void hapticButtonTap();
    setExpanded((value) => !value);
  };

  return (
    <View className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <View className="px-4 pb-1 pt-3">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/80">
          Cue card
        </Text>
      </View>

      {setup ? (
        <View className="px-4 pt-2">
          <Text
            className="font-body text-sm leading-6 text-[#C8CFC4]"
            numberOfLines={expanded ? undefined : 2}
          >
            {setup}
          </Text>
        </View>
      ) : null}

      {expanded && detailEntries.length > 0 ? (
        <Animated.View
          entering={FadeIn.duration(EXPAND_MS)}
          exiting={FadeOut.duration(EXPAND_MS)}
          className="mt-3 gap-3 border-t border-white/5 px-4 pt-3"
        >
          {detailEntries.map((entry) => (
            <View key={entry.key} className="flex-row gap-3">
              <Text
                className={`w-5 text-center font-body text-sm ${
                  entry.tone === 'warning' ? 'text-red-400/70' : 'text-matte-gold/70'
                }`}
              >
                {entry.glyph}
              </Text>
              <View className="flex-1">
                <Text
                  className={`font-body text-[9px] uppercase tracking-[0.3em] ${
                    entry.tone === 'warning' ? 'text-red-400/60' : 'text-[#6B7568]'
                  }`}
                >
                  {entry.label}
                </Text>
                <Text className="mt-1 font-body text-sm leading-5 text-[#C8CFC4]">
                  {entry.value}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>
      ) : null}

      {detailEntries.length > 0 ? (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          className="px-4 py-3 active:opacity-70"
        >
          <Text className="font-body text-sm text-matte-gold">
            {expanded ? 'Ocultar dicas' : 'Ver dicas completas'}
          </Text>
        </Pressable>
      ) : (
        <View className="pb-3" />
      )}
    </View>
  );
}
