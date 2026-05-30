import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs, existsSync } from 'node:fs';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { runGenerate } from '../src/commands/generate.js';
import { loadCacheIndex, identityKey } from '../src/render/cache.js';
import { closeBrowser } from '../src/render/browser.js';
import { projectPaths } from '../src/paths.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let root: string;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-generate-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await sharp({ create: { width: 1080, height: 2280, channels: 3, background: '#22aa55' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'));
  await fs.copyFile(path.join(here, 'fixtures/valid.config.ts'), p.config);
});

afterAll(async () => { await closeBrowser(); });


describe('runGenerate', () => {
  it('writes a valid phone PNG to outputs/', async () => {
    await runGenerate(root, {});
    const p = projectPaths(root);
    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
    const stat = await fs.stat(out);
    expect(stat.size).toBeLessThanOrEqual(8 * 1024 * 1024);
  });
});

describe('runGenerate caching', () => {
  it('populates the cache on first run and skips on the second', async () => {
    const p = projectPaths(root);
    await runGenerate(root, {});
    const index = await loadCacheIndex(p.cache);
    const id = identityKey('en-US', 'phone', '01-onboarding');
    expect(index.entries[id]).toBeDefined();

    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const before = (await fs.stat(out)).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    await runGenerate(root, {}); // cached: must not rewrite the file
    expect((await fs.stat(out)).mtimeMs).toBe(before);
  });

  it('re-renders when the screenshot changes', async () => {
    const p = projectPaths(root);
    await runGenerate(root, {});
    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const before = (await fs.stat(out)).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    await sharp({ create: { width: 1080, height: 2280, channels: 3, background: '#aa2255' } })
      .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'));
    await runGenerate(root, {});
    expect((await fs.stat(out)).mtimeMs).toBeGreaterThan(before);
  });

  it('re-renders when the output file was deleted even if the index is valid', async () => {
    const p = projectPaths(root);
    await runGenerate(root, {});
    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    await fs.rm(out);
    await runGenerate(root, {});
    expect(existsSync(out)).toBe(true);
  });

  it('--force re-renders even when cached', async () => {
    const p = projectPaths(root);
    await runGenerate(root, {});
    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const before = (await fs.stat(out)).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    await runGenerate(root, { force: true });
    expect((await fs.stat(out)).mtimeMs).toBeGreaterThan(before);
  });
});
