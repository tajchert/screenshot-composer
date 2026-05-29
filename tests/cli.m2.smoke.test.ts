import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = (args: string[], cwd: string) =>
  execa('npx', ['tsx', path.join(repoRoot, 'src/cli.ts'), ...args], { cwd, reject: false });

describe('CLI M2 smoke', () => {
  it('--version prints the enriched multi-line info', async () => {
    const res = await cli(['--version'], repoRoot);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/screenshot-composer \d+\.\d+\.\d+/);
    expect(res.stdout).toContain('playwright');
  });

  it('frames list prints every built-in frame', async () => {
    const res = await cli(['frames', 'list'], repoRoot);
    expect(res.exitCode).toBe(0);
    for (const id of ['pixel-9', 'pixel-9-pro', 'pixel-9-pro-xl', 'pixel-8', 'pixel-7', 'pixel-6', 'pixel-4', 'pixel-10', 'pixel-tablet']) {
      expect(res.stdout).toContain(id);
    }
  });

  it('templates list prints all built-in templates', async () => {
    const res = await cli(['templates', 'list'], repoRoot);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('bold-headline');
    expect(res.stdout).toContain('showcase');
    expect(res.stdout).toContain('overlap');
  });

  it('doctor runs and prints the Node check', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-m2-doctor-'));
    const res = await cli(['doctor'], root);
    // exit 0 (all ok) or 1 (e.g. chromium not yet downloaded) — must not crash
    expect([0, 1]).toContain(res.exitCode);
    expect(res.stdout).toContain('Node.js');
  });

  it('clean --cache exits 0 in a fresh project', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-m2-clean-'));
    const res = await cli(['clean', '--cache'], root);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Nothing to clean.');
  });

  it('generate with no config exits 1 with a friendly message', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-m2-nocfg-'));
    const res = await cli(['generate'], root);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toMatch(/No config found/);
  });
});
