import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { runGenerate } from '../src/commands/generate.js';
import { closeBrowser } from '../src/render/browser.js';
import { projectPaths } from '../src/paths.js';

let root: string;

const CONFIG = `import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone', 'tablet10'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'solid', color: '#101418' },
  },
  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'shot.png',
      frame: { id: 'pixel-9' },
      copy: { headline: { 'en-US': 'Hello' } },
    },
  ],
});
`;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-gen-tablet-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await sharp({ create: { width: 1080, height: 2280, channels: 3, background: '#22aa55' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'shot.png'));
  await fs.mkdir(path.join(p.inputs, 'en-US', 'tablet10'), { recursive: true });
  await sharp({ create: { width: 2560, height: 1600, channels: 3, background: '#22aa55' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'tablet10', 'shot.png'));
  await fs.writeFile(p.config, CONFIG, 'utf8');
}, 180_000);

afterAll(async () => { await closeBrowser(); });

describe('runGenerate (multi form factor)', () => {
  it('writes both a phone and a tablet10 output with correct dimensions', async () => {
    await runGenerate(root, {});
    const p = projectPaths(root);

    const phone = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const pMeta = await sharp(phone).metadata();
    expect(pMeta.width).toBe(1080);
    expect(pMeta.height).toBe(1920);

    const tablet = path.join(p.outputs, 'en-US', 'tablet10', '01-onboarding.png');
    const tMeta = await sharp(tablet).metadata();
    expect(tMeta.width).toBe(3840);
    expect(tMeta.height).toBe(2160);
    const stat = await fs.stat(tablet);
    expect(stat.size).toBeLessThanOrEqual(8 * 1024 * 1024);
  }, 180_000);
});
