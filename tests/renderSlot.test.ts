import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { startRenderServer, type RenderServer } from '../src/render/server.js';
import { renderSlot } from '../src/render/renderSlot.js';
import { ensureChromium } from '../src/render/chromium.js';
import { closeBrowser } from '../src/render/browser.js';
import { loadConfig } from '../src/config/load.js';
import { projectPaths } from '../src/paths.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let server: RenderServer;

beforeAll(async () => {
  await ensureChromium();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-render-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await sharp({ create: { width: 1080, height: 2280, channels: 3, background: '#3344ff' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'));
  await fs.copyFile(path.join(here, 'fixtures/valid.config.ts'), p.config);
  const config = await loadConfig(p.config);
  server = await startRenderServer({ config, paths: p });
});

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
});
