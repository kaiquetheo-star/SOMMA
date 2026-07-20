import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_HORMONAL_PROTOCOL,
  ensureHormonalProtocol,
  withFixedBiologicalProfile,
  type BiologicalProfile,
} from '@/types/biological';
import { resolveVolumeLimitsForSplit } from '@/lib/gameplan/engine/iron/volumeMatrix';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: <T,>(values: { web?: T; default?: T }) => values.web ?? values.default,
  },
}));

vi.mock('@/lib/gameplan/fetchDailyGameplan', () => ({
  fetchDailyGameplan: vi.fn(),
}));

vi.mock('@/lib/catalog/library', () => ({
  fetchLibraryExercises: vi.fn(async () => []),
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

let useSommaStore: typeof import('@/store/useSommaStore').useSommaStore;

const TRT_PROTOCOL = {
  type: 'trt' as const,
  weekly_dose_mg: 200,
  recovery_multiplier: 1.5 as const,
};

describe('hormonal_protocol persistence', () => {
  beforeAll(async () => {
    vi.stubGlobal('__DEV__', false);
    ({ useSommaStore } = await import('@/store/useSommaStore'));
  });

  beforeEach(() => {
    useSommaStore.setState({
      user_biological: withFixedBiologicalProfile({
        weight_kg: 58,
        baseline_stress_level: 5,
        hormonal_protocol: { ...DEFAULT_HORMONAL_PROTOCOL },
      }),
    });
  });

  it('Cenário A: estado sem chave hormonal_protocol → rehydrate → natural (nunca undefined)', () => {
    const legacyWithoutKey = {
      weight_kg: 58,
      baseline_stress_level: 5,
      hormonal_transition: false,
    } as Partial<BiologicalProfile>;

    // Simulate persisted snapshot that omitted undefined via JSON.stringify.
    delete (legacyWithoutKey as { hormonal_protocol?: unknown }).hormonal_protocol;

    const hydrated = withFixedBiologicalProfile(legacyWithoutKey);

    expect(hydrated.hormonal_protocol).toBeDefined();
    expect(hydrated.hormonal_protocol!).toEqual(DEFAULT_HORMONAL_PROTOCOL);
    expect(hydrated.hormonal_protocol!.type).toBe('natural');
    expect(ensureHormonalProtocol(undefined).type).toBe('natural');
  });

  it('Cenário B: usuário TRT → patch de outro campo → TRT preservado', () => {
    useSommaStore.setState({
      user_biological: withFixedBiologicalProfile({
        weight_kg: 58,
        baseline_stress_level: 5,
        hormonal_protocol: TRT_PROTOCOL,
      }),
    });

    expect(useSommaStore.getState().user_biological.hormonal_protocol).toEqual(TRT_PROTOCOL);

    // "reset"/update of another field must not wipe protocol.
    useSommaStore.getState().setUserBiological({ weight_kg: 60 });

    expect(useSommaStore.getState().user_biological.weight_kg).toBe(60);
    expect(useSommaStore.getState().user_biological.hormonal_protocol).toEqual(TRT_PROTOCOL);
  });

  it('Cenário C: resolveVolumeLimitsForSplit — TRT aplica boost MRV; natural não', () => {
    const natural = resolveVolumeLimitsForSplit('abcde', {
      hormonal_protocol: { ...DEFAULT_HORMONAL_PROTOCOL },
    });
    const trt = resolveVolumeLimitsForSplit('abcde', {
      hormonal_protocol: TRT_PROTOCOL,
    });

    expect(natural.mrvSoft).toBe(22);
    expect(natural.mrvHard).toBe(26);
    expect(trt.mrvSoft).toBe(26);
    expect(trt.mrvHard).toBe(30);
    expect(trt.mrvSoft).toBeGreaterThan(natural.mrvSoft);
    expect(trt.mrvHard).toBeGreaterThan(natural.mrvHard);
  });
});
