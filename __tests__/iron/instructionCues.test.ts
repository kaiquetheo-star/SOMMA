import { describe, it, expect } from 'vitest';
import {
  resolvePrimaryInstruction,
  resolvePhaseInstruction,
  instructionKeysForDeepDive,
} from '@/lib/iron/instructionCues';

describe('resolvePrimaryInstruction', () => {
  it('returns null for null/undefined input', () => {
    expect(resolvePrimaryInstruction(null)).toBeNull();
    expect(resolvePrimaryInstruction(undefined)).toBeNull();
  });

  it('prefers setup as the primary instruction', () => {
    const instructions = {
      setup: 'Grip the bar at shoulder width',
      eccentric: 'Lower slowly',
      concentric: 'Explode up',
    };
    const result = resolvePrimaryInstruction(instructions);
    expect(result).toEqual({
      key: 'setup',
      label: 'Setup',
      text: 'Grip the bar at shoulder width',
    });
  });

  it('falls back to summary when setup is empty', () => {
    const instructions = {
      setup: '',
      summary: 'Focus on control throughout',
    };
    const result = resolvePrimaryInstruction(instructions);
    expect(result!.key).toBe('summary');
    expect(result!.label).toBe('Coach cue');
    expect(result!.text).toBe('Focus on control throughout');
  });

  it('falls back to cues when setup and summary are absent', () => {
    const result = resolvePrimaryInstruction({ cues: 'Squeeze at the top' });
    expect(result!.key).toBe('cues');
    expect(result!.label).toBe('Cues');
  });

  it('falls back to merged_steps first element', () => {
    const result = resolvePrimaryInstruction({
      merged_steps: ['First merged step', 'Second'],
    });
    expect(result!.key).toBe('merged_steps');
    expect(result!.text).toBe('First merged step');
  });

  it('skips empty strings in merged_steps', () => {
    const result = resolvePrimaryInstruction({
      merged_steps: ['', '  ', 'Valid step'],
    });
    expect(result!.text).toBe('Valid step');
  });

  it('falls back to other phase keys (eccentric, concentric, safety, regression)', () => {
    const result = resolvePrimaryInstruction({ eccentric: 'Lower for 3 seconds' });
    expect(result!.key).toBe('eccentric');
    expect(result!.label).toBe('Eccentric');
  });

  it('falls back to arbitrary keys as last resort', () => {
    const result = resolvePrimaryInstruction({ custom_field: 'Some custom cue' });
    expect(result!.key).toBe('custom_field');
    expect(result!.label).toBe('custom field');
    expect(result!.text).toBe('Some custom cue');
  });

  it('skips sources and merged_steps in fallback scan', () => {
    const result = resolvePrimaryInstruction({
      sources: 'should be skipped',
      merged_steps: [],
      real_field: 'actual value',
    });
    expect(result!.key).toBe('real_field');
  });

  it('returns null when all values are empty or non-string', () => {
    const result = resolvePrimaryInstruction({ setup: '', eccentric: 123 as unknown as string });
    expect(result).toBeNull();
  });
});

describe('resolvePhaseInstruction', () => {
  it('returns null for null instructions', () => {
    expect(resolvePhaseInstruction(null, 'setup')).toBeNull();
  });

  it('returns the phase text when present', () => {
    const instructions = { eccentric: '3-second negative', concentric: 'Explode' };
    expect(resolvePhaseInstruction(instructions, 'eccentric')).toBe('3-second negative');
  });

  it('returns null when phase key is missing or empty', () => {
    expect(resolvePhaseInstruction({ setup: '' }, 'setup')).toBeNull();
    expect(resolvePhaseInstruction({ eccentric: 'value' }, 'setup')).toBeNull();
  });
});

describe('instructionKeysForDeepDive', () => {
  it('returns phase keys with non-empty values first, then custom keys', () => {
    const instructions = {
      setup: 'Grip',
      eccentric: 'Lower slowly',
      custom_cue: 'Extra tip',
      sources: 'source list',
      merged_steps: ['step'],
    };
    const keys = instructionKeysForDeepDive(instructions);
    expect(keys).toContain('setup');
    expect(keys).toContain('eccentric');
    expect(keys).toContain('custom_cue');
    expect(keys).not.toContain('sources');
    expect(keys).not.toContain('merged_steps');
  });

  it('respects excludeKeys parameter', () => {
    const instructions = { setup: 'Grip', eccentric: 'Lower', concentric: 'Up' };
    const keys = instructionKeysForDeepDive(instructions, ['setup']);
    expect(keys).not.toContain('setup');
    expect(keys).toContain('eccentric');
  });

  it('returns empty array when no valid keys exist', () => {
    const keys = instructionKeysForDeepDive({ sources: 'x', merged_steps: ['y'] });
    expect(keys).toEqual([]);
  });
});
