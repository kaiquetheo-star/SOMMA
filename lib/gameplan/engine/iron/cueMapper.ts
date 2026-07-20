import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { ExerciseCueCard, ExerciseFailureType } from '@/types/catalog';
import { translateCueToPtBr } from '@/lib/catalog/ptBrCues';

const HEAVY_COMPOUND_PATTERNS = new Set(['push', 'pull', 'squat', 'hinge', 'lunge', 'carry']);

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function instructionValue(
  exercise: CatalogExercise,
  keys: readonly string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = exercise.biomechanical_instructions[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return translateCueToPtBr(value.trim());
    }
  }
  return fallback;
}

function resolveFailureType(exercise: CatalogExercise): ExerciseFailureType {
  const raw = exercise.biomechanical_instructions.failure_type;
  if (raw === 'technical' || raw === 'concentric') return raw;
  if (HEAVY_COMPOUND_PATTERNS.has(exercise.movement_pattern) || exercise.cns_fatigue_cost >= 3) {
    return 'technical';
  }
  return 'concentric';
}

function setupFallback(exercise: CatalogExercise): string {
  if (exercise.movement_pattern === 'push') {
    return 'Retraia e abaixe as escápulas, plante os pés e mantenha os cotovelos a cerca de 45° do tronco.';
  }
  if (exercise.movement_pattern === 'pull') {
    return 'Mantenha o tórax alto, abaixe as escápulas e inicie cada rep pelo músculo-alvo das costas.';
  }
  if (exercise.movement_pattern === 'squat') {
    return 'Braceie 360°, alinhe costelas sobre a pelve e firme os pés antes de descer.';
  }
  if (exercise.movement_pattern === 'hinge') {
    return 'Trave os dorsais, mantenha a barra perto e faça a dobradiça de quadril com coluna neutra.';
  }
  if (exercise.movement_pattern === 'lunge') {
    return 'Estabeleça base estável em split, braceie o tronco e acompanhe o joelho frontal sobre os dedos.';
  }
  return 'Crie uma base estável e alinhe a articulação de trabalho com o músculo-alvo.';
}

function vectorFallback(exercise: CatalogExercise): string {
  const primary = normalizeToken(exercise.primary_muscle);
  if (primary.includes('quad')) return 'Empurre o chão e abra os joelhos sobre os dedos dos pés.';
  if (primary.includes('hamstring')) return 'Leve o quadril para trás e deixe os isquiotibiais controlar a carga.';
  if (primary.includes('glute')) return 'Empurre o quadril sem compensar com a lombar.';
  if (primary.includes('lat') || primary === 'back') return 'Puxe os cotovelos em direção ao quadril em vez de puxar com as mãos.';
  if (primary.includes('delt')) return 'Lidere com o cotovelo e afaste a carga do tronco.';
  if (primary.includes('chest')) return 'Pressione ou varra na linha das fibras do peito com o ombro empacotado.';
  return 'Mova pelo músculo-alvo, não pelo impulso.';
}

function catchFallback(exercise: CatalogExercise, dayFocus: string): string {
  if (dayFocus === 'stretch_mediated' || exercise.stretch_mediated_hypertrophy) {
    return 'Domine a posição alongada na pausa prescrita antes de reverter a rep.';
  }
  if (dayFocus === 'pure_mechanical_tension') {
    return 'Controle a posição de baixo sob carga e saia sem perder a postura.';
  }
  return 'Mantenha tensão no excêntrico até o músculo-alvo atingir a amplitude estável.';
}

function antiPatternFallback(exercise: CatalogExercise, dayFocus: string): string {
  if (exercise.movement_pattern === 'squat' && dayFocus === 'pure_mechanical_tension') {
    return 'Encerre a série se aparecer butt wink ou a lombar perder o neutro sob carga.';
  }
  if (exercise.movement_pattern === 'push') {
    return 'Não perca a retração escapular nem abra os cotovelos além do caminho estável de pressão.';
  }
  if (exercise.movement_pattern === 'pull') {
    return 'Não transforme a rep em encolhimento de trapézio ou puxada dominada pelo bíceps.';
  }
  if (exercise.movement_pattern === 'hinge') {
    return 'Não force amplitude arredondando a lombar ou relaxando o brace.';
  }
  if (exercise.movement_pattern === 'lunge') {
    return 'Não deixe a pelve torcer nem o joelho frontal colapsar para dentro.';
  }
  return 'Pare quando o impulso substituir a contração do músculo-alvo.';
}

export function mapToExerciseCueCard(exercise: CatalogExercise, dayFocus: string): ExerciseCueCard {
  return {
    setup: instructionValue(exercise, ['setup'], setupFallback(exercise)),
    vector: instructionValue(
      exercise,
      ['vector', 'concentric'],
      vectorFallback(exercise),
    ),
    catch: instructionValue(
      exercise,
      ['catch', 'eccentric'],
      catchFallback(exercise, dayFocus),
    ),
    anti_pattern: instructionValue(
      exercise,
      ['anti_pattern', 'safety', 'regression'],
      antiPatternFallback(exercise, dayFocus),
    ),
    failure_type: resolveFailureType(exercise),
  };
}
