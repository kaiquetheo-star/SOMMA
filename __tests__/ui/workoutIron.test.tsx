/**
 * FASE 7 — Quiet Luxury UI snapshots for the Iron execution experience.
 * Native modules are mocked to lightweight host components so the render
 * tree (classes, copy, structure) is asserted deterministically in node.
 */
import { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function host(name: string): ComponentType<Record<string, unknown>> {
  const Component = (props: Record<string, unknown>) => createElement(name, props);
  Component.displayName = name;
  return Component;
}

vi.mock('react-native', () => ({
  View: host('View'),
  Text: host('Text'),
  Pressable: host('Pressable'),
  TextInput: host('TextInput'),
  Platform: { OS: 'ios' },
  BackHandler: {
    addEventListener: () => ({ remove: () => {} }),
  },
}));

vi.mock('react-native-reanimated', () => {
  const chain = { duration: (_ms: number) => chain };
  const AnimatedView = host('Animated.View');
  return {
    default: {
      View: AnimatedView,
      createAnimatedComponent: (component: unknown) => component,
    },
    Easing: {
      ease: (t: number) => t,
      inOut: (fn: (t: number) => number) => fn,
      out: (fn: (t: number) => number) => fn,
      cubic: (t: number) => t,
    },
    FadeIn: chain,
    FadeOut: chain,
    cancelAnimation: () => {},
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (factory: () => object) => factory(),
    useAnimatedProps: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    withRepeat: (value: number) => value,
    withSequence: (...values: number[]) => values[0],
  };
});

vi.mock('react-native-svg', () => ({
  default: host('Svg'),
  Circle: host('Circle'),
  G: host('G'),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: host('SafeAreaView'),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useLocalSearchParams: () => ({}),
}));

vi.mock('@/lib/haptics', () => ({
  hapticSetLogged: vi.fn(async () => {}),
  hapticRestTick: vi.fn(async () => {}),
  hapticRestComplete: vi.fn(async () => {}),
  hapticPhaseChange: vi.fn(async () => {}),
  hapticRoundEnd: vi.fn(async () => {}),
  hapticButtonTap: vi.fn(async () => {}),
  hapticRestStart: vi.fn(async () => {}),
  hapticRestWarning: vi.fn(async () => {}),
}));

vi.mock('@/hooks/useWorkoutNavigation', () => ({
  completionFromParams: () => null,
}));

vi.mock('@/store/useSommaStore', () => ({
  useSommaStore: (selector: (state: object) => unknown) =>
    selector({ completeWorkout: vi.fn(async () => {}) }),
}));

import { TempoVisualizer } from '@/components/iron/TempoVisualizer';
import { CueCard } from '@/components/workout/CueCard';
import { RestTimer } from '@/components/workout/RestTimer';
import { SetLogger } from '@/components/workout/SetLogger';
import AscensionFlareScreen from '@/app/(workout)/ascension';
import { hapticButtonTap, hapticRestStart } from '@/lib/haptics';

const CUE_PROPS = {
  setup: 'Pés na largura dos ombros, barra sobre o mediopé, escápulas retraídas.',
  vector: 'Empurre o chão para longe — força vertical, joelhos seguindo os dedos.',
  catch: 'Glúteo e core firmes no topo, sem hiperextensão lombar.',
  anti_pattern: 'Não deixe os joelhos colapsarem para dentro na subida.',
};

function renderTree(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

describe('Iron exercise card (Quiet Luxury)', () => {
  it('renders tempo pills + cue card + set logger for a mocked exercise', () => {
    const View = host('View');
    const renderer = renderTree(
      createElement(
        View,
        null,
        createElement(TempoVisualizer, {
          tempo: [3, 1, 'X', 0],
          activePhase: 'eccentric',
        }),
        createElement(CueCard, CUE_PROPS),
        createElement(SetLogger, {
          weight: 80,
          reps: 8,
          rir: 2,
          targetRir: 2,
          isBodyweight: false,
          setLabel: 'Log Set 1',
          onWeightChange: () => {},
          onRepsChange: () => {},
          onRirChange: () => {},
          onLog: () => {},
        }),
      ),
    );

    expect(renderer.toJSON()).toMatchSnapshot('iron-exercise-card');
    renderer.unmount();
  });

  it('highlights the concentric pill in Matte Gold when activePhase drives it', () => {
    const renderer = renderTree(
      createElement(TempoVisualizer, {
        tempo: [3, 1, 'X', 0],
        activePhase: 'concentric',
      }),
    );

    const pills = renderer.root.findAll(
      (node) =>
        node.type === 'View' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('border-matte-gold bg-matte-gold/20'),
    );
    expect(pills).toHaveLength(1);
    renderer.unmount();
  });
});

describe('RestTimer', () => {
  it('matches snapshot at 50% progress and fires the opening haptic', () => {
    const renderer = renderTree(
      createElement(RestTimer, { remaining: 45, total: 90, onSkip: () => {} }),
    );

    expect(hapticRestStart).toHaveBeenCalledTimes(1);
    expect(renderer.toJSON()).toMatchSnapshot('rest-timer-50pct');
    renderer.unmount();
  });

  it('skip control uses the quiet bottom-right copy', () => {
    const onSkip = vi.fn();
    const renderer = renderTree(
      createElement(RestTimer, { remaining: 30, total: 90, onSkip }),
    );

    const skipLabel = renderer.root.findAll(
      (node) => node.props.children === 'Pular descanso',
    );
    expect(skipLabel.length).toBeGreaterThan(0);
    renderer.unmount();
  });
});

describe('CueCard', () => {
  it('collapsed shows setup only; expanded reveals vector/catch/anti-pattern', () => {
    const renderer = renderTree(createElement(CueCard, CUE_PROPS));
    expect(renderer.toJSON()).toMatchSnapshot('cue-card-collapsed');

    const toggle = renderer.root.findAll(
      (node) =>
        node.type === 'Pressable' && node.props.accessibilityState?.expanded === false,
    )[0];
    expect(toggle).toBeDefined();
    act(() => {
      (toggle!.props.onPress as () => void)();
    });

    expect(hapticButtonTap).toHaveBeenCalledTimes(1);
    expect(renderer.toJSON()).toMatchSnapshot('cue-card-expanded');

    const antiPattern = renderer.root.findAll(
      (node) => node.props.children === CUE_PROPS.anti_pattern,
    );
    expect(antiPattern.length).toBeGreaterThan(0);
    renderer.unmount();
  });
});

describe('Ascension Flare', () => {
  it('matches snapshot — obsidian, radial glow, Protocolo Completo', () => {
    const renderer = renderTree(createElement(AscensionFlareScreen));
    expect(renderer.toJSON()).toMatchSnapshot('ascension-flare');

    const title = renderer.root.findAll(
      (node) => node.props.children === 'Protocolo Completo',
    );
    expect(title.length).toBeGreaterThan(0);
    renderer.unmount();
  });
});
