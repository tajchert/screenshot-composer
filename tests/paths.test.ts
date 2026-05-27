import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { HOME_DIR, CHROMIUM_DIR, projectPaths, WORKDIR_NAME } from '../src/paths.js';

describe('paths', () => {
  it('resolves the home cache dir under the user home', () => {
    expect(HOME_DIR).toBe(path.join(os.homedir(), '.screenshot-composer'));
    expect(CHROMIUM_DIR).toBe(path.join(HOME_DIR, 'chromium'));
  });

  it('resolves per-project paths under play-screenshots/', () => {
    const p = projectPaths('/repo');
    expect(WORKDIR_NAME).toBe('play-screenshots');
    expect(p.base).toBe('/repo/play-screenshots');
    expect(p.config).toBe('/repo/play-screenshots/screenshot-composer.config.ts');
    expect(p.inputs).toBe('/repo/play-screenshots/inputs');
    expect(p.outputs).toBe('/repo/play-screenshots/outputs');
  });
});
