# Milestone 4 — Device Frame Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a curated catalog of eight clean-room SVG device frames (five phones fully renderable, three tablets as validated assets), harden the manifest loader with a Zod schema, and add a shared structural test so every new frame is validated automatically.

**Architecture:** Each frame stays a directory under `src/frames/<id>/` with `manifest.json` + one `<color>.svg` per colorway. A small **generator** (`src/frames/_build/generate.ts`) emits both the manifests and the SVGs from a single data file using two pure builders (`buildPhoneSvg`, `buildTabletSvg`) — that keeps all 11 SVGs visually consistent and trivially extensible. The generator is offline tooling; at render time `src/frames/load.ts` reads the committed files exactly as today. A new `FrameManifestSchema` (Zod) replaces the unchecked `JSON.parse` cast, and a shared structural test iterates every frame on disk and asserts manifest+SVG integrity. Only `resolveDimensions` (phone) is wired today, so the three tablet frames ship as **validated assets**; full tablet rendering is M5.

**Tech Stack:** TypeScript (ESM), Zod for manifest validation, `tsx` to run the offline generator, Vitest, Playwright/Chromium for the render-matrix integration test.

---

## File structure

| Path | Responsibility | Action |
|---|---|---|
| `src/frames/schema.ts` | Zod `FrameManifestSchema` + inferred `FrameManifest` type | Create |
| `src/frames/load.ts` | `listFrames`, `loadManifest` (now schema-validated), `loadFrame`, `listFrameInfos` | Modify |
| `src/frames/_build/svg.ts` | Pure SVG builders: `buildPhoneSvg`, `buildTabletSvg` (offline tooling, not loaded at render time) | Create |
| `src/frames/_build/generate.ts` | One device-spec data table + a `main()` that writes every manifest + SVG | Create |
| `src/frames/<id>/manifest.json` (×8) | Frame metadata — written by the generator | Create/overwrite |
| `src/frames/<id>/<color>.svg` (×11) | Clean-room SVG — written by the generator | Create/overwrite |
| `package.json` | Add `frames:build` script | Modify |
| `tests/frames-schema.test.ts` | Schema accepts a good manifest, rejects malformed ones with field paths | Create |
| `tests/frames-structural.test.ts` | One test that iterates every frame dir and asserts manifest + SVG integrity | Create |
| `tests/frames-list.test.ts` | Extend so all 8 frame ids appear | Modify |
| `tests/cli.m2.smoke.test.ts` | Tighten the `frames list` assertion to cover the new catalog | Modify |
| `tests/renderSlot.test.ts` | Extend so each phone frame renders to a valid PNG via real Chromium | Modify |
| `CLAUDE.md` | Refresh module map, catalog, current state to "Milestones 1–4 complete" | Modify |

**Note on `src/frames/_build/`:** the directory has no `manifest.json`, so `listFrames()`'s existing filter excludes it automatically. The builder/generator are typechecked but never imported by the CLI runtime.

---

### Task 1: Manifest Zod schema + loader hardening

**Files:**
- Create: `src/frames/schema.ts`
- Modify: `src/frames/load.ts`
- Test: `tests/frames-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

`tests/frames-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FrameManifestSchema } from '../src/frames/schema.js';

const valid = {
  id: 'pixel-9',
  displayName: 'Pixel 9',
  manufacturer: 'Google',
  colors: ['obsidian'],
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  shadow: { x: 0, y: 24, blur: 64, color: 'rgba(0,0,0,0.18)' },
  files: { obsidian: 'obsidian.svg' },
};

describe('FrameManifestSchema', () => {
  it('accepts a well-formed manifest', () => {
    const r = FrameManifestSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it('rejects a manifest whose screen rect exceeds intrinsic bounds', () => {
    const bad = { ...valid, screen: { ...valid.screen, x: 100, width: 800 } };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message).join(' | ');
      expect(msgs).toMatch(/screen/);
    }
  });

  it('rejects a manifest whose colors[] has no matching files entry', () => {
    const bad = { ...valid, colors: ['obsidian', 'porcelain'] };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.')).join(' | ');
      expect(paths).toMatch(/files\.porcelain/);
    }
  });

  it('rejects a manifest with non-positive intrinsic dimensions', () => {
    const bad = { ...valid, intrinsic: { width: 0, height: 1700 } };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it('makes shadow optional', () => {
    const { shadow: _shadow, ...noShadow } = valid;
    const r = FrameManifestSchema.safeParse(noShadow);
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/frames-schema.test.ts`
Expected: FAIL — `src/frames/schema.js` does not exist.

- [ ] **Step 3: Implement `src/frames/schema.ts`**

```ts
import { z } from 'zod';

const intrinsicSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const screenSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  radius: z.number().nonnegative(),
});

const shadowSchema = z.object({
  x: z.number(),
  y: z.number(),
  blur: z.number().nonnegative(),
  color: z.string().min(1),
});

export const FrameManifestSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    manufacturer: z.string().min(1),
    colors: z.array(z.string().min(1)).min(1),
    intrinsic: intrinsicSchema,
    screen: screenSchema,
    shadow: shadowSchema.optional(),
    files: z.record(z.string(), z.string().min(1)),
  })
  .superRefine((m, ctx) => {
    if (m.screen.x + m.screen.width > m.intrinsic.width) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['screen'],
        message: `screen rect exceeds intrinsic width (${m.screen.x}+${m.screen.width} > ${m.intrinsic.width})`,
      });
    }
    if (m.screen.y + m.screen.height > m.intrinsic.height) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['screen'],
        message: `screen rect exceeds intrinsic height (${m.screen.y}+${m.screen.height} > ${m.intrinsic.height})`,
      });
    }
    for (const color of m.colors) {
      if (!m.files[color]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['files', color],
          message: `missing svg file mapping for color '${color}'`,
        });
      }
    }
  });

export type FrameManifest = z.infer<typeof FrameManifestSchema>;
```

- [ ] **Step 4: Rewrite `src/frames/load.ts` to use the schema**

Replace the entire file contents with:

```ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import { FrameManifestSchema, type FrameManifest } from './schema.js';

export type { FrameManifest } from './schema.js';

const FRAMES_DIR = path.dirname(fileURLToPath(import.meta.url));

export async function listFrames(): Promise<string[]> {
  const entries = await fs.readdir(FRAMES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .filter((e) => existsSync(path.join(FRAMES_DIR, e.name, 'manifest.json')))
    .map((e) => e.name)
    .sort();
}

/** Read, parse, and Zod-validate manifest.json for a frame. */
export async function loadManifest(id: string): Promise<FrameManifest> {
  const dir = path.join(FRAMES_DIR, id);
  let raw: string;
  try {
    raw = await fs.readFile(path.join(dir, 'manifest.json'), 'utf8');
  } catch {
    throw new Error(`Unknown frame: '${id}'`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Frame '${id}' has invalid manifest.json: ${(err as Error).message}`);
  }
  const result = FrameManifestSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Frame '${id}' has invalid manifest:\n${issues}`);
  }
  return result.data;
}

export async function loadFrame(
  id: string,
  color?: string,
): Promise<{ manifest: FrameManifest; svg: string; color: string }> {
  const manifest = await loadManifest(id);
  const resolved = color && manifest.files[color] ? color : manifest.colors[0];
  if (!resolved || !manifest.files[resolved]) {
    throw new Error(`Frame '${id}' has no usable color/svg files`);
  }
  const dir = path.join(FRAMES_DIR, id);
  const svg = await fs.readFile(path.join(dir, manifest.files[resolved]), 'utf8');
  return { manifest, svg, color: resolved };
}

export interface FrameInfo {
  id: string;
  displayName: string;
  colors: string[];
}

export async function listFrameInfos(): Promise<FrameInfo[]> {
  const ids = await listFrames();
  const infos: FrameInfo[] = [];
  for (const id of ids) {
    const manifest = await loadManifest(id);
    infos.push({ id, displayName: manifest.displayName, colors: manifest.colors });
  }
  return infos;
}
```

- [ ] **Step 5: Verify the new schema test passes**

Run: `npx vitest run tests/frames-schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Regression check on existing frame tests**

Run: `npx vitest run tests/frames.test.ts tests/frames-list.test.ts`
Expected: PASS — pixel-9 still loads through the new schema-validated path.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/frames/schema.ts src/frames/load.ts tests/frames-schema.test.ts
git commit -m "feat(frames): Zod-validate manifests; loader rejects malformed frames"
```

---

### Task 2: Cross-frame structural validation test

**Files:**
- Create: `tests/frames-structural.test.ts`

This is the shared "every new frame is validated by one test" piece called out in the design (§M4.4). It walks every frame directory on disk and asserts manifest + SVG integrity, so adding a frame in later tasks does not require adding test cases.

- [ ] **Step 1: Write the structural test**

`tests/frames-structural.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFrames, loadManifest } from '../src/frames/load.js';

const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/frames');

describe('every frame on disk is structurally valid', () => {
  it('discovers at least one frame', async () => {
    const ids = await listFrames();
    expect(ids.length).toBeGreaterThan(0);
  });

  it('each frame: manifest validates, files match colors, SVGs match intrinsic and have no rasters/remote refs', async () => {
    const ids = await listFrames();
    for (const id of ids) {
      const manifest = await loadManifest(id);

      // colors and files agree
      expect(Object.keys(manifest.files).sort()).toEqual([...manifest.colors].sort());

      // screen rect inside intrinsic (also enforced by schema; assert here for a clear failure)
      expect(manifest.screen.x + manifest.screen.width).toBeLessThanOrEqual(manifest.intrinsic.width);
      expect(manifest.screen.y + manifest.screen.height).toBeLessThanOrEqual(manifest.intrinsic.height);

      // every declared SVG file exists, has a matching viewBox, no rasters, no remote refs
      for (const color of manifest.colors) {
        const svgPath = path.join(FRAMES_DIR, id, manifest.files[color]);
        const svg = await fs.readFile(svgPath, 'utf8');
        const expectedViewBox = `viewBox="0 0 ${manifest.intrinsic.width} ${manifest.intrinsic.height}"`;
        expect(svg, `${id}/${color}.svg viewBox`).toContain(expectedViewBox);
        expect(svg, `${id}/${color}.svg must contain <svg`).toMatch(/<svg[\s>]/);
        expect(svg, `${id}/${color}.svg must not contain <image elements`).not.toMatch(/<image[\s>]/);
        expect(svg, `${id}/${color}.svg must not reference remote URLs`).not.toMatch(/https?:\/\//);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/frames-structural.test.ts`
Expected: PASS (currently only `pixel-9` exists; it satisfies every assertion — viewBox is `0 0 800 1700`, no `<image>`, no `http://`).

- [ ] **Step 3: Commit**

```bash
git add tests/frames-structural.test.ts
git commit -m "test(frames): shared structural validator over every frame on disk"
```

---

### Task 3: SVG builder helpers

**Files:**
- Create: `src/frames/_build/svg.ts`
- Test: `tests/frames-svg-builder.test.ts`

The builders are pure functions. They are offline tooling — never imported by the CLI render path — but live under `src/` so they are typechecked.

- [ ] **Step 1: Write the failing test**

`tests/frames-svg-builder.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPhoneSvg, buildTabletSvg } from '../src/frames/_build/svg.js';

const phone = {
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  body: { top: '#2b2b2f', bottom: '#0e0e10' },
  bezelInner: '#000000',
  button: '#1a1a1c',
  camera: '#070708',
};

const tablet = {
  intrinsic: { width: 1000, height: 1600 },
  screen: { x: 40, y: 64, width: 920, height: 1472, radius: 30 },
  body: { top: '#4b4f55', bottom: '#2a2d31' },
  bezelInner: '#0c0c0c',
  camera: '#070708',
};

describe('buildPhoneSvg', () => {
  it('emits a valid SVG with the right viewBox, gradient, mask, buttons and camera', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 800 1700"');
    expect(svg).toContain('id="body"');
    expect(svg).toContain('id="screenHole"');
    expect(svg).toContain('#2b2b2f');
    expect(svg).toContain('#0e0e10');
    expect(svg).toContain('#1a1a1c'); // buttons
    expect(svg).toContain('<circle');  // front camera
    expect(svg).not.toMatch(/https?:\/\//);
    expect(svg).not.toMatch(/<image[\s>]/);
  });

  it('places the screen mask using the manifest screen rect', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('x="28" y="30" width="744" height="1640" rx="44" ry="44"');
  });
});

describe('buildTabletSvg', () => {
  it('emits a valid SVG with viewBox, mask, and a pill camera (no side buttons)', () => {
    const svg = buildTabletSvg(tablet);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 1000 1600"');
    expect(svg).toContain('id="screenHole"');
    expect(svg).not.toContain('<circle'); // tablets use a pill, not a circle
    expect(svg).toMatch(/<rect[^>]*rx="\d+(?:\.\d+)?" ry="\d+(?:\.\d+)?"/); // at least one rounded rect (the pill / body)
    expect(svg).not.toMatch(/<image[\s>]/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/frames-svg-builder.test.ts`
Expected: FAIL — `src/frames/_build/svg.js` does not exist.

- [ ] **Step 3: Implement the builders**

`src/frames/_build/svg.ts`:

```ts
import type { FrameManifest } from '../schema.js';

export interface PhoneSvgOpts {
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  body: { top: string; bottom: string };
  bezelInner: string;
  button: string;
  camera: string;
}

export interface TabletSvgOpts {
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  body: { top: string; bottom: string };
  bezelInner: string;
  camera: string;
}

/** Phone-style SVG: rounded bezel, screen cut out via mask, two side buttons on the right, a small punch-hole front camera near the top centre. */
export function buildPhoneSvg(opts: PhoneSvgOpts): string {
  const { intrinsic: i, screen: s, body, bezelInner, button, camera } = opts;
  const W = i.width;
  const H = i.height;
  const outerR = Math.round(Math.min(W, H) * 0.09);
  const btnX = W - 8;
  const btnW = 10;
  const pwrY = Math.round(H * 0.21);
  const pwrH = Math.round(H * 0.09);
  const volY = Math.round(H * 0.33);
  const volH = Math.round(H * 0.05);
  const camR = Math.max(8, Math.round(W * 0.014));
  const camCx = Math.round(W / 2);
  const camCy = Math.max(camR + 4, Math.round(s.y * 0.55));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${body.top}"/>
      <stop offset="1" stop-color="${body.bottom}"/>
    </linearGradient>
    <mask id="screenHole">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}" ry="${s.radius}" fill="#000"/>
    </mask>
  </defs>
  <rect x="${btnX}" y="${pwrY}" width="${btnW}" height="${pwrH}" rx="5" fill="${button}"/>
  <rect x="${btnX}" y="${volY}" width="${btnW}" height="${volH}" rx="5" fill="${button}"/>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${outerR - 2}" ry="${outerR - 2}" fill="url(#body)" mask="url(#screenHole)"/>
  <rect x="${s.x - 4}" y="${s.y - 4}" width="${s.width + 8}" height="${s.height + 8}" rx="${s.radius + 4}" ry="${s.radius + 4}" fill="none" stroke="${bezelInner}" stroke-width="6"/>
  <circle cx="${camCx}" cy="${camCy}" r="${camR}" fill="${camera}"/>
</svg>
`;
}

/** Tablet-style SVG: gentler corner radius, no side buttons, pill-shaped front camera centred above the screen. */
export function buildTabletSvg(opts: TabletSvgOpts): string {
  const { intrinsic: i, screen: s, body, bezelInner, camera } = opts;
  const W = i.width;
  const H = i.height;
  const outerR = Math.round(Math.min(W, H) * 0.045);
  const pillW = Math.round(W * 0.06);
  const pillH = Math.max(6, Math.round(W * 0.008));
  const pillX = Math.round((W - pillW) / 2);
  const pillY = Math.max(pillH, Math.round(s.y * 0.5) - Math.round(pillH / 2));
  const pillR = pillH / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${body.top}"/>
      <stop offset="1" stop-color="${body.bottom}"/>
    </linearGradient>
    <mask id="screenHole">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}" ry="${s.radius}" fill="#000"/>
    </mask>
  </defs>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${outerR - 2}" ry="${outerR - 2}" fill="url(#body)" mask="url(#screenHole)"/>
  <rect x="${s.x - 4}" y="${s.y - 4}" width="${s.width + 8}" height="${s.height + 8}" rx="${s.radius + 4}" ry="${s.radius + 4}" fill="none" stroke="${bezelInner}" stroke-width="6"/>
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillR}" ry="${pillR}" fill="${camera}"/>
</svg>
`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/frames-svg-builder.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/frames/_build/svg.ts tests/frames-svg-builder.test.ts
git commit -m "feat(frames): pure SVG builders for phone + tablet frames"
```

---

### Task 4: Generator script + regenerate pixel-9 from the spec

**Files:**
- Create: `src/frames/_build/generate.ts`
- Modify: `package.json` (add `frames:build` script)
- Modify: `src/frames/pixel-9/manifest.json` and `src/frames/pixel-9/obsidian.svg` (regenerated by the script)

The generator becomes the **single source of truth** for the catalog. It contains a typed spec list and `main()` writes every manifest + SVG. Starting it with just `pixel-9 / obsidian` regenerates the existing frame; the dimensions stay 800×1700 so existing tests still pass.

- [ ] **Step 1: Add the npm script**

Edit `package.json`: in the `scripts` block, add `"frames:build": "tsx src/frames/_build/generate.ts"` (keep the existing scripts unchanged). The resulting block:

```json
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "cli": "tsx src/cli.ts",
    "frames:build": "tsx src/frames/_build/generate.ts"
  },
```

- [ ] **Step 2: Create the generator with the pixel-9 spec only**

`src/frames/_build/generate.ts`:

```ts
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

const FRAMES: FrameSpec[] = [
  {
    form: 'phone',
    id: 'pixel-9',
    displayName: 'Pixel 9',
    manufacturer: 'Google',
    intrinsic: { width: 800, height: 1700 },
    screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
    shadow: SHADOW,
    colorways: { obsidian: OBSIDIAN },
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
    const cw = spec.colorways[color];
    const svg =
      spec.form === 'phone'
        ? buildPhoneSvg({ intrinsic: spec.intrinsic, screen: spec.screen, ...cw })
        : buildTabletSvg({ intrinsic: spec.intrinsic, screen: spec.screen, ...cw });
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
```

- [ ] **Step 3: Run the generator**

Run: `npm run frames:build`
Expected: prints `✓ pixel-9 (obsidian)` and `Generated 1 frame(s) in …`. Overwrites `src/frames/pixel-9/manifest.json` and `src/frames/pixel-9/obsidian.svg`.

- [ ] **Step 4: Verify the regenerated pixel-9 still passes every existing test**

Run: `npx vitest run tests/frames.test.ts tests/frames-list.test.ts tests/frames-structural.test.ts tests/renderSlot.test.ts`
Expected: all PASS. The regenerated SVG keeps the same intrinsic + screen rect, so:
- `frames.test.ts` (asserts manifest.intrinsic, screen.width, viewBox substring) passes.
- `frames-list.test.ts` (asserts displayName 'Pixel 9' and colors contains 'obsidian') passes.
- `frames-structural.test.ts` passes (one frame, valid).
- `renderSlot.test.ts` (real Chromium, renders bold-headline through pixel-9) passes.

If any test fails, STOP and report — do not edit the generated files by hand; report the discrepancy and let the controller adjust the generator.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit (includes the regenerated files)**

```bash
git add package.json src/frames/_build/generate.ts src/frames/pixel-9/manifest.json src/frames/pixel-9/obsidian.svg
git commit -m "feat(frames): generator script; pixel-9 now built from spec"
```

---

### Task 5: Pixel 9 — add the porcelain colorway

**Files:**
- Modify: `src/frames/_build/generate.ts` (extend pixel-9 colorways)
- Modify: `src/frames/pixel-9/manifest.json` and add `src/frames/pixel-9/porcelain.svg` (both produced by the generator)

- [ ] **Step 1: Add the porcelain colorway constant in `generate.ts`**

Just below the `OBSIDIAN` constant, add:

```ts
const PORCELAIN: PhoneColorway = {
  body: { top: '#f5f1ea', bottom: '#e2dccf' },
  bezelInner: '#1f1d1a',
  button: '#c8c0b1',
  camera: '#1a1916',
};
```

- [ ] **Step 2: Extend the pixel-9 spec entry**

In the `FRAMES` array, change the `pixel-9` `colorways` field from `{ obsidian: OBSIDIAN }` to `{ obsidian: OBSIDIAN, porcelain: PORCELAIN }`.

- [ ] **Step 3: Run the generator**

Run: `npm run frames:build`
Expected: prints `✓ pixel-9 (obsidian, porcelain)`. Now `src/frames/pixel-9/` contains `manifest.json` (with two colors), `obsidian.svg`, and `porcelain.svg`.

- [ ] **Step 4: Run the structural + list tests**

Run: `npx vitest run tests/frames-structural.test.ts tests/frames-list.test.ts tests/frames.test.ts`
Expected: PASS. The structural test now iterates both SVGs and validates the porcelain one. `frames-list.test.ts` asserts colors *contain* 'obsidian' (still true).

- [ ] **Step 5: Commit**

```bash
git add src/frames/_build/generate.ts src/frames/pixel-9/manifest.json src/frames/pixel-9/porcelain.svg
git commit -m "feat(frames): add pixel-9 porcelain colorway"
```

---

### Task 6: Pixel 9 Pro family (Pro + Pro XL)

**Files:**
- Modify: `src/frames/_build/generate.ts` (add two spec entries + the HAZEL colorway)
- Create: `src/frames/pixel-9-pro/manifest.json` + `obsidian.svg` + `hazel.svg`
- Create: `src/frames/pixel-9-pro-xl/manifest.json` + `obsidian.svg` + `porcelain.svg`

- [ ] **Step 1: Add the HAZEL colorway in `generate.ts`**

Just below the `PORCELAIN` constant, add:

```ts
const HAZEL: PhoneColorway = {
  body: { top: '#6d6a55', bottom: '#43412f' },
  bezelInner: '#0c0c0a',
  button: '#34322a',
  camera: '#0a0a08',
};
```

- [ ] **Step 2: Add the two spec entries**

Append to the `FRAMES` array (after the `pixel-9` entry):

```ts
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
```

- [ ] **Step 3: Run the generator**

Run: `npm run frames:build`
Expected: prints three lines (pixel-9, pixel-9-pro, pixel-9-pro-xl). The two new directories are created with manifest + 2 SVGs each.

- [ ] **Step 4: Validate**

Run: `npx vitest run tests/frames-structural.test.ts tests/frames-list.test.ts`
Expected: PASS. The structural test discovers the two new frames and validates every SVG.

- [ ] **Step 5: Commit**

```bash
git add src/frames/_build/generate.ts src/frames/pixel-9-pro src/frames/pixel-9-pro-xl
git commit -m "feat(frames): add Pixel 9 Pro and Pixel 9 Pro XL"
```

---

### Task 7: Pixel 9a + generic Android

**Files:**
- Modify: `src/frames/_build/generate.ts` (add two spec entries + the IRIS and GRAPHITE colorways)
- Create: `src/frames/pixel-9a/manifest.json` + `obsidian.svg` + `iris.svg`
- Create: `src/frames/generic-android/manifest.json` + `graphite.svg`

- [ ] **Step 1: Add the IRIS and GRAPHITE colorways**

Just below the `HAZEL` constant, add:

```ts
const IRIS: PhoneColorway = {
  body: { top: '#6a7299', bottom: '#3f476a' },
  bezelInner: '#0d0e16',
  button: '#2e3550', // darker than body bottom
  camera: '#0a0b14',
};

const GRAPHITE: PhoneColorway = {
  body: { top: '#4b4f55', bottom: '#23262a' },
  bezelInner: '#0c0c0e',
  button: '#1c1e22',
  camera: '#08080a',
};
```

- [ ] **Step 2: Add the two spec entries**

Append to the `FRAMES` array (after the `pixel-9-pro-xl` entry):

```ts
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
```

- [ ] **Step 3: Run the generator**

Run: `npm run frames:build`
Expected: prints 5 lines (pixel-9, 9-pro, 9-pro-xl, 9a, generic-android).

- [ ] **Step 4: Validate**

Run: `npx vitest run tests/frames-structural.test.ts tests/frames-list.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frames/_build/generate.ts src/frames/pixel-9a src/frames/generic-android
git commit -m "feat(frames): add Pixel 9a and a generic-android phone frame"
```

---

### Task 8: Tablet frames (Pixel Tablet + generic 7" + generic 10")

**Files:**
- Modify: `src/frames/_build/generate.ts` (add three tablet spec entries + tablet colorway constants)
- Create: `src/frames/pixel-tablet/manifest.json` + `porcelain.svg` + `hazel.svg`
- Create: `src/frames/generic-tablet-7/manifest.json` + `graphite.svg`
- Create: `src/frames/generic-tablet-10/manifest.json` + `graphite.svg`

These three frames ship as **validated assets only**: their manifests parse, their SVGs are structurally clean, and `frames list` shows them — but they cannot be fully rendered yet because `resolveDimensions` is phone-only (M5 owns tablet rendering). The structural test covers them; the render-matrix test in Task 9 deliberately does NOT include them.

- [ ] **Step 1: Add the tablet colorway constants**

Just below the `GRAPHITE` constant, add:

```ts
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
```

- [ ] **Step 2: Add the three spec entries**

Append to the `FRAMES` array (after the `generic-android` entry):

```ts
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
```

- [ ] **Step 3: Run the generator**

Run: `npm run frames:build`
Expected: prints 8 lines, ending with the three tablets. Eight `src/frames/<id>/` directories now exist.

- [ ] **Step 4: Validate**

Run: `npx vitest run tests/frames-structural.test.ts`
Expected: PASS. All 8 frames discovered; every SVG matches its manifest viewBox; no remotes; no `<image>` rasters.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/frames/_build/generate.ts src/frames/pixel-tablet src/frames/generic-tablet-7 src/frames/generic-tablet-10
git commit -m "feat(frames): add Pixel Tablet and generic 7\"/10\" tablet frames (assets only)"
```

---

### Task 9: Render matrix across phone frames + CLI/list assertions + docs + final verification

**Files:**
- Modify: `tests/renderSlot.test.ts` (render bold-headline through each of the 5 phone frames)
- Modify: `tests/frames-list.test.ts` (tighten the assertion across all 8 frames)
- Modify: `tests/cli.m2.smoke.test.ts` (assert `frames list` shows the new ids)
- Modify: `CLAUDE.md` (frame catalog + current state to "Milestones 1–4 complete")

- [ ] **Step 1: Extend `tests/renderSlot.test.ts`**

Open the file. Inside the existing `CONFIG` string, add **four more slots** to the `slots` array — one per new phone frame — so `renderSlot` can be exercised with each. Add these slot literals just before the closing `]` of the `slots` array (the three M3 slots `01-onboarding`, `02-showcase`, `03-overlap` stay exactly as they are):

```ts
    {
      id: '04-pixel-9-pro',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9-pro', color: 'obsidian' },
      copy: { headline: { 'en-US': 'Pixel 9 Pro' } },
    },
    {
      id: '05-pixel-9-pro-xl',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9-pro-xl', color: 'porcelain' },
      copy: { headline: { 'en-US': 'Pixel 9 Pro XL' } },
    },
    {
      id: '06-pixel-9a',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9a', color: 'iris' },
      copy: { headline: { 'en-US': 'Pixel 9a' } },
    },
    {
      id: '07-generic-android',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'generic-android', color: 'graphite' },
      copy: { headline: { 'en-US': 'Generic' } },
    },
```

Then at the bottom of the existing `describe('renderSlot', ...)` block — just before its closing `});` — append a parameterized loop covering the new phone frames:

```ts
  for (const [slotId, frameId] of [
    ['04-pixel-9-pro', 'pixel-9-pro'],
    ['05-pixel-9-pro-xl', 'pixel-9-pro-xl'],
    ['06-pixel-9a', 'pixel-9a'],
    ['07-generic-android', 'generic-android'],
  ] as const) {
    it(`renders a valid in-constraint PNG with frame '${frameId}' (slot ${slotId})`, async () => {
      const buf = await renderSlot(server, slotId, 'en-US', 'phone');
      const meta = await sharp(buf).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1920);
      expect(buf.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
    }, 180_000);
  }
```

- [ ] **Step 2: Tighten `tests/frames-list.test.ts`**

Replace the entire file contents with:

```ts
import { describe, it, expect } from 'vitest';
import { listFrameInfos } from '../src/frames/load.js';

const EXPECTED = [
  { id: 'pixel-9', displayName: 'Pixel 9', colors: ['obsidian', 'porcelain'] },
  { id: 'pixel-9-pro', displayName: 'Pixel 9 Pro', colors: ['obsidian', 'hazel'] },
  { id: 'pixel-9-pro-xl', displayName: 'Pixel 9 Pro XL', colors: ['obsidian', 'porcelain'] },
  { id: 'pixel-9a', displayName: 'Pixel 9a', colors: ['obsidian', 'iris'] },
  { id: 'pixel-tablet', displayName: 'Pixel Tablet', colors: ['porcelain', 'hazel'] },
  { id: 'generic-android', displayName: 'Generic Android', colors: ['graphite'] },
  { id: 'generic-tablet-7', displayName: 'Generic 7" Tablet', colors: ['graphite'] },
  { id: 'generic-tablet-10', displayName: 'Generic 10" Tablet', colors: ['graphite'] },
];

describe('listFrameInfos', () => {
  it('lists every built-in frame with its display name and at least the expected colors', async () => {
    const infos = await listFrameInfos();
    const byId = new Map(infos.map((i) => [i.id, i]));
    for (const want of EXPECTED) {
      const got = byId.get(want.id);
      expect(got, `frame '${want.id}' should be listed`).toBeDefined();
      expect(got!.displayName).toBe(want.displayName);
      for (const color of want.colors) {
        expect(got!.colors, `frame '${want.id}' should expose color '${color}'`).toContain(color);
      }
    }
  });

  it('returns ids in a stable sorted order', async () => {
    const infos = await listFrameInfos();
    const ids = infos.map((i) => i.id);
    expect(ids).toEqual([...ids].sort());
  });
});
```

- [ ] **Step 3: Tighten the CLI smoke test for `frames list`**

In `tests/cli.m2.smoke.test.ts`, find the test titled `'frames list prints pixel-9'`. Rename it to `'frames list prints every built-in frame'` and add assertions for every new frame id. The block becomes:

```ts
  it('frames list prints every built-in frame', async () => {
    const res = await runCli(root, 'frames', 'list');
    expect(res.code).toBe(0);
    for (const id of [
      'pixel-9',
      'pixel-9-pro',
      'pixel-9-pro-xl',
      'pixel-9a',
      'pixel-tablet',
      'generic-android',
      'generic-tablet-7',
      'generic-tablet-10',
    ]) {
      expect(res.stdout).toContain(id);
    }
  });
```

(Leave every other test in the file unchanged.)

- [ ] **Step 4: Update `CLAUDE.md`**

Apply these edits using the Edit tool.

**4a.** Replace the existing module-map row for `src/frames/pixel-9/` (the row immediately after `src/frames/load.ts`) with the following four rows:

old:
```
| `src/frames/pixel-9/` | `manifest.json` + `obsidian.svg` (clean-room) |
```

new:
```
| `src/frames/schema.ts` | Zod `FrameManifestSchema` + inferred `FrameManifest` type |
| `src/frames/<id>/` | `manifest.json` + one clean-room `<color>.svg` per colorway (8 built-in frames) |
| `src/frames/_build/svg.ts` | Pure SVG builders (`buildPhoneSvg`, `buildTabletSvg`) — offline tooling |
| `src/frames/_build/generate.ts` | Frame generator: writes every manifest + SVG from a typed spec; run via `npm run frames:build` |
```

**4b.** Replace the existing "How to add a device frame (works today)" section (heading + body) with this updated version that points at the generator instead of describing the manual file layout:

old (section header through its last numbered list item):
```
## How to add a device frame (works today)

1. Create `src/frames/<id>/manifest.json` (`id`, `displayName`, `manufacturer`, `colors`,
   `intrinsic {width,height}`, `screen {x,y,width,height,radius}`, optional `shadow`, and a
   `files` map of color→svg filename). The `screen` rect is in intrinsic coordinates; the
   template positions the screenshot using these as percentages.
2. Add one clean-room `<color>.svg` per color: `viewBox` matching `intrinsic`, a transparent
   rounded-rect cutout over the screen area, body/buttons/camera as vector paths, **no raster
   `<image>` elements, no remote resources**.
3. `listFrames()` auto-discovers any directory containing a `manifest.json`. Reference it in a
   config slot as `frame: { id: '<id>', color: '<color>' }`.
```

new:
```
## How to add a device frame (works today)

Every built-in frame is produced by the generator at `src/frames/_build/generate.ts` from a
single typed spec list, so adding a frame is a data-only change.

1. Open `src/frames/_build/generate.ts` and add a `PhoneSpec` or `TabletSpec` entry to the
   `FRAMES` array. Provide `id`, `displayName`, `manufacturer`, `intrinsic {width,height}`,
   `screen {x,y,width,height,radius}` (in intrinsic coordinates), optional `shadow`, and a
   `colorways` map of color name → `PhoneColorway` (body gradient, bezelInner, button, camera)
   or `TabletColorway` (no button). Reuse existing colorway constants where they fit.
2. Run `npm run frames:build`. The script writes `src/frames/<id>/manifest.json` and one
   `<color>.svg` per colorway using `buildPhoneSvg` / `buildTabletSvg`. SVGs are clean-room:
   `viewBox` matches `intrinsic`, screen is masked out for the screenshot to show through, no
   `<image>` rasters, no remote refs.
3. `listFrames()` auto-discovers any directory containing a `manifest.json`, and
   `tests/frames-structural.test.ts` validates every frame on disk — no per-frame test code
   needed. Reference the frame in a config slot as `frame: { id: '<id>', color: '<color>' }`.

Tablet frames are catalogued but `resolveDimensions` is phone-only until Milestone 5; until
then they ship as validated assets that `frames list` shows but `generate` cannot render.
```

**4c.** Replace the "Current state" line:

old:
```
Current state: **Milestones 1–3 complete**; next is **Milestone 4 (device frames)**.
```

new:
```
Current state: **Milestones 1–4 complete**; next is **Milestone 5 (form factors, theming, tilt)**.
```

- [ ] **Step 5: Full verification**

Run: `npx vitest run`
Expected: every test passes. Counts will increase by the four new render-matrix tests + the new schema/structural/builder suites added earlier (anticipate ~95+ total).

Run: `npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 6: Commit**

```bash
git add tests/renderSlot.test.ts tests/frames-list.test.ts tests/cli.m2.smoke.test.ts CLAUDE.md
git commit -m "test: render matrix across phone frames; docs: M4 frame catalog"
```

---

## Done criteria for Milestone 4

- Eight frame directories exist under `src/frames/`: `pixel-9`, `pixel-9-pro`, `pixel-9-pro-xl`, `pixel-9a`, `pixel-tablet`, `generic-android`, `generic-tablet-7`, `generic-tablet-10`. Thirteen SVG files total.
- Every manifest is Zod-validated at load time; malformed manifests fail with a field path.
- A single structural test (`tests/frames-structural.test.ts`) validates every frame on disk for: manifest schema, screen-within-intrinsic, files↔colors agreement, SVG viewBox matches intrinsic, no `<image>` rasters, no remote URLs.
- All five phone frames render to valid 1080×1920 PNGs under 8 MB through real Chromium with the `bold-headline` template.
- The three tablet frames ship as validated assets; `frames list` shows all eight ids; `resolveDimensions` is unchanged (still phone-only, M5 territory).
- `npm run frames:build` regenerates every manifest + SVG from the spec data. The generator is the single source of truth.
- `npx vitest run` and `npx tsc --noEmit` are both clean.
- `CLAUDE.md` reflects the catalog and the generator-based extension workflow.

## Self-review notes

- **Spec coverage:** §M4.1 visual style → buildPhone/TabletSvg in Task 3; §M4.2 catalog (8 frames) → Tasks 4–8; §M4.3 honest scope split (phone fully wired, tablets assets-only) → render matrix in Task 9 covers only phones; §M4.4 loader hardening (Zod) → Task 1; §M4.5 tests (schema + structural + list + render matrix + CLI) → Tasks 1, 2, 9.
- **Placeholder scan:** every code block is complete; no TBD/TODO; every step has an exact command and an expected outcome.
- **Type/name consistency:** `FrameManifest`/`FrameManifestSchema` defined in Task 1 and used identically thereafter; `PhoneSpec`/`TabletSpec`/`FrameSpec`/`PhoneColorway`/`TabletColorway` defined in Task 4 and reused by Tasks 5–8; builder option shapes (`PhoneSvgOpts`, `TabletSvgOpts`) match `intrinsic` + `screen` + a colorway object exactly.
- **Carry-over to M5:** the three tablet frames intentionally render only structurally in M4; M5 adds `resolveDimensions` for `tablet7`/`tablet10` and wires them into the renderer. No code in this milestone needs to be revisited then.
