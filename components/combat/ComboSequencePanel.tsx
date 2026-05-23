import { Text, View } from 'react-native';

import {
  COMBAT_TACTICAL_FOCUS_DISPLAY,
  type CombatTacticalFocus,
} from '@/types/gameplan';
import type { LibraryCombatCombo } from '@/types/catalog';

interface ComboSequencePanelProps {
  combo: LibraryCombatCombo;
  tacticalFocus?: CombatTacticalFocus;
  /** e.g. "Round 2/5 · 0:45 work" */
  meta?: string;
}

/** Numbered strike sequence + tactical focus — Blood & Bone command surface */
export function ComboSequencePanel({ combo, tacticalFocus, meta }: ComboSequencePanelProps) {
  const focus = tacticalFocus ?? combo.tactical_focus;

  return (
    <View className="gap-4">
      {focus ? (
        <View className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <Text className="font-body text-[10px] uppercase tracking-[0.38em] text-[#8A9488]">
            {COMBAT_TACTICAL_FOCUS_DISPLAY[focus]}
          </Text>
        </View>
      ) : null}

      {meta ? (
        <Text className="font-body text-[10px] uppercase tracking-[0.28em] text-[#6B7568]">
          {meta}
        </Text>
      ) : null}

      <View className="gap-2.5">
        <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/80">
          Strike sequence
        </Text>
        {combo.sequence.length > 0 ? (
          combo.sequence.map((strike, index) => (
            <View
              key={`${strike}-${index}`}
              className="flex-row items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
            >
              <Text className="font-body-medium text-sm tabular-nums text-matte-gold/90">
                {index + 1}
              </Text>
              <Text className="flex-1 font-body-medium text-base uppercase leading-6 tracking-[0.08em] text-[#E8E4DC]">
                {strike}
              </Text>
            </View>
          ))
        ) : (
          <Text className="font-body text-sm leading-6 text-[#8A9488]">
            Combo sequence loading from catalog…
          </Text>
        )}
      </View>
    </View>
  );
}
