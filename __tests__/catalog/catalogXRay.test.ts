import { describe, expect, it } from 'vitest';
import { getBundledExercises } from '../../lib/catalog/bundledCatalog';

describe('🚨 Catálogo Runtime X-Ray', () => {
  it('deve gerar um relatório forense do catálogo atual', () => {
    const catalog = getBundledExercises();

    const report = {
      total: catalog.length,
      movement_patterns: {} as Record<string, number>,
      primary_muscles: {} as Record<string, number>,
      joint_stress: {} as Record<string, number>,
      equipment_tags: {} as Record<string, number>,
      stretch_mediated: { true: 0, false: 0 },
      empty_synergists: 0,
    };

    catalog.forEach((ex) => {
      const pattern = ex.movement_pattern || 'NULL/MISSING';
      report.movement_patterns[pattern] = (report.movement_patterns[pattern] || 0) + 1;

      const primary = ex.primary_muscle || 'NULL/MISSING';
      report.primary_muscles[primary] = (report.primary_muscles[primary] || 0) + 1;

      const joint = ex.joint_stress_profile || 'NULL/MISSING';
      report.joint_stress[joint] = (report.joint_stress[joint] || 0) + 1;

      const eq =
        ex.equipment_required && ex.equipment_required.length > 0
          ? ex.equipment_required[0]
          : 'none/empty_array';
      report.equipment_tags[eq!] = (report.equipment_tags[eq!] || 0) + 1;

      if (ex.stretch_mediated_hypertrophy) report.stretch_mediated.true += 1;
      else report.stretch_mediated.false += 1;

      if (!ex.synergist_muscles || ex.synergist_muscles.length === 0) {
        report.empty_synergists += 1;
      }
    });

    console.log('\n=========================================');
    console.log('🚨 SOMMA CATALOG X-RAY REPORT 🚨');
    console.log('=========================================');
    console.log(`Total de Exercícios: ${report.total}`);
    console.log(
      `Sinergistas Vazios: ${report.empty_synergists} (${Math.round((report.empty_synergists / report.total) * 100)}%)`,
    );
    console.log('\n--- Movement Patterns ---');
    console.table(report.movement_patterns);
    console.log('\n--- Joint Stress ---');
    console.table(report.joint_stress);
    console.log('\n--- Stretch Mediated ---');
    console.table(report.stretch_mediated);
    console.log('\n--- Top Primary Muscles ---');
    console.table(Object.entries(report.primary_muscles).sort((a, b) => b[1]! - a[1]!).slice(0, 10));
    console.log('=========================================\n');

    expect(catalog.length).toBe(49);
    expect(report.movement_patterns.hinge ?? 0).toBeGreaterThan(0);
    expect(report.stretch_mediated.true).toBeGreaterThan(0);
    expect(Object.keys(report.joint_stress).length).toBeGreaterThan(1);
    expect(report.joint_stress.low_impact ?? 0).toBeLessThan(catalog.length);
  });
});
