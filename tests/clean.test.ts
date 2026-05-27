import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs, existsSync } from 'node:fs';
import { runClean } from '../src/commands/clean.js';
import { projectPaths } from '../src/paths.js';

async function makeFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-clean-'));
  const p = projectPaths(root);
  await fs.mkdir(p.cache, { recursive: true });
  await fs.writeFile(path.join(p.cache, 'x.png'), '12345');
  const chromiumDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-chromium-'));
  await fs.mkdir(path.join(chromiumDir, 'chromium-123'), { recursive: true });
  await fs.writeFile(path.join(chromiumDir, 'chromium-123', 'bin'), '1234567890');
  return { root, p, chromiumDir };
}

describe('runClean', () => {
  it('removes both Chromium and the project cache by default', async () => {
    const { root, p, chromiumDir } = await makeFixture();
    const { removed } = await runClean(root, {}, chromiumDir);
    expect(existsSync(chromiumDir)).toBe(false);
    expect(existsSync(p.cache)).toBe(false);
    expect(removed.map((r) => r.path).sort()).toEqual([chromiumDir, p.cache].sort());
    expect(removed.find((r) => r.path === chromiumDir)!.bytes).toBe(10);
  });

  it('with --cache removes only the project cache, leaving Chromium', async () => {
    const { root, p, chromiumDir } = await makeFixture();
    const { removed } = await runClean(root, { cache: true }, chromiumDir);
    expect(existsSync(p.cache)).toBe(false);
    expect(existsSync(chromiumDir)).toBe(true);
    expect(removed.map((r) => r.path)).toEqual([p.cache]);
  });
});
