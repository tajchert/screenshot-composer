import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config/load.js';
import { ConfigValidationError } from '../src/errors.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('loadConfig', () => {
  it('loads and validates a TS config that imports defineConfig', async () => {
    const cfg = await loadConfig(path.join(here, 'fixtures/valid.config.ts'));
    expect(cfg.locales).toEqual(['en-US']);
    expect(cfg.slots[0].id).toBe('01-onboarding');
    expect(cfg.slots[0].layout.perspective).toBe(2000);
  });

  it('throws ConfigValidationError on invalid config', async () => {
    await expect(loadConfig(path.join(here, 'fixtures/invalid.config.ts')))
      .rejects.toBeInstanceOf(ConfigValidationError);
    await expect(loadConfig(path.join(here, 'fixtures/invalid.config.ts')))
      .rejects.toThrow(/tilt\.y/);
  });

  it('throws a friendly error when no config file exists', async () => {
    await expect(loadConfig(path.join(here, 'fixtures/does-not-exist.config.ts')))
      .rejects.toThrow(/No config found/);
  });
});
