import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { validateSlotTemplates } from '../src/templates/validate.js';
import { projectPaths } from '../src/paths.js';
import { ConfigValidationError } from '../src/errors.js';
import type { Config } from '../src/config/schema.js';

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    locales: ['en-US'],
    defaultLocale: 'en-US',
    formFactors: ['phone'],
    paths: { inputs: './inputs', outputs: './outputs', templates: './templates', assets: './assets' },
    theme: {
      fontFamily: 'system-ui',
      palette: { fg: '#000', accent: '#111', muted: '#222' },
      background: { type: 'solid', color: '#fff' },
    },
    slots: [
      {
        id: '01',
        template: 'bold-headline',
        screenshot: 'a.png',
        frame: { id: 'pixel-9' },
        layout: { tilt: { x: 0, y: 0, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 },
        copy: { headline: { 'en-US': 'Hi' } },
      },
    ],
    ...overrides,
  } as Config;
}

describe('validateSlotTemplates', () => {
  it('passes when all required copy fields are present', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-val-'));
    await expect(validateSlotTemplates(baseConfig(), projectPaths(root))).resolves.toBeUndefined();
  });

  it('throws ConfigValidationError when a required copy field is missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-val2-'));
    const config = baseConfig();
    config.slots[0].copy = {}; // no headline
    await expect(validateSlotTemplates(config, projectPaths(root))).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(validateSlotTemplates(config, projectPaths(root))).rejects.toThrow(/headline/);
  });

  it('throws ConfigValidationError on an unknown template id', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-val3-'));
    const config = baseConfig();
    config.slots[0].template = 'ghost';
    await expect(validateSlotTemplates(config, projectPaths(root))).rejects.toBeInstanceOf(ConfigValidationError);
  });
});
