# AOSP Frame Geometry + Layered Metal/Bezel Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-draw the built-in device frames using exact screen geometry extracted from the AOSP emulator skins, with a realistic three-layer (metal rim → black bezel → screen) SVG look, and establish mixed MIT + Apache-2.0 licensing.

**Architecture:** Geometry is read (measurements only) from AOSP `layout` text files and committed into the `FRAMES` spec in `src/frames/_build/generate.ts`. The SVG builders (`src/frames/_build/svg.ts`) gain a layered metal/black-bezel model with concentric corner radii. `npm run frames:build` regenerates every `manifest.json` + `<color>.svg`. Manifests self-document provenance via new `source`/`license` fields. SVGs remain clean-room — no AOSP raster is copied.

**Tech Stack:** TypeScript (ESM, run via tsx), Zod (manifest schema), Vitest (TDD), SVG string builders. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-28-aosp-frame-geometry-design.md`

---

## File Structure

- `LICENSE` — **create** — MIT license text (repo has none today).
- `LICENSE-APACHE` — **create** — verbatim Apache License 2.0 text.
- `NOTICE` — **create** — AOSP attribution for the derived frame geometry.
- `README.md` — **modify** — License section.
- `src/frames/schema.ts` — **modify** — add optional `source`/`license` to `FrameManifestSchema`.
- `src/frames/_build/svg.ts` — **modify** — new layered `buildPhoneSvg`/`buildTabletSvg`; new opts shape.
- `src/frames/_build/aosp-layout.ts` — **create** — pure `parseAospLayout(text)` parser.
- `src/frames/_build/extract-aosp.ts` — **create** — offline CLI that prints spec snippets (manual use).
- `src/frames/_build/generate.ts` — **modify** — colorway constants → new shape; `FRAMES` re-tuned + expanded; `writeFrame` emits `source`/`license`.
- `package.json` — **modify** — add `frames:extract` script.
- `tests/licensing.test.ts` — **create**.
- `tests/frames-schema.test.ts` — **modify** — provenance fields.
- `tests/aosp-layout.test.ts` — **create** — parser unit test.
- `tests/frames-svg-builder.test.ts` — **modify** — new layered structure.
- `tests/frames-geometry.test.ts` — **create** — on-disk manifests match AOSP numbers.
- Regenerated assets under `src/frames/<id>/` — produced by `frames:build`, committed.

---

## Task 1: Licensing files + README note

**Files:**
- Create: `LICENSE`, `LICENSE-APACHE`, `NOTICE`
- Modify: `README.md:197-199`
- Test: `tests/licensing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/licensing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');

describe('licensing', () => {
  it('ships an MIT LICENSE file', () => {
    expect(existsSync(path.join(ROOT, 'LICENSE'))).toBe(true);
    expect(read('LICENSE')).toMatch(/MIT License/);
  });

  it('ships the Apache-2.0 license text', () => {
    expect(existsSync(path.join(ROOT, 'LICENSE-APACHE'))).toBe(true);
    expect(read('LICENSE-APACHE')).toMatch(/Apache License\s*\n\s*Version 2\.0/);
  });

  it('ships a NOTICE attributing AOSP', () => {
    expect(existsSync(path.join(ROOT, 'NOTICE'))).toBe(true);
    expect(read('NOTICE')).toMatch(/Android Open Source Project/);
  });

  it('README documents the mixed license', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/Apache License, Version 2\.0/);
    expect(readme).toMatch(/LICENSE-APACHE/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/licensing.test.ts`
Expected: FAIL — LICENSE/LICENSE-APACHE/NOTICE don't exist; README lacks the note.

- [ ] **Step 3: Create `LICENSE`** (MIT)

```text
MIT License

Copyright (c) 2026 Michal Tajchert and screenshot-composer contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Create `LICENSE-APACHE`** — write the verbatim Apache License 2.0.

The canonical text is at https://www.apache.org/licenses/LICENSE-2.0.txt. Copy it exactly (it begins with a line `Apache License`, then `Version 2.0, January 2004`). If offline, a copy ships with most Apache-2.0 npm deps; otherwise reproduce the standard text. The file MUST start with:

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/
```
...through the full "APPENDIX: How to apply the Apache License to your work" section. Do not abbreviate.

- [ ] **Step 5: Create `NOTICE`**

```text
screenshot-composer
Copyright 2026 Michal Tajchert and screenshot-composer contributors

This product includes software/assets developed by
The Android Open Source Project (https://source.android.com/).

The built-in device frames under src/frames/ are clean-room SVG redraws.
Their geometry (screen dimensions, corner radii, and bezel offsets) is
derived from the Android emulator device skins, which are licensed under
the Apache License, Version 2.0. No Android raster assets are included or
redistributed. See LICENSE-APACHE for the full Apache-2.0 text.
```

- [ ] **Step 6: Update the README License section**

Replace `README.md` lines 197-199 (the `## License` heading and the `MIT.` line) with:

```markdown
## License

This project is licensed under the MIT License. However, it incorporates assets and code from the Android Open Source Project (AOSP), which are licensed under the Apache License, Version 2.0. See the LICENSE-APACHE file for details.

The full MIT text is in [LICENSE](LICENSE); attribution for AOSP-derived material is in [NOTICE](NOTICE).
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/licensing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add LICENSE LICENSE-APACHE NOTICE README.md tests/licensing.test.ts
git commit -m "chore: add MIT + Apache-2.0 license files and AOSP NOTICE"
```

---

## Task 2: Manifest provenance fields (`source`, `license`)

**Files:**
- Modify: `src/frames/schema.ts`
- Test: `tests/frames-schema.test.ts`

- [ ] **Step 1: Add failing tests**

Append two tests inside the `describe('FrameManifestSchema', ...)` block in `tests/frames-schema.test.ts`:

```ts
  it('accepts optional source and license provenance fields', () => {
    const withProvenance = { ...valid, source: 'AOSP emulator skin pixel_9', license: 'Apache-2.0' };
    const r = FrameManifestSchema.safeParse(withProvenance);
    expect(r.success).toBe(true);
  });

  it('still accepts a manifest with no provenance fields (back-compat)', () => {
    const r = FrameManifestSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });
```

- [ ] **Step 2: Run to verify the first new test fails**

Run: `npx vitest run tests/frames-schema.test.ts`
Expected: the "accepts optional source and license" test FAILS only if the schema strips/rejects them. (Zod objects strip unknown keys silently, so `safeParse` may pass but the parsed value loses the fields.) To make the guard meaningful, also assert the parsed value keeps them — update the new test:

```ts
  it('accepts optional source and license provenance fields', () => {
    const withProvenance = { ...valid, source: 'AOSP emulator skin pixel_9', license: 'Apache-2.0' };
    const r = FrameManifestSchema.safeParse(withProvenance);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.source).toBe('AOSP emulator skin pixel_9');
      expect(r.data.license).toBe('Apache-2.0');
    }
  });
```

Re-run: now FAILS because `r.data.source`/`r.data.license` are `undefined` (stripped — not in schema).

- [ ] **Step 3: Add the fields to the schema**

In `src/frames/schema.ts`, inside the `z.object({ ... })` passed to `FrameManifestSchema` (alongside `files`), add:

```ts
    source: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/frames-schema.test.ts`
Expected: PASS (all, including the two new ones).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/frames/schema.ts tests/frames-schema.test.ts
git commit -m "feat(frames): manifest source/license provenance fields"
```

---

## Task 3: AOSP `layout` parser + offline extractor

**Files:**
- Create: `src/frames/_build/aosp-layout.ts`
- Create: `src/frames/_build/extract-aosp.ts`
- Modify: `package.json` (scripts)
- Test: `tests/aosp-layout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/aosp-layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAospLayout } from '../src/frames/_build/aosp-layout.js';

// Trimmed copy of ~/Library/Android/sdk/skins/pixel_9/layout
const PIXEL_9 = `parts {
  device {
    display {
      width 1080
      height 2424
      x 0
      y 0
      corner_radius 87
    }
  }
}
layouts {
  portrait {
    width 1198
    height 2531
    part2 {
      name device
      x 55
      y 58
    }
  }
}`;

describe('parseAospLayout', () => {
  it('extracts display, corner radius, frame size and device offset', () => {
    const g = parseAospLayout(PIXEL_9);
    expect(g.display).toEqual({ width: 1080, height: 2424 });
    expect(g.cornerRadius).toBe(87);
    expect(g.frame).toEqual({ width: 1198, height: 2531 });
    expect(g.offset).toEqual({ x: 55, y: 58 });
  });

  it('returns null cornerRadius when the layout omits it (Pixel 6/7/8)', () => {
    const noRadius = PIXEL_9.replace(/\s*corner_radius 87\n/, '\n');
    const g = parseAospLayout(noRadius);
    expect(g.cornerRadius).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/aosp-layout.test.ts`
Expected: FAIL — module `aosp-layout.ts` does not exist.

- [ ] **Step 3: Implement the parser**

Create `src/frames/_build/aosp-layout.ts`:

```ts
export interface AospGeometry {
  display: { width: number; height: number };
  cornerRadius: number | null;
  frame: { width: number; height: number };
  offset: { x: number; y: number };
}

/** Parse an AOSP emulator skin `layout` file (measurements only). */
export function parseAospLayout(text: string): AospGeometry {
  // display {} block — first width/height after it
  const display = sliceBlock(text, 'display');
  const layouts = sliceBlock(text, 'layouts');
  // device part offset lives after `name device`
  const deviceAt = layouts.indexOf('name device');
  const devicePart = deviceAt >= 0 ? layouts.slice(deviceAt) : layouts;

  const radius = num(display, 'corner_radius');
  return {
    display: { width: req(display, 'width'), height: req(display, 'height') },
    cornerRadius: radius === undefined ? null : radius,
    frame: { width: req(layouts, 'width'), height: req(layouts, 'height') },
    offset: { x: req(devicePart, 'x'), y: req(devicePart, 'y') },
  };
}

function sliceBlock(text: string, key: string): string {
  const i = text.indexOf(`${key} {`);
  return i >= 0 ? text.slice(i) : text;
}
function num(block: string, key: string): number | undefined {
  const m = new RegExp(`\\b${key}\\s+(-?\\d+)`).exec(block);
  return m ? Number(m[1]) : undefined;
}
function req(block: string, key: string): number {
  const v = num(block, key);
  if (v === undefined) throw new Error(`layout missing '${key}'`);
  return v;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/aosp-layout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the offline extractor CLI**

Create `src/frames/_build/extract-aosp.ts` (manual dev tool; reads the local SDK, prints a spec snippet — never run in CI):

```ts
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseAospLayout } from './aosp-layout.js';

const SDK = process.env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk');
const skins = process.argv.slice(2);
if (skins.length === 0) {
  console.error('Usage: npm run frames:extract -- pixel_9 pixel_8 ...');
  process.exit(1);
}

for (const skin of skins) {
  const layoutPath = path.join(SDK, 'skins', skin, 'layout');
  const g = parseAospLayout(readFileSync(layoutPath, 'utf8'));
  const radius = g.cornerRadius ?? Math.round(0.08 * g.display.width); // documented fallback
  const screen = { x: g.offset.x, y: g.offset.y, width: g.display.width, height: g.display.height, radius };
  console.log(`// source: AOSP emulator skin ${skin}`);
  console.log(`intrinsic: { width: ${g.frame.width}, height: ${g.frame.height} },`);
  console.log(`screen: ${JSON.stringify(screen)},`);
  console.log('');
}
```

- [ ] **Step 6: Add the npm script**

In `package.json` `scripts`, after `"frames:build"`, add:

```json
    "frames:extract": "tsx src/frames/_build/extract-aosp.ts"
```

(Remember to add the trailing comma to the preceding line.)

- [ ] **Step 7: Typecheck + commit**

```bash
npm run typecheck
git add src/frames/_build/aosp-layout.ts src/frames/_build/extract-aosp.ts package.json tests/aosp-layout.test.ts
git commit -m "feat(frames): offline AOSP layout parser + extractor tool"
```

---

## Task 4: Layered metal/black-bezel SVG builders

**Files:**
- Modify: `src/frames/_build/svg.ts`
- Test: `tests/frames-svg-builder.test.ts`

- [ ] **Step 1: Rewrite the builder test (failing)**

Replace the entire contents of `tests/frames-svg-builder.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { buildPhoneSvg, buildTabletSvg } from '../src/frames/_build/svg.js';

const phone = {
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  metal: { top: '#3a3a3f', bottom: '#0e0e10' },
  rim: '#6b6b70',
  bezel: '#050506',
  button: '#1a1a1c',
  camera: '#070708',
};

const tablet = {
  intrinsic: { width: 1000, height: 1600 },
  screen: { x: 40, y: 64, width: 920, height: 1472, radius: 30 },
  metal: { top: '#5b5f65', bottom: '#23262a' },
  rim: '#8b8f95',
  bezel: '#050506',
  camera: '#070708',
};

// Concentric geometry for the phone fixture:
//   minBezel = min(28,30, 800-28-744=28, 1700-30-1640=30) = 28
//   metal outer radius = 44 + 28 = 72  (rect uses rx = outerR-2 = 70)
//   rimWidth = round(0.35*28) = 10
//   black bezel outer radius = 44 + (28-10) = 62 ; inset rect at x=10 y=10 w=780 h=1680
describe('buildPhoneSvg (layered metal/bezel)', () => {
  it('emits a clean SVG with the right viewBox and metal gradient', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 800 1700"');
    expect(svg).toContain('id="metal"');
    expect(svg).toContain('id="screenHole"');
    expect(svg).toContain('#3a3a3f');
    expect(svg).toContain('#0e0e10');
    expect(svg).not.toMatch(/<image[\s>]/);
    expect(svg).not.toMatch(/(?:^|\s)(?:href|src|xlink:href)\s*=\s*["']https?:\/\//);
  });

  it('places the screen mask using the manifest screen rect', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('x="28" y="30" width="744" height="1640" rx="44" ry="44"');
  });

  it('draws three concentric layers: metal body, rim highlight, black bezel margin', () => {
    const svg = buildPhoneSvg(phone);
    expect(svg).toContain('fill="url(#metal)"');           // metal body
    expect(svg).toContain(`stroke="${phone.rim}"`);         // rim highlight
    expect(svg).toContain(`fill="${phone.bezel}"`);         // black bezel margin
    // concentric radii (computed above)
    expect(svg).toContain('rx="70" ry="70"');               // metal body (outerR-2)
    expect(svg).toContain('x="10" y="10" width="780" height="1680" rx="62" ry="62"'); // bezel inset
  });

  it('draws side buttons AFTER the metal body (so they appear on top)', () => {
    const svg = buildPhoneSvg(phone);
    const bodyIdx = svg.indexOf('fill="url(#metal)"');
    const buttonIdx = svg.indexOf(`fill="${phone.button}"`);
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(buttonIdx).toBeGreaterThan(bodyIdx);
  });

  it('has the front camera as a circle', () => {
    expect(buildPhoneSvg(phone)).toContain('<circle');
  });
});

describe('buildTabletSvg (layered metal/bezel)', () => {
  it('emits a clean SVG with viewBox, metal gradient, bezel and a pill camera (no buttons/circle)', () => {
    const svg = buildTabletSvg(tablet);
    expect(svg).toContain('viewBox="0 0 1000 1600"');
    expect(svg).toContain('id="metal"');
    expect(svg).toContain('id="screenHole"');
    expect(svg).toContain('fill="url(#metal)"');
    expect(svg).toContain(`fill="${tablet.bezel}"`);
    expect(svg).not.toContain('<circle');                   // pill, not circle
    expect(svg).not.toMatch(/<image[\s>]/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/frames-svg-builder.test.ts`
Expected: FAIL — old `buildPhoneSvg` has no `id="metal"`, no `rim`/`bezel` opts, no concentric layers.

- [ ] **Step 3: Rewrite `buildPhoneSvg`/`buildTabletSvg`**

Replace the contents of `src/frames/_build/svg.ts` with:

```ts
import type { FrameManifest } from '../schema.js';

export interface PhoneSvgOpts {
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  metal: { top: string; bottom: string };
  rim: string;
  bezel: string;
  button: string;
  camera: string;
}

export interface TabletSvgOpts {
  intrinsic: FrameManifest['intrinsic'];
  screen: FrameManifest['screen'];
  metal: { top: string; bottom: string };
  rim: string;
  bezel: string;
  camera: string;
}

/** Fraction of the (minimum) bezel that the visible metal rim occupies; the rest is black bezel. */
const RIM_RATIO = 0.35;

function layers(i: FrameManifest['intrinsic'], s: FrameManifest['screen']) {
  const W = i.width;
  const H = i.height;
  const minBezel = Math.min(s.x, s.y, W - s.x - s.width, H - s.y - s.height);
  const outerR = s.radius + minBezel;               // concentric metal outer corner
  const rimWidth = Math.round(RIM_RATIO * minBezel); // visible metal rim band
  const blackR = s.radius + (minBezel - rimWidth);   // concentric black-bezel outer corner
  return { W, H, outerR, rimWidth, blackR };
}

function defs(W: number, H: number, s: FrameManifest['screen'], metal: { top: string; bottom: string }): string {
  return `  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${metal.top}"/>
      <stop offset="1" stop-color="${metal.bottom}"/>
    </linearGradient>
    <mask id="screenHole">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}" ry="${s.radius}" fill="#000"/>
    </mask>
  </defs>`;
}

/** Metal frame, a thin rim highlight on the outer edge, then a black bezel margin down to the screen. */
function frameLayers(W: number, H: number, outerR: number, rimWidth: number, blackR: number, rim: string, bezel: string): string {
  return `  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${outerR - 2}" ry="${outerR - 2}" fill="url(#metal)" mask="url(#screenHole)"/>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${outerR - 2}" ry="${outerR - 2}" fill="none" stroke="${rim}" stroke-width="3"/>
  <rect x="${rimWidth}" y="${rimWidth}" width="${W - 2 * rimWidth}" height="${H - 2 * rimWidth}" rx="${blackR}" ry="${blackR}" fill="${bezel}" mask="url(#screenHole)"/>`;
}

/** Phone-style SVG: metal frame + black bezel, two right-side buttons, a punch-hole front camera. */
export function buildPhoneSvg(opts: PhoneSvgOpts): string {
  const { intrinsic: i, screen: s, metal, rim, bezel, button, camera } = opts;
  const { W, H, outerR, rimWidth, blackR } = layers(i, s);
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
${defs(W, H, s, metal)}
${frameLayers(W, H, outerR, rimWidth, blackR, rim, bezel)}
  <circle cx="${camCx}" cy="${camCy}" r="${camR}" fill="${camera}"/>
  <rect x="${btnX}" y="${pwrY}" width="${btnW}" height="${pwrH}" rx="5" fill="${button}"/>
  <rect x="${btnX}" y="${volY}" width="${btnW}" height="${volH}" rx="5" fill="${button}"/>
</svg>
`;
}

/** Tablet-style SVG: metal frame + black bezel, no side buttons, pill front camera centred above the screen. */
export function buildTabletSvg(opts: TabletSvgOpts): string {
  const { intrinsic: i, screen: s, metal, rim, bezel, camera } = opts;
  const { W, H, outerR, rimWidth, blackR } = layers(i, s);
  const pillW = Math.round(W * 0.06);
  const pillH = Math.max(6, Math.round(W * 0.008));
  const pillX = Math.round((W - pillW) / 2);
  const pillY = Math.max(pillH, Math.round(s.y * 0.5) - Math.round(pillH / 2));
  const pillR = pillH / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${defs(W, H, s, metal)}
${frameLayers(W, H, outerR, rimWidth, blackR, rim, bezel)}
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillR}" ry="${pillR}" fill="${camera}"/>
</svg>
`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frames-svg-builder.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
```
Expected: clean (note `generate.ts` still references the OLD colorway fields — typecheck will FAIL here). If typecheck fails only inside `generate.ts`, that's expected and fixed in Task 5; commit the builder + test now using a no-verify-free commit (do NOT use --no-verify; just commit, there is no pre-commit hook):

```bash
git add src/frames/_build/svg.ts tests/frames-svg-builder.test.ts
git commit -m "feat(frames): layered metal + black-bezel SVG builders"
```

> Note: leave `npm run typecheck` red until Task 5 updates `generate.ts`. The Vitest suite for `svg.ts` is green independently because the test imports `svg.ts` directly, not `generate.ts`.

---

## Task 5: Colorway constants + re-tuned/expanded FRAMES spec + regenerate

**Files:**
- Modify: `src/frames/_build/generate.ts`
- Test: `tests/frames-geometry.test.ts` (new), plus existing `tests/frames-structural.test.ts` (auto)

- [ ] **Step 1: Write the failing geometry test**

Create `tests/frames-geometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadManifest } from '../src/frames/load.js';

// Exact AOSP-derived geometry (committed into generate.ts). Guards against drift.
const EXPECTED: Record<string, { intrinsic: [number, number]; screen: [number, number, number, number, number] }> = {
  'pixel-9':        { intrinsic: [1198, 2531], screen: [55, 58, 1080, 2424, 87] },
  'pixel-9-pro':    { intrinsic: [1408, 2974], screen: [60, 61, 1280, 2856, 109] },
  'pixel-9-pro-xl': { intrinsic: [1466, 3101], screen: [57, 56, 1344, 2992, 108] },
  'pixel-9a':       { intrinsic: [1224, 2570], screen: [69, 73, 1080, 2424, 87] },
  'pixel-8':        { intrinsic: [1187, 2513], screen: [49, 55, 1080, 2400, 86] },
  'pixel-8-pro':    { intrinsic: [1469, 3104], screen: [58, 58, 1344, 2992, 108] },
  'pixel-7':        { intrinsic: [1200, 2541], screen: [59, 58, 1080, 2400, 86] },
  'pixel-7-pro':    { intrinsic: [1547, 3272], screen: [48, 66, 1440, 3120, 115] },
  'pixel-6':        { intrinsic: [1209, 2553], screen: [60, 69, 1080, 2400, 86] },
  'pixel-6-pro':    { intrinsic: [1527, 3289], screen: [41, 72, 1440, 3120, 115] },
  'pixel-tablet':   { intrinsic: [1837, 2798], screen: [117, 119, 1600, 2560, 48] },
};

describe('AOSP-derived frame geometry', () => {
  for (const [id, exp] of Object.entries(EXPECTED)) {
    it(`${id} matches the committed AOSP geometry`, async () => {
      const m = await loadManifest(id);
      expect([m.intrinsic.width, m.intrinsic.height]).toEqual(exp.intrinsic);
      expect([m.screen.x, m.screen.y, m.screen.width, m.screen.height, m.screen.radius]).toEqual(exp.screen);
      expect(m.license).toBe('Apache-2.0');
      expect(m.source).toMatch(/AOSP emulator skin/);
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/frames-geometry.test.ts`
Expected: FAIL — current on-disk manifests still have the old geometry (e.g. pixel-9 800×1700) and no `license`/`source`.

- [ ] **Step 3: Rewrite colorway constants to the new shape**

In `src/frames/_build/generate.ts`, replace the `PhoneColorway`/`TabletColorway` interfaces and every colorway constant. New interfaces:

```ts
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
```

Replace the constants (metal gradients brighter than the old body so the rim/bevel reads as metal; `bezel` near-black):

```ts
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
```

- [ ] **Step 4: Add `source`/`license` to the spec interfaces and `writeFrame`**

In `src/frames/_build/generate.ts`, add to BOTH `PhoneSpec` and `TabletSpec` interfaces:

```ts
  license: string;
  source?: string;
```

In `writeFrame`, extend the `manifest` object literal (after `...(spec.shadow ? ...)`):

```ts
    ...(spec.source ? { source: spec.source } : {}),
    license: spec.license,
```

- [ ] **Step 5: Re-tune the Pixel 9 family + tablet, and add the 6/7/8 family**

Replace the `FRAMES` array entries. Re-tuned/derived phones use exact AOSP numbers; generics keep their geometry but gain `license: 'MIT'`. Full array:

```ts
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
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean (the builder `...cw` spread now matches the new `PhoneSvgOpts`/`TabletSvgOpts`).

- [ ] **Step 7: Regenerate all frames**

Run: `npm run frames:build`
Expected: `✓ pixel-9 (...)` lines for all 14 frames, ending `Generated 14 frame(s) ...`. This rewrites every `manifest.json` + `<color>.svg` and creates the 6 new frame dirs.

- [ ] **Step 8: Run the geometry + structural tests**

Run: `npx vitest run tests/frames-geometry.test.ts tests/frames-structural.test.ts`
Expected: PASS (geometry matches; every regenerated/new frame is structurally valid, viewBox matches intrinsic, no rasters/remote refs).

- [ ] **Step 9: Commit**

```bash
git add src/frames/_build/generate.ts tests/frames-geometry.test.ts src/frames/
git commit -m "feat(frames): re-tune Pixel 9 family + tablet to AOSP geometry, add Pixel 6/7/8, layered look"
```

---

## Task 6: Full verification + render spot-check + docs

**Files:**
- Modify: `CLAUDE.md` (frame count / catalog note), `README.md` (frame list if it enumerates frames)

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all tests PASS (existing render/CLI tests + new ones). Note: `tests/frames-list.test.ts` and the `cli.m2.smoke` "frames list" test both use **subset** assertions (each expected id must be present; they do not assert an exact count or reject extras), so the 6 new frames require **no changes** to them. The sorted-order assertion in `frames-list.test.ts` still holds because `listFrames()` returns ids sorted.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Render spot-check (manual, real Chromium)**

Render a couple of frames via the existing `frame-only` catalog approach (or a temp config) and visually confirm the metal rim + black bezel + screen layering looks right on `pixel-9` and one new device (e.g. `pixel-7`). Example using the CLI from a scratch dir:

```bash
# from a throwaway dir with a config referencing frame: { id: 'pixel-9' } / { id: 'pixel-7' }
npx tsx <repo>/src/cli.ts generate
```
Expected: the screenshot fills the screen cutout; a thin metal rim with a lighter highlight surrounds a black bezel margin; corners are concentric.

- [ ] **Step 4: Update docs if the user-facing surface changed**

In `CLAUDE.md`, update the frame count in the module map / "How to add a device frame" section (it says "8 built-in frames"; it is now 14). If `README.md` enumerates the frame catalog, add the new Pixel 6/7/8 entries. Keep wording about clean-room SVGs but add that geometry for Google devices is AOSP-derived (Apache-2.0).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update frame catalog (14 frames) and AOSP geometry provenance"
```

---

## Notes for the implementer

- **Do not** add a top-level `import { chromium } from 'playwright'` anywhere (see CLAUDE.md gotcha #1). This plan touches no render code.
- The `extract-aosp.ts` tool needs the local Android SDK; it is **not** part of CI and the committed geometry is the source of truth. Tests never run it.
- `generate.ts` executes `main()` on import (it's a script) — never `import` it from a test. Geometry tests assert against the on-disk manifests via `loadManifest` instead.
- `RIM_RATIO = 0.35` lives once in `svg.ts`. To re-tune the metal/black split later, change it there (or promote it to a per-colorway field in a follow-up).
- Keep `npm run typecheck` green at every commit **except** the explicitly-noted intermediate state at the end of Task 4 (resolved in Task 5).
