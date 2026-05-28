import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { buildPhoneSvg, buildTabletSvg } from './svg.js';
import type { FrameManifest } from '../schema.js';

const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface PhoneColorway {
  body: { top: string; bottom: string };
  bezelInner: string;
  button: string;
  camera: string;
}

interface TabletColorway {
  body: { top: string; bottom: string };
  bezelInner: string;
  camera: string;
}

interface PhoneSpec {
  form: 'phone';
  id: string;
  displayName: string;
  manufacturer: string;
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  shadow?: FrameManifest['shadow'];
  colorways: Record<string, PhoneColorway>;
}

interface TabletSpec {
  form: 'tablet';
  id: string;
  displayName: string;
  manufacturer: string;
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  shadow?: FrameManifest['shadow'];
  colorways: Record<string, TabletColorway>;
}

type FrameSpec = PhoneSpec | TabletSpec;

const SHADOW: FrameManifest['shadow'] = { x: 0, y: 24, blur: 64, color: 'rgba(0,0,0,0.18)' };

const OBSIDIAN: PhoneColorway = {
  body: { top: '#2b2b2f', bottom: '#0e0e10' },
  bezelInner: '#000000',
  button: '#1a1a1c',
  camera: '#070708',
};

const PORCELAIN: PhoneColorway = {
  body: { top: '#f5f1ea', bottom: '#e2dccf' },
  bezelInner: '#1f1d1a',
  button: '#c8c0b1',
  camera: '#1a1916',
};

const HAZEL: PhoneColorway = {
  body: { top: '#6d6a55', bottom: '#43412f' },
  bezelInner: '#0c0c0a',
  button: '#34322a',
  camera: '#0a0a08',
};

const IRIS: PhoneColorway = {
  body: { top: '#6a7299', bottom: '#3f476a' },
  bezelInner: '#0d0e16',
  button: '#2e3550',
  camera: '#0a0b14',
};

const GRAPHITE: PhoneColorway = {
  body: { top: '#4b4f55', bottom: '#23262a' },
  bezelInner: '#0c0c0e',
  button: '#1c1e22',
  camera: '#08080a',
};

const TABLET_PORCELAIN: TabletColorway = {
  body: { top: '#f3eee5', bottom: '#dfd8c8' },
  bezelInner: '#1a1815',
  camera: '#1a1916',
};

const TABLET_HAZEL: TabletColorway = {
  body: { top: '#6d6a55', bottom: '#43412f' },
  bezelInner: '#0c0c0a',
  camera: '#0a0a08',
};

const TABLET_GRAPHITE: TabletColorway = {
  body: { top: '#4b4f55', bottom: '#23262a' },
  bezelInner: '#0c0c0e',
  camera: '#08080a',
};

const FRAMES: FrameSpec[] = [
  {
    form: 'phone',
    id: 'pixel-9',
    displayName: 'Pixel 9',
    manufacturer: 'Google',
    intrinsic: { width: 800, height: 1700 },
    screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
    shadow: SHADOW,
    colorways: { obsidian: OBSIDIAN, porcelain: PORCELAIN },
  },
  {
    form: 'phone',
    id: 'pixel-9-pro',
    displayName: 'Pixel 9 Pro',
    manufacturer: 'Google',
    intrinsic: { width: 800, height: 1786 },
    screen: { x: 28, y: 32, width: 744, height: 1722, radius: 44 },
    shadow: SHADOW,
    colorways: { obsidian: OBSIDIAN, hazel: HAZEL },
  },
  {
    form: 'phone',
    id: 'pixel-9-pro-xl',
    displayName: 'Pixel 9 Pro XL',
    manufacturer: 'Google',
    intrinsic: { width: 820, height: 1826 },
    screen: { x: 29, y: 32, width: 762, height: 1762, radius: 45 },
    shadow: SHADOW,
    colorways: { obsidian: OBSIDIAN, porcelain: PORCELAIN },
  },
  {
    form: 'phone',
    id: 'pixel-9a',
    displayName: 'Pixel 9a',
    manufacturer: 'Google',
    intrinsic: { width: 800, height: 1797 },
    screen: { x: 28, y: 32, width: 744, height: 1733, radius: 44 },
    shadow: SHADOW,
    colorways: { obsidian: OBSIDIAN, iris: IRIS },
  },
  {
    form: 'phone',
    id: 'generic-android',
    displayName: 'Generic Android',
    manufacturer: 'Generic',
    intrinsic: { width: 800, height: 1700 },
    screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
    shadow: SHADOW,
    colorways: { graphite: GRAPHITE },
  },
  {
    form: 'tablet',
    id: 'pixel-tablet',
    displayName: 'Pixel Tablet',
    manufacturer: 'Google',
    intrinsic: { width: 1000, height: 1600 },
    screen: { x: 40, y: 64, width: 920, height: 1472, radius: 30 },
    shadow: SHADOW,
    colorways: { porcelain: TABLET_PORCELAIN, hazel: TABLET_HAZEL },
  },
  {
    form: 'tablet',
    id: 'generic-tablet-7',
    displayName: 'Generic 7" Tablet',
    manufacturer: 'Generic',
    intrinsic: { width: 900, height: 1500 },
    screen: { x: 36, y: 60, width: 828, height: 1380, radius: 27 },
    shadow: SHADOW,
    colorways: { graphite: TABLET_GRAPHITE },
  },
  {
    form: 'tablet',
    id: 'generic-tablet-10',
    displayName: 'Generic 10" Tablet',
    manufacturer: 'Generic',
    intrinsic: { width: 1000, height: 1600 },
    screen: { x: 40, y: 64, width: 920, height: 1472, radius: 30 },
    shadow: SHADOW,
    colorways: { graphite: TABLET_GRAPHITE },
  },
];

async function writeFrame(spec: FrameSpec): Promise<void> {
  const dir = path.join(FRAMES_DIR, spec.id);
  await fs.mkdir(dir, { recursive: true });
  const colors = Object.keys(spec.colorways);
  const files: Record<string, string> = {};
  for (const color of colors) {
    files[color] = `${color}.svg`;
  }
  const manifest: FrameManifest = {
    id: spec.id,
    displayName: spec.displayName,
    manufacturer: spec.manufacturer,
    colors,
    intrinsic: spec.intrinsic,
    screen: spec.screen,
    ...(spec.shadow ? { shadow: spec.shadow } : {}),
    files,
  };
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
  for (const color of colors) {
    let svg: string;
    if (spec.form === 'phone') {
      const cw = spec.colorways[color];
      svg = buildPhoneSvg({ intrinsic: spec.intrinsic, screen: spec.screen, ...cw });
    } else {
      const cw = spec.colorways[color];
      svg = buildTabletSvg({ intrinsic: spec.intrinsic, screen: spec.screen, ...cw });
    }
    await fs.writeFile(path.join(dir, `${color}.svg`), svg, 'utf8');
  }
}

async function main(): Promise<void> {
  for (const spec of FRAMES) {
    await writeFrame(spec);
    console.error(`✓ ${spec.id} (${Object.keys(spec.colorways).join(', ')})`);
  }
  console.error(`Generated ${FRAMES.length} frame(s) in ${FRAMES_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
