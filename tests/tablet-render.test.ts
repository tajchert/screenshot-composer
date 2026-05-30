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
  formFactors: ['tablet7', 'tablet10'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },
  slots: [
    {
      id: '01-tablet',
      template: 'bold-headline',
      screenshot: 'tablet.png',
      frame: { id: 'pixel-tablet' },
      copy: { headline: { 'en-US': 'Now on tablets' } },
    },
    {
      id: '02-tablet-portrait',
      template: 'bold-headline',
      screenshot: 'tablet.png',
      frame: { id: 'pixel-tablet' },
      orientation: { tablet7: 'portrait' },
      copy: { headline: { 'en-US': 'Portrait override' } },
    },
  ],
});
`;

beforeAll(async () => {
  await ensureChromium();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-tablet-'));
  const p = projectPaths(root);
  // Landscape screenshots matching the landscape pixel-tablet screen aspect.
  for (const fmt of ['tablet7', 'tablet10']) {
    await fs.mkdir(path.join(p.inputs, 'en-US', fmt), { recursive: true });
    await sharp({ create: { width: 2560, height: 1600, channels: 3, background: '#3344ff' } })
      .png().toFile(path.join(p.inputs, 'en-US', fmt, 'tablet.png'));
  }
  await fs.writeFile(p.config, CONFIG, 'utf8');
  const config = await loadConfig(p.config);
  server = await startRenderServer({ config, paths: p });
}, 180_000);

afterAll(async () => { await server?.close(); await closeBrowser(); });

describe('tablet rendering', () => {
  it('renders pixel-tablet to tablet10 landscape at 3840x2160, <= 8 MB', async () => {
    const buf = await renderSlot(server, '01-tablet', 'en-US', 'tablet10');
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(3840);
    expect(meta.height).toBe(2160);
    expect(meta.format).toBe('png');
    expect(buf.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
  }, 180_000);

  it('renders tablet10 default orientation as landscape (wider than tall)', async () => {
    const buf = await renderSlot(server, '01-tablet', 'en-US', 'tablet10');
    const meta = await sharp(buf).metadata();
    expect((meta.width ?? 0) > (meta.height ?? 0)).toBe(true);
  }, 180_000);

  it('honors a per-form-factor portrait override for tablet7 (1200x1920)', async () => {
    const buf = await renderSlot(server, '02-tablet-portrait', 'en-US', 'tablet7');
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1920);
    expect(meta.format).toBe('png');
    expect(buf.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
  }, 180_000);
});
