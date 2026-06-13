#!/usr/bin/env tsx
/**
 * SOMMA Motor Test Script
 * Testa o motor de geração de microciclo SEM depender do React Native/Expo
 */

import fs from 'fs';
import path from 'path';
import { getBundledExercises } from '../lib/catalog/bundledCatalog';
import { generateDeterministicGameplan } from '../lib/gameplan/engine/generateDeterministicGameplan';
import type { UserBiological } from '../types/biological';

// Perfil real do usuário (do backup JSON)
const userBiological: UserBiological = {
  date_of_birth: '1994-05-14',
  weight_kg: 57,
  height_cm: 158,
  body_fat_percentage: 18,
  current_injuries: null,
  baseline_stress_level: 3,
  goal_iron: 'Hypertrophy',
  nutrition_goal: null,
  training_days_per_week: 6,
  experience_level: null,
  available_time_iron: 90,
  iron_mastery: null,
  frequency_iron: 6,
  cns_fatigue_score: 0,
  mesocycle_phase: 'bulking',
  mesocycle_week: 1,
  mesocycle_goal: 'hypertrophy',
  preferred_split: 'abcdef',
  clinical_exit_interview: null,
  current_body_fat_estimate: 18,
  hormonal_transition: false,
  hormonal_protocol: {
    type: 'trt',
    weekly_dose_mg: 300,
    recovery_multiplier: 1.5,
  },
};

const userEnvironment = {
  available_equipment: ['full_gym'],
  updated_at: '2026-05-25T13:20:40.526Z',
};

async function testMotor() {
  console.log('🧠 Iniciando teste do motor SOMMA...\n');
  
  try {
    // 1. Carregar catálogo
    console.log('📚 Carregando catálogo de exercícios...');
    const catalog = getBundledExercises();
    console.log(`✅ Catálogo carregado: ${catalog.length} exercícios\n`);
    
    // 2. Gerar microciclo
    console.log('⚙️  Gerando microciclo determinístico...');
    const gameplan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: userEnvironment.available_equipment as ['full_gym'],
      biological: userBiological,
      userStats: {
        iron_sessions_completed: 0,
        nutrition_checkins_completed: 0,
      },
      performanceLogs: [],
      protocolDate: '2026-06-09',
    });
    
    console.log('✅ Microciclo gerado com sucesso!\n');
    
    // 3. Validar resultados
    console.log('🔍 Validando resultados...\n');
    
    const issues: string[] = [];
    
    gameplan.microcycle.forEach((day: any) => {
      const dayLabel = `Dia ${day.day_index} (${day.focus_label})`;
      
      if (day.is_rest_day) {
        console.log(`🛌 ${dayLabel}: DESCANSO`);
        return;
      }
      
      const ironBlock = day.blocks.find((b: any) => b.pillar === 'iron');
      if (!ironBlock || !ironBlock.iron) {
        issues.push(`${dayLabel}: Bloco Iron não encontrado`);
        console.log(`❌ ${dayLabel}: Sem bloco Iron`);
        return;
      }
      
      const exercises = ironBlock.iron.exercises;
      console.log(`💪 ${dayLabel}: ${exercises.length} exercícios`);
      
      if (exercises.length === 0) {
        issues.push(`${dayLabel}: Array de exercícios vazio`);
      }
      
      exercises.forEach((ex: any) => {
        const sets = ex.target_sets;
        const isFinisher = ex.execution_technique === 'Myo-Reps' || 
                          (ex.progression_note && ex.progression_note.includes('finisher'));
        
        // Validar hard cap de finishers (máximo 4 séries)
        if (isFinisher && sets > 4) {
          issues.push(`${dayLabel} - ${ex.display_name}: Finisher com ${sets} séries (máximo 4)`);
        }
        
        // Validar mínimo de sets para compostos principais
        const isCompound = ex.target_rep_range && 
                          (ex.target_rep_range.includes('5-8') || ex.target_rep_range.includes('8-12'));
        const isPrimaryCompound = ex.display_name && 
                                  (ex.display_name.includes('Press') || 
                                   ex.display_name.includes('Squat') || 
                                   ex.display_name.includes('Row') ||
                                   ex.display_name.includes('Pulldown'));
        
        if (isCompound && isPrimaryCompound && sets < 3) {
          issues.push(`${dayLabel} - ${ex.display_name}: Composto principal com apenas ${sets} séries (mínimo 3)`);
        }
        
        console.log(`   • ${ex.display_name}: ${sets}x${ex.target_reps} (${ex.target_rep_range})`);
      });
      
      console.log('');
    });
    
    // 4. Relatório final
    console.log('\n' + '='.repeat(60));
    if (issues.length === 0) {
      console.log('✅ TODOS OS TESTES PASSARAM!');
      console.log('O motor está gerando treinos corretos:');
      console.log('   • Sem arrays vazios em dias de treino');
      console.log('   • Finishers respeitam hard cap de 4 séries');
      console.log('   • Compostos principais têm volume adequado (3+ séries)');
    } else {
      console.log(`⚠️  ${issues.length} PROBLEMA(S) ENCONTRADO(S):`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    console.log('='.repeat(60) + '\n');
    
    // 5. Salvar resultado completo
    const outputPath = path.join(process.cwd(), 'test-motor-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(gameplan, null, 2));
    console.log(`💾 Resultado completo salvo em: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Erro ao executar o motor:');
    console.error(error);
    process.exit(1);
  }
}

testMotor();