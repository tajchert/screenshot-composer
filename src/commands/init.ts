import path from 'node:path';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { projectPaths } from '../paths.js';

const SAMPLE_CONFIG = `import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],

  theme: {
    fontFamily: 'system-ui',
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },

  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9', color: 'obsidian' },
      layout: { tilt: { x: 4, y: -18, z: 0 }, translate: { x: 0, y: 40 }, perspective: 2000 },
      copy: {
        headline: { 'en-US': 'Order in seconds' },
      },
    },
  ],
});
`;

const GITIGNORE = `outputs/
.cache/
`;

async function sampleScreenshot(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="2280">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#334155"/>
    </linearGradient></defs>
    <rect width="1080" height="2280" fill="url(#g)"/>
    <rect x="80" y="160" width="920" height="120" rx="24" fill="#475569"/>
    <rect x="80" y="360" width="920" height="640" rx="32" fill="#64748b"/>
    <text x="540" y="1300" fill="#e2e8f0" font-size="64" font-family="sans-serif"
      text-anchor="middle">Sample screenshot</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function runInit(root: string): Promise<void> {
  const p = projectPaths(root);
  if (existsSync(p.config)) {
    throw new Error(`A screenshot-composer config already exists at ${p.config}`);
  }

  await fs.mkdir(p.base, { recursive: true });
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await fs.mkdir(p.outputs, { recursive: true });
  await fs.mkdir(p.templates, { recursive: true });
  await fs.mkdir(p.assets, { recursive: true });

  await fs.writeFile(p.config, SAMPLE_CONFIG, 'utf8');
  await fs.writeFile(p.gitignore, GITIGNORE, 'utf8');
  await fs.writeFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'), await sampleScreenshot());

  console.error(`Initialized screenshot-composer workspace at ${p.base}`);
  console.error(`Next: screenshot-composer generate`);
}
