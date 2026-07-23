import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { resolveBlockPreviewLabel } from '@/lib/catalog/library';
import type { GameplanBlock } from '@/types/gameplan';

interface GameplanBlockCardProps {
  block: GameplanBlock;
  onPress: () => void;
}

const STATUS_STYLES = {
  pending: 'border-white/10 bg-white/5',
  active: 'border-matte-gold/35 bg-matte-gold/10',
  completed: 'border-white/5 bg-white/[0.02] opacity-60',
} as const;

const PILLAR_ACCENT: Record<GameplanBlock['pillar'], string> = {
  iron: 'text-[#E8E4DC]',
  nutrition: 'text-matte-gold',
  spirit: 'text-[#B7C7B0]',
  longevity: 'text-[#B7C7B0]',
};

const LONGEVITY_SAGE = '#6B8E78';

/** Glassmorphism ritual block — Daily Command (FSD 3.2) */
export function GameplanBlockCard({ block, onPress }: GameplanBlockCardProps) {
  const isCompleted = block.status === 'completed';
  const [previewLabel, setPreviewLabel] = useState(block.subtitle);

  useEffect(() => {
    let mounted = true;
    void resolveBlockPreviewLabel(block).then((label) => {
      if (mounted && label) setPreviewLabel(label);
    });
    return () => {
      mounted = false;
    };
  }, [block]);

  return (
    <Pressable
      onPress={onPress}
      disabled={isCompleted}
      accessibilityRole="button"
      accessibilityLabel={`Start ${block.title}`}
      accessibilityState={{ disabled: isCompleted }}
      className={`min-w-0 overflow-hidden rounded-2xl border px-5 py-4 active:opacity-85 ${STATUS_STYLES[block.status]}`}
      style={
        block.pillar === 'longevity'
          ? {
              borderColor: `${LONGEVITY_SAGE}55`,
              shadowColor: LONGEVITY_SAGE,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: block.status === 'active' ? 0.18 : 0.08,
              shadowRadius: 10,
            }
          : block.status === 'active'
          ? {
              shadowColor: '#BFA06A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
            }
          : undefined
      }
    >
      {isCompleted ? (
        <View className="absolute right-4 top-4">
          <Text className="font-body text-lg text-[#BFA06A]">✓</Text>
        </View>
      ) : null}
      <View className="min-w-0 flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text className="flex-shrink whitespace-normal break-words font-body text-[10px] uppercase leading-5 tracking-[0.28em] text-[#6B7568]">
            {block.duration_minutes} min · {block.pillar}
          </Text>
          <Text className={`mt-2 flex-shrink whitespace-normal break-words font-display text-xl leading-7 ${PILLAR_ACCENT[block.pillar]}`}>
            {block.title}
          </Text>
          <Text className="mt-2 flex-shrink whitespace-normal break-words font-body text-sm leading-5 text-[#8A9488]">
            {previewLabel}
          </Text>
          {block.longevity ? (
            <View className="mt-4 gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
              <View>
                <Text className="font-body text-[10px] uppercase tracking-[0.24em] text-[#6B8E78]">
                  Mobilidade
                </Text>
                <Text className="mt-1 font-body text-sm leading-5 text-[#E8E4DC]">
                  {block.longevity.mobility_focus}
                </Text>
                <View className="mt-2 gap-1">
                  {block.longevity.mobility_cues.map((cue) => (
                    <Text key={cue} className="font-body text-xs leading-5 text-[#8A9488]">
                      • {cue}
                    </Text>
                  ))}
                </View>
              </View>
              <View className="gap-1">
                <Text className="font-body text-xs leading-5 text-[#B7C7B0]">
                  Core · {block.longevity.core_exercise}
                </Text>
                <Text className="font-body text-xs leading-5 text-[#B7C7B0]">
                  Cardio · {block.longevity.cardio_prescription}
                </Text>
              </View>
            </View>
          ) : null}
          <Text
            className={`mt-4 font-body-medium text-xs uppercase tracking-[0.26em] ${
              isCompleted ? 'text-matte-gold/70' : 'text-matte-gold'
            }`}
            style={
              !isCompleted && block.pillar === 'longevity' ? { color: LONGEVITY_SAGE } : undefined
            }
          >
            {isCompleted
              ? 'Protocolo Concluído'
              : block.pillar === 'longevity'
                ? 'Iniciar Mobilidade'
                : 'Iniciar Protocolo'}
          </Text>
        </View>
        <Text
          className="shrink-0 font-body text-lg text-matte-gold/80"
          style={block.pillar === 'longevity' ? { color: LONGEVITY_SAGE } : undefined}
        >
          {isCompleted ? '' : '→'}
        </Text>
      </View>
    </Pressable>
  );
}
