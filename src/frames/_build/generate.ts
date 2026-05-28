import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { buildPhoneSvg, buildTabletSvg } from './svg.js';
import type { FrameManifest } from '../schema.js';

const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface PhoneColorway {
  metal: { top: string; bottom: string };
  rim: string;
  bezel: string;
  button: string;
  camera: string;
}

interface TabletColorway {
  metal: { top: string; bottom: string };
  rim: string;
  bezel: string;
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
  license: string;
  source?: string;
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
  license: string;
  source?: string;
  colorways: Record<string, TabletColorway>;
}

type FrameSpec = PhoneSpec | TabletSpec;

const SHADOW: FrameManifest['shadow'] = { x: 0, y: 24, blur: 64, color: 'rgba(0,0,0,0.18)' };

const OBSIDIAN: PhoneColorway = {
  metal: { top: '#3a3a3f', bottom: '#0e0e10' }, rim: '#6b6b72', bezel: '#050506', button: '#1a1a1c', camera: '#070708',
};
const PORCELAIN: PhoneColorway = {
  metal: { top: '#fbf8f2', bottom: '#d8d2c6' }, rim: '#ffffff', bezel: '#0b0a09', button: '#c8c0b1', camera: '#1a1916',
};
const HAZEL: PhoneColorway = {
  metal: { top: '#8b8770', bottom: '#43412f' }, rim: '#a7a288', bezel: '#0a0a08', button: '#34322a', camera: '#0a0a08',
};
const IRIS: PhoneColorway = {
  metal: { top: '#878fb6', bottom: '#3f476a' }, rim: '#a6adcb', bezel: '#0a0b12', button: '#2e3550', camera: '#0a0b14',
};
const GRAPHITE: PhoneColorway = {
  metal: { top: '#646a72', bottom: '#23262a' }, rim: '#878d95', bezel: '#08080a', button: '#1c1e22', camera: '#08080a',
};
const SNOW: PhoneColorway = {
  metal: { top: '#fdfdfd', bottom: '#d6d8db' }, rim: '#ffffff', bezel: '#0b0b0c', button: '#c4c6ca', camera: '#101012',
};
const BAY: PhoneColorway = {
  metal: { top: '#6f93c7', bottom: '#2f4d77' }, rim: '#9db8e0', bezel: '#0a0d12', button: '#284066', camera: '#0a0d14',
};
const CORAL: PhoneColorway = {
  metal: { top: '#f3a38c', bottom: '#c4624a' }, rim: '#ffc4b2', bezel: '#120a08', button: '#a14e38', camera: '#140a08',
};

const TABLET_PORCELAIN: TabletColorway = {
  metal: { top: '#f7f3ec', bottom: '#dfd8c8' }, rim: '#ffffff', bezel: '#0b0a09', camera: '#1a1916',
};
const TABLET_HAZEL: TabletColorway = {
  metal: { top: '#8b8770', bottom: '#43412f' }, rim: '#a7a288', bezel: '#0a0a08', camera: '#0a0a08',
};
const TABLET_GRAPHITE: TabletColorway = {
  metal: { top: '#646a72', bottom: '#23262a' }, rim: '#878d95', bezel: '#08080a', camera: '#08080a',
};

// BAY is defined but not yet used in the FRAMES list; kept for future colorways.
void BAY;

const FRAMES: FrameSpec[] = [
  {
    form: 'phone', id: 'pixel-9', displayName: 'Pixel 9', manufacturer: 'Google',
    intrinsic: { width: 1198, height: 2531 }, screen: { x: 55, y: 58, width: 1080, height: 2424, radius: 87 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_9',
    colorways: { obsidian: OBSIDIAN, porcelain: PORCELAIN },
  },
  {
    form: 'phone', id: 'pixel-9-pro', displayName: 'Pixel 9 Pro', manufacturer: 'Google',
    intrinsic: { width: 1408, height: 2974 }, screen: { x: 60, y: 61, width: 1280, height: 2856, radius: 109 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_9_pro',
    colorways: { obsidian: OBSIDIAN, hazel: HAZEL },
  },
  {
    form: 'phone', id: 'pixel-9-pro-xl', displayName: 'Pixel 9 Pro XL', manufacturer: 'Google',
    intrinsic: { width: 1466, height: 3101 }, screen: { x: 57, y: 56, width: 1344, height: 2992, radius: 108 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_9_pro_xl',
    colorways: { obsidian: OBSIDIAN, porcelain: PORCELAIN },
  },
  {
    form: 'phone', id: 'pixel-9a', displayName: 'Pixel 9a', manufacturer: 'Google',
    intrinsic: { width: 1224, height: 2570 }, screen: { x: 69, y: 73, width: 1080, height: 2424, radius: 87 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_9a',
    colorways: { obsidian: OBSIDIAN, iris: IRIS },
  },
  {
    form: 'phone', id: 'pixel-8', displayName: 'Pixel 8', manufacturer: 'Google',
    intrinsic: { width: 1187, height: 2513 }, screen: { x: 49, y: 55, width: 1080, height: 2400, radius: 86 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_8',
    colorways: { obsidian: OBSIDIAN, hazel: HAZEL },
  },
  {
    form: 'phone', id: 'pixel-8-pro', displayName: 'Pixel 8 Pro', manufacturer: 'Google',
    intrinsic: { width: 1469, height: 3104 }, screen: { x: 58, y: 58, width: 1344, height: 2992, radius: 108 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_8_pro',
    colorways: { obsidian: OBSIDIAN, porcelain: PORCELAIN },
  },
  {
    form: 'phone', id: 'pixel-7', displayName: 'Pixel 7', manufacturer: 'Google',
    intrinsic: { width: 1200, height: 2541 }, screen: { x: 59, y: 58, width: 1080, height: 2400, radius: 86 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_7',
    colorways: { obsidian: OBSIDIAN, snow: SNOW },
  },
  {
    form: 'phone', id: 'pixel-7-pro', displayName: 'Pixel 7 Pro', manufacturer: 'Google',
    intrinsic: { width: 1547, height: 3272 }, screen: { x: 48, y: 66, width: 1440, height: 3120, radius: 115 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_7_pro',
    colorways: { obsidian: OBSIDIAN, hazel: HAZEL },
  },
  {
    form: 'phone', id: 'pixel-6', displayName: 'Pixel 6', manufacturer: 'Google',
    intrinsic: { width: 1209, height: 2553 }, screen: { x: 60, y: 69, width: 1080, height: 2400, radius: 86 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_6',
    colorways: { obsidian: OBSIDIAN, coral: CORAL },
  },
  {
    form: 'phone', id: 'pixel-6-pro', displayName: 'Pixel 6 Pro', manufacturer: 'Google',
    intrinsic: { width: 1527, height: 3289 }, screen: { x: 41, y: 72, width: 1440, height: 3120, radius: 115 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_6_pro',
    colorways: { obsidian: OBSIDIAN, snow: SNOW },
  },
  {
    form: 'phone', id: 'generic-android', displayName: 'Generic Android', manufacturer: 'Generic',
    intrinsic: { width: 800, height: 1700 }, screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
    shadow: SHADOW, license: 'MIT',
    colorways: { graphite: GRAPHITE },
  },
  {
    form: 'tablet', id: 'pixel-tablet', displayName: 'Pixel Tablet', manufacturer: 'Google',
    intrinsic: { width: 1837, height: 2798 }, screen: { x: 117, y: 119, width: 1600, height: 2560, radius: 48 },
    shadow: SHADOW, license: 'Apache-2.0', source: 'AOSP emulator skin pixel_tablet (portrait transpose)',
    colorways: { porcelain: TABLET_PORCELAIN, hazel: TABLET_HAZEL },
  },
  {
    form: 'tablet', id: 'generic-tablet-7', displayName: 'Generic 7" Tablet', manufacturer: 'Generic',
    intrinsic: { width: 900, height: 1500 }, screen: { x: 36, y: 60, width: 828, height: 1380, radius: 27 },
    shadow: SHADOW, license: 'MIT',
    colorways: { graphite: TABLET_GRAPHITE },
  },
  {
    form: 'tablet', id: 'generic-tablet-10', displayName: 'Generic 10" Tablet', manufacturer: 'Generic',
    intrinsic: { width: 1000, height: 1600 }, screen: { x: 40, y: 64, width: 920, height: 1472, radius: 30 },
    shadow: SHADOW, license: 'MIT',
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
    ...(spec.source ? { source: spec.source } : {}),
    license: spec.license,
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
