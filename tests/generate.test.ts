import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { runGenerate } from '../src/commands/generate.js';
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
