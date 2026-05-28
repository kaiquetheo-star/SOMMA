import { Text, View } from 'react-native';

import { PillarNode, type PillarNodeConfig } from '@/components/mastery/PillarNode';
import type { FocusPreference, UserStats } from '@/store/useSommaStore';
import type { PerformanceLogEntry } from '@/types/performance';

const PILLAR_CELL_MIN_HEIGHT = 132;

interface MasteryConstellationProps {
  stats: UserStats;
  focus: FocusPreference | null;
  performanceLogs: PerformanceLogEntry[];
}

interface PillarSessionCounts {
  body: number;
  combat: number;
  spirit: number;
  mind: number;
}

function pillarSessionCounts(logs: PerformanceLogEntry[]): PillarSessionCounts {
  const counts: PillarSessionCounts = { body: 0, combat: 0, spirit: 0, mind: 0 };

  for (const log of logs) {
    if (log.pillar === 'iron') counts.body += 1;
    else if (log.pillar === 'combat') counts.combat += 1;
    else if (log.pillar === 'spirit') counts.spirit += 1;
    else if (log.pillar === 'flow') counts.mind += 1;
  }

  return counts;
}

interface FocusMetricRowProps {
  label: string;
  focusPct: number;
  sessions: number;
}

function FocusMetricRow({ label, focusPct, sessions }: FocusMetricRowProps) {
  const pct = Math.min(100, Math.max(0, Math.round(focusPct)));

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="font-body text-[10px] uppercase tracking-[0.28em] text-[#8A9488]">
          {label}
        </Text>
        <View className="flex-row items-baseline gap-2">
          <Text className="font-body-medium text-sm text-[#E8E4DC]">{pct}%</Text>
          <Text className="font-body text-[10px] text-[#6B7568]">
            · {sessions} log{sessions === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
      <View className="h-px overflow-hidden rounded-full bg-white/10">
        <View
          className="h-full rounded-full bg-[#BFA06A]"
          style={{ width: `${pct}%` }}
        />
      </View>
    </View>
  );
}

/** Unified Constellation — symmetric pillar grid and focus telemetry (local, text-first). */
export function MasteryConstellation({
  stats,
  focus,
  performanceLogs,
}: MasteryConstellationProps) {
  const counts = pillarSessionCounts(performanceLogs);
  const focusWeights = focus ?? { iron: 25, combat: 25, flow: 25, spirit: 25 };

  const pillars: PillarNodeConfig[] = [
    {
      id: 'mind',
      label: 'Mind',
      essence: stats.mind_essence,
      focusWeight: focusWeights.flow,
      sessionCount: counts.mind,
    },
    {
      id: 'combat',
      label: 'Combat',
      essence: stats.combat_mastery,
      focusWeight: focusWeights.combat,
      sessionCount: counts.combat,
    },
    {
      id: 'body',
      label: 'Body',
      essence: stats.body_essence,
      focusWeight: focusWeights.iron,
      sessionCount: counts.body,
    },
    {
      id: 'spirit',
      label: 'Spirit',
      essence: stats.spirit_essence,
      focusWeight: focusWeights.spirit,
      sessionCount: counts.spirit,
    },
  ];

  const [mind, combat, body, spirit] = pillars;

  const focusRows: FocusMetricRowProps[] = [
    { label: 'Mind', focusPct: mind.focusWeight, sessions: mind.sessionCount },
    { label: 'Combat', focusPct: combat.focusWeight, sessions: combat.sessionCount },
    { label: 'Body', focusPct: body.focusWeight, sessions: body.sessionCount },
    { label: 'Spirit', focusPct: spirit.focusWeight, sessions: spirit.sessionCount },
  ];

  const totalFocus = focusRows.reduce((sum, row) => sum + row.focusPct, 0);

  return (
    <View className="w-full items-center">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Pillar matrix
      </Text>
      <Text className="mt-2 max-w-md text-center font-body text-sm leading-6 text-[#8A9488]">
        Disc size reflects essence. Opacity reflects your Foundation focus split. Layout is fixed —
        no drift across viewports.
      </Text>

      <View className="mt-8 w-full max-w-md">
        <View className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6">
          <View className="flex-row gap-3">
            <View
              className="flex-1 items-center justify-center"
              style={{ minHeight: PILLAR_CELL_MIN_HEIGHT }}
            >
              <PillarNode config={mind} />
            </View>
            <View
              className="flex-1 items-center justify-center"
              style={{ minHeight: PILLAR_CELL_MIN_HEIGHT }}
            >
              <PillarNode config={combat} />
            </View>
          </View>

          <View className="my-4 items-center">
            <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/60">
              Somma
            </Text>
          </View>

          <View className="flex-row gap-3">
            <View
              className="flex-1 items-center justify-center"
              style={{ minHeight: PILLAR_CELL_MIN_HEIGHT }}
            >
              <PillarNode config={body} />
            </View>
            <View
              className="flex-1 items-center justify-center"
              style={{ minHeight: PILLAR_CELL_MIN_HEIGHT }}
            >
              <PillarNode config={spirit} />
            </View>
          </View>
        </View>

        <View className="mt-8 gap-5">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
              Focus distribution
            </Text>
            <Text className="font-body text-[10px] text-[#6B7568]">
              Total {Math.round(totalFocus)}%
            </Text>
          </View>

          {focusRows.map((row) => (
            <FocusMetricRow
              key={row.label}
              label={row.label}
              focusPct={row.focusPct}
              sessions={row.sessions}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
