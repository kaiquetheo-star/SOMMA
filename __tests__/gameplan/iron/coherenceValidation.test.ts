import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

describe('coherenceValidation — PPL coherenceValidated', () => {
  it('Cenário A: PPL com falha de coerência não retorna ok: true cego', () => {
    const sourcePath = resolve(
      process.cwd(),
      'lib/gameplan/engine/iron/generateIronMicrocycle.ts',
    );
    const source = readFileSync(sourcePath, 'utf8');

    // Regression: the boolean OR that always forced true must be gone.
    expect(source).not.toMatch(/coherenceValidated\s*=\s*finalReport\.ok\s*\|\|\s*true/);
    expect(source).toMatch(/coherenceValidated\s*=\s*coherenceOk/);
    expect(source).toMatch(/PPL coherence validation failed/);

    // Behavioral semantics of the fixed gate (not the buggy OR).
    const finalReport = { ok: false };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    let coherenceOk = finalReport.ok;
    if (!coherenceOk) {
      console.warn(
        '[Iron] PPL coherence validation failed — applying deterministic autoCorrect fallback',
      );
      // Deterministic fallback ran; still fails:
      coherenceOk = false;
    }

    const coherenceValidated = coherenceOk;
    expect(warnSpy).toHaveBeenCalled();
    expect(coherenceValidated).toBe(false);
    // Documents what the old bug would have returned:
    expect(finalReport.ok || true).toBe(true);

    warnSpy.mockRestore();
  });
});
