import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { startRenderServer, type RenderServer } from '../src/render/server.js';
import { loadConfig } from '../src/config/load.js';
import { projectPaths } from '../src/paths.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let server: RenderServer;

beforeAll(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-server-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await sharp({ create: { width: 100, height: 200, channels: 3, background: '#abc' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'));
  await fs.copyFile(path.join(here, 'fixtures/valid.config.ts'), p.config);
  const config = await loadConfig(p.config);
  server = await startRenderServer({ config, paths: p });
});

afterAll(async () => { await server?.close(); });

describe('render server', () => {
  it('serves composition HTML at /render', async () => {
    const res = await fetch(`${server.url}/render?slot=01-onboarding&locale=en-US&format=phone`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('Order in seconds');
  });

  it('serves the raw screenshot at /input', async () => {
    const res = await fetch(`${server.url}/input/en-US/phone/onboarding.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf[0]).toBe(0x89); // PNG magic
  });

  it('returns 404 for unknown input', async () => {
    const res = await fetch(`${server.url}/input/de/phone/missing.png`);
    expect(res.status).toBe(404);
  });
});
