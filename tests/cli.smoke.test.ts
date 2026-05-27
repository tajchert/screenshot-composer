import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = (args: string[], cwd: string) =>
  execa('npx', ['tsx', path.join(repoRoot, 'src/cli.ts'), ...args], { cwd, reject: false });

describe('CLI smoke', () => {
  it('prints a version', async () => {
    const res = await cli(['--version'], repoRoot);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('init then generate produces an output PNG', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-cli-'));
    const init = await cli(['init'], root);
    expect(init.exitCode).toBe(0);
    const gen = await cli(['generate'], root);
    expect(gen.exitCode).toBe(0);
    const out = path.join(root, 'play-screenshots', 'outputs', 'en-US', 'phone', '01-onboarding.png');
    await fs.access(out);
  });

  it('exits 1 when config is missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-cli-missing-'));
    const gen = await cli(['generate'], root);
    expect(gen.exitCode).toBe(1);
  });
});
