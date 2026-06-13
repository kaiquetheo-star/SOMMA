import type {
  AxialLoading,
  LibraryExercise,
  ResistanceProfile,
  SpecificExerciseCues,
  StabilityDemand,
  TacticalCatalogMetadata,
  TacticalExerciseRole,
} from '@/types/catalog';

type TacticalRule = TacticalCatalogMetadata & {
  slugs: readonly string[];
  nameIncludes?: readonly string[];
};

type TechniqueSafeExercise = Pick<
  TacticalCatalogMetadata,
  'stability_demand' | 'resistance_profile'
>;

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

const CUES: Record<string, SpecificExerciseCues> = {
  cable_lateral_raise: {
    setup: 'Posicione o cabo atrás do corpo e mantenha o tronco quieto, com leve inclinação para longe da polia.',
    execution: 'Mantenha o cotovelo levemente à frente da linha do tronco; puxe pela lateral, não para cima.',
    common_mistake: 'Não transforme a repetição em encolhimento de trapézio nem roube com balanço do quadril.',
  },
  barbell_bench_press: {
    setup: 'Escápulas retraídas e deprimidas, pés cravados no chão e punhos empilhados sobre os cotovelos.',
    execution: 'Desça a barra ao esterno baixo com controle e empurre o banco para longe sem perder a ponte torácica.',
    common_mistake: 'Não deixe os ombros anteriorizarem nem os cotovelos abrirem agressivamente no fundo.',
  },
  barbell_back_squat: {
    setup: 'Trave o brace 360 graus antes de destravar a barra e encontre pressão tripé nos pés.',
    execution: 'Desça entre os quadris mantendo joelhos acompanhando os dedos e suba empurrando o chão.',
    common_mistake: 'Não deixe a pelve apagar no fundo nem transforme a subida em bom-dia lombar.',
  },
  barbell_squat: {
    setup: 'Trave o brace 360 graus antes de destravar a barra e encontre pressão tripé nos pés.',
    execution: 'Desça entre os quadris mantendo joelhos acompanhando os dedos e suba empurrando o chão.',
    common_mistake: 'Não deixe a pelve apagar no fundo nem transforme a subida em bom-dia lombar.',
  },
  conventional_deadlift: {
    setup: 'Aproxime a barra da canela, tensione dorsais e tire a folga da barra antes de puxar.',
    execution: 'Empurre o chão e leve quadril e ombros juntos até a barra passar o joelho.',
    common_mistake: 'Não arranque a barra com a lombar relaxada nem hiperestenda no lockout.',
  },
  barbell_bent_over_row: {
    setup: 'Fixe o tronco no hinge com abdômen travado e dorsais tensionados antes da primeira puxada.',
    execution: 'Puxe os cotovelos para trás em direção ao quadril mantendo a barra próxima ao corpo.',
    common_mistake: 'Não deixe o torso subir a cada repetição para transformar a remada em encolhimento.',
  },
  seated_cable_row: {
    setup: 'Sente alto, costelas baixas e alcance a escápula sem perder a posição da lombar.',
    execution: 'Inicie puxando a escápula para trás e termine levando os cotovelos ao bolso.',
    common_mistake: 'Não jogue o tronco para trás para completar a repetição.',
  },
  dumbbell_fly: {
    setup: 'Deite com escápulas estáveis e halteres alinhados sobre o peitoral, cotovelos suavemente flexionados.',
    execution: 'Abra em arco até sentir alongamento do peitoral e feche abraçando, sem bater os halteres.',
    common_mistake: 'Não transforme em supino dobrando demais os cotovelos ou descendo além do ombro tolerar.',
  },
  leg_press: {
    setup: 'Apoie a pelve inteira no banco e posicione os pés para permitir joelhos avançarem sem tirar o quadril.',
    execution: 'Desça controlando a profundidade e empurre a plataforma mantendo tensão contínua nos quadríceps.',
    common_mistake: 'Não trave os joelhos no topo nem deixe a lombar arredondar no fundo.',
  },
  hack_squat: {
    setup: 'Cole quadril e costas no encosto, pés em posição que permita joelhos viajarem para frente com controle.',
    execution: 'Desça verticalmente e suba empurrando a plataforma sem descansar no topo.',
    common_mistake: 'Não encurte a amplitude para preservar carga no ego.',
  },
};

const RULES: readonly TacticalRule[] = [
  {
    slugs: ['barbell_back_squat', 'barbell_squat', 'front_squat', 'conventional_deadlift', 'trap_bar_deadlift'],
    nameIncludes: ['back_squat', 'deadlift'],
    tactical_role: 'primary_compound',
    stability_demand: 'high',
    axial_loading: 5,
    resistance_profile: 'ascending',
  },
  {
    slugs: ['barbell_bench_press', 'bench_press', 'barbell_incline_bench_press'],
    tactical_role: 'primary_compound',
    stability_demand: 'medium',
    axial_loading: 0,
    resistance_profile: 'bell_shaped',
  },
  {
    slugs: ['barbell_bent_over_row', 'pendlay_row', 'bent_over_rowing', 'bent_over_rowing_reverse'],
    nameIncludes: ['bent_over_row'],
    tactical_role: 'secondary_compound',
    stability_demand: 'high',
    axial_loading: 4,
    resistance_profile: 'bell_shaped',
  },
  {
    slugs: ['barbell_romanian_deadlift', 'romanian_deadlift', 'stiff_leg_deadlift', 'rack_pull'],
    tactical_role: 'primary_compound',
    stability_demand: 'high',
    axial_loading: 4,
    resistance_profile: 'ascending',
  },
  {
    slugs: ['barbell_overhead_press', 'overhead_barbell_press'],
    tactical_role: 'primary_compound',
    stability_demand: 'high',
    axial_loading: 3,
    resistance_profile: 'bell_shaped',
  },
  {
    slugs: ['barbell_seated_behind_head_military_press', 'barbell_silverback_shrug'],
    tactical_role: 'secondary_compound',
    stability_demand: 'medium',
    axial_loading: 2,
    resistance_profile: 'bell_shaped',
  },
  {
    slugs: ['hack_squat', 'hack_squat_machine', 'sled_hack_squat', 'smith_hack_squat', 'leg_press', 'sled_45_leg_press'],
    nameIncludes: ['hack_squat', 'leg_press'],
    tactical_role: 'secondary_compound',
    stability_demand: 'low',
    axial_loading: 1,
    resistance_profile: 'constant',
  },
  {
    slugs: ['dumbbell_fly', 'dumbbell_flye', 'crucifixo_halter'],
    nameIncludes: ['dumbbell_fly', 'crucifixo'],
    tactical_role: 'isolation_metabolic',
    stability_demand: 'medium',
    axial_loading: 0,
    resistance_profile: 'descending',
  },
  {
    slugs: ['pec_deck', 'reverse_pec_deck', 'machine_reverse_fly'],
    nameIncludes: ['pec_deck', 'reverse_pec_deck', 'reverse_fly_machine'],
    tactical_role: 'isolation_metabolic',
    stability_demand: 'low',
    axial_loading: 0,
    resistance_profile: 'constant',
  },
  {
    slugs: ['t_bar_row', 'chest_supported_row', 'machine_row', 'seated_cable_row', 'lever_bent_over_row'],
    nameIncludes: ['machine_row', 'cable_row', 'chest_supported_row'],
    tactical_role: 'secondary_compound',
    stability_demand: 'low',
    axial_loading: 1,
    resistance_profile: 'constant',
  },
];

function ruleForExercise(exercise: LibraryExercise): TacticalRule | null {
  const slug = normalizeToken(exercise.slug);
  const name = normalizeToken(exercise.name);

  return (
    RULES.find(
      (rule) =>
        rule.slugs.some((candidate) => slug === candidate || slug.includes(candidate)) ||
        includesAny(name, rule.nameIncludes ?? []),
    ) ?? null
  );
}

function equipmentProfile(exercise: LibraryExercise): {
  isCable: boolean;
  isMachine: boolean;
  isBarbell: boolean;
  isDumbbell: boolean;
} {
  const blob = [
    exercise.slug,
    exercise.name,
    ...exercise.equipment_required,
  ].map(normalizeToken).join('_');

  return {
    isCable: blob.includes('cable') || blob.includes('polia'),
    isMachine: blob.includes('machine') || blob.includes('lever') || blob.includes('smith') || blob.includes('sled'),
    isBarbell: blob.includes('barbell') || blob.includes('barra'),
    isDumbbell: blob.includes('dumbbell') || blob.includes('halter'),
  };
}

function fallbackRole(exercise: LibraryExercise): TacticalExerciseRole {
  const movement = normalizeToken(exercise.movement_pattern);
  const { isCable, isMachine } = equipmentProfile(exercise);

  if (movement === 'isolation') return 'isolation_metabolic';
  if (movement === 'squat' || movement === 'hinge') {
    return isCable || isMachine ? 'secondary_compound' : 'primary_compound';
  }
  if (movement === 'push' || movement === 'pull' || movement === 'lunge') return 'secondary_compound';
  return 'corrective';
}

function fallbackStability(exercise: LibraryExercise): StabilityDemand {
  const { isCable, isMachine, isBarbell } = equipmentProfile(exercise);
  const movement = normalizeToken(exercise.movement_pattern);

  if (isCable || isMachine) return 'low';
  if (isBarbell && (movement === 'squat' || movement === 'hinge')) return 'high';
  return movement === 'isolation' ? 'medium' : 'medium';
}

function fallbackAxialLoading(exercise: LibraryExercise): AxialLoading {
  const slug = normalizeToken(exercise.slug);
  const movement = normalizeToken(exercise.movement_pattern);
  const { isCable, isMachine, isBarbell } = equipmentProfile(exercise);

  if (isCable || isMachine) return 0;
  if (slug.includes('hip_thrust') || slug.includes('glute_bridge')) return 1;
  if (movement === 'squat' && isBarbell) return 5;
  if (movement === 'hinge' && isBarbell) return 4;
  if (movement === 'pull' && slug.includes('row') && isBarbell) return 3;
  return 0;
}

function fallbackResistanceProfile(exercise: LibraryExercise): ResistanceProfile {
  const slug = normalizeToken(exercise.slug);
  const { isCable, isMachine } = equipmentProfile(exercise);

  if (isCable || isMachine) return 'constant';
  if (slug.includes('fly') || slug.includes('raise')) return 'descending';
  if (slug.includes('band')) return 'ascending';
  return 'bell_shaped';
}

export function enrichWithTacticalData(exercise: LibraryExercise): LibraryExercise {
  const rule = ruleForExercise(exercise);
  const slug = normalizeToken(exercise.slug);

  return {
    ...exercise,
    tactical_role: rule?.tactical_role ?? fallbackRole(exercise),
    stability_demand: rule?.stability_demand ?? fallbackStability(exercise),
    axial_loading: rule?.axial_loading ?? fallbackAxialLoading(exercise),
    resistance_profile: rule?.resistance_profile ?? fallbackResistanceProfile(exercise),
    specific_cues: exercise.specific_cues ?? CUES[slug],
  };
}

export function supportsAdvancedMetabolicTechnique(exercise: TechniqueSafeExercise): boolean {
  return exercise.stability_demand === 'low' || exercise.resistance_profile === 'constant';
}
