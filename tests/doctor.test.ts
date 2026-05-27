import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runDoctor } from '../src/commands/doctor.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('runDoctor', () => {
  it('passes the Node check and includes a Chromium check', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-doctor-'));
    const { checks } = await runDoctor(root);
    const node = checks.find((c) => c.name.startsWith('Node'));
    expect(node?.ok).toBe(true);
    expect(checks.some((c) => c.name.toLowerCase().includes('chromium'))).toBe(true);
  });

  it('does not fail when there is no config (informational)', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-doctor-noconfig-'));
    const { checks } = await runDoctor(root);
    const cfg = checks.find((c) => c.name.toLowerCase().includes('config'));
    expect(cfg?.ok).toBe(true);
    expect(cfg?.detail).toMatch(/no config|init/i);
  });

  it('reports an invalid config and is not ok overall', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-doctor-badcfg-'));
    const base = path.join(root, 'play-screenshots');
    await fs.mkdir(base, { recursive: true });
    await fs.copyFile(
      path.join(here, 'fixtures/invalid.config.ts'),
      path.join(base, 'screenshot-composer.config.ts'),
    );
    const { checks, ok } = await runDoctor(root);
    const cfg = checks.find((c) => c.name.toLowerCase().includes('config'));
    expect(cfg?.ok).toBe(false);
    expect(ok).toBe(false);
  });
});
