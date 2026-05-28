import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { startRenderServer, type RenderServer } from '../src/render/server.js';
import { renderSlot } from '../src/render/renderSlot.js';
import { ensureChromium } from '../src/render/chromium.js';
import { closeBrowser } from '../src/render/browser.js';
import { loadConfig } from '../src/config/load.js';
import { projectPaths } from '../src/paths.js';

let server: RenderServer;

const CONFIG = `import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },
  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9', color: 'obsidian' },
      copy: { headline: { 'en-US': 'Order in seconds' } },
    },
    {
      id: '02-showcase',
      template: 'showcase',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9', color: 'obsidian' },
      copy: {
        eyebrow: { 'en-US': 'Fast & simple' },
        headline: { 'en-US': 'Everything in one tap' },
        subhead: { 'en-US': 'Reorder favourites instantly.' },
      },
    },
    {
      id: '03-overlap',
      template: 'overlap',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9', color: 'obsidian' },
      copy: {
        headline: { 'en-US': 'SHOP' },
        subhead: { 'en-US': 'Now in your pocket' },
      },
    },
  ],
});
`;

beforeAll(async () => {
  await ensureChromium();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-render-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await sharp({ create: { width: 1080, height: 2280, channels: 3, background: '#3344ff' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'));
  await fs.writeFile(p.config, CONFIG, 'utf8');
  const config = await loadConfig(p.config);
  server = await startRenderServer({ config, paths: p });
}, 180_000);

afterAll(async () => { await server?.close(); await closeBrowser(); });

describe('renderSlot', () => {
  it('renders a phone slot to a 1080x1920 PNG under 8 MB', async () => {
    const buf = await renderSlot(server, '01-onboarding', 'en-US', 'phone');
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
    expect(meta.format).toBe('png');
    expect(buf.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  for (const [slotId, template] of [
    ['02-showcase', 'showcase'],
    ['03-overlap', 'overlap'],
  ] as const) {
    it(`renders a valid in-constraint PNG with '${template}' (slot ${slotId})`, async () => {
      const buf = await renderSlot(server, slotId, 'en-US', 'phone');
      const meta = await sharp(buf).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1920);
      expect(buf.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
    }, 180_000);
  }
});
