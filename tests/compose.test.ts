import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { composeSlotHtml, inputUrl, inputFilePath } from '../src/render/compose.js';
import { loadConfig } from '../src/config/load.js';
import { MissingInputError } from '../src/errors.js';
import { projectPaths } from '../src/paths.js';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let root: string;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-compose-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await sharp({ create: { width: 100, height: 200, channels: 3, background: '#abc' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'));
  // copy the valid fixture config into the project
  await fs.copyFile(path.join(here, 'fixtures/valid.config.ts'), p.config);
});

describe('compose', () => {
  it('builds the input url and file path consistently', () => {
    expect(inputUrl('en-US', 'phone', 'onboarding.png')).toBe('/input/en-US/phone/onboarding.png');
    const p = projectPaths('/repo');
    expect(inputFilePath(p, 'en-US', 'phone', 'onboarding.png'))
      .toBe('/repo/play-screenshots/inputs/en-US/phone/onboarding.png');
  });

  it('composes HTML for a slot, embedding the screenshot url and headline', async () => {
    const p = projectPaths(root);
    const config = await loadConfig(p.config);
    const html = await composeSlotHtml(config, p, { slotId: '01-onboarding', locale: 'en-US', format: 'phone' });
    expect(html).toContain('/input/en-US/phone/onboarding.png');
    expect(html).toContain('Order in seconds');
  });

  it('throws MissingInputError when the screenshot is absent', async () => {
    const p = projectPaths(root);
    const config = await loadConfig(p.config);
    await expect(
      composeSlotHtml(config, p, { slotId: '01-onboarding', locale: 'de', format: 'phone' }),
    ).rejects.toBeInstanceOf(MissingInputError);
  });
});
