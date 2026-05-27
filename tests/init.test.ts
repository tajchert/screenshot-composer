import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { runInit } from '../src/commands/init.js';
import { loadConfig } from '../src/config/load.js';
import { projectPaths } from '../src/paths.js';

describe('runInit', () => {
  it('scaffolds a working workspace whose config validates', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-init-'));
    await runInit(root);
    const p = projectPaths(root);

    // config + gitignore + sample screenshot exist
    await fs.access(p.config);
    const gi = await fs.readFile(p.gitignore, 'utf8');
    expect(gi).toContain('outputs/');
    expect(gi).toContain('.cache/');

    const sample = path.join(p.inputs, 'en-US', 'phone', 'onboarding.png');
    const meta = await sharp(sample).metadata();
    expect(meta.format).toBe('png');

    // the scaffolded config loads and validates
    const cfg = await loadConfig(p.config);
    expect(cfg.slots[0].template).toBe('bold-headline');
    expect(cfg.slots[0].frame.id).toBe('pixel-9');
  });

  it('refuses to overwrite an existing config', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-init2-'));
    await runInit(root);
    await expect(runInit(root)).rejects.toThrow(/already exists/i);
  });
});
