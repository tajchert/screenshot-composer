# webp Device Frames (AOSP skins) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the clean-room SVG device frames with the real AOSP emulator-skin webp images (`back.webp` + `mask.webp` + layout geometry), composited under the screenshot.

**Architecture:** An offline import tool copies each skin's two webp files and parses its `layout` into a `manifest.json`; the renderer composites the screenshot `<img>` (clipped to the screen rect with `border-radius`) under the frame `back.webp` (`<img>` overlay, embedded as a base64 data-URI). The SVG builder/generator and the invented generic frames are removed.

**Tech Stack:** TypeScript (ESM via tsx), Zod, Vitest, `sharp` (webp metadata in tests), Playwright (render tests). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-29-webp-device-frames-design.md`

> **Intentional red window:** Tasks 1–4 leave `npm run typecheck` RED (the model is mid-swap — `frame-import.ts` references the new `image`/`mask` manifest fields from Task 1, and `generate.ts`/`svg.ts`/`load.ts` reference the old `colors`/`files` until they're removed/updated). It returns fully green at the end of **Task 5 Step 6**. Each of Tasks 1–4 is still verifiable by its own unit test / sanity check, noted per task. Because of this multi-task red window, **inline execution is recommended** over subagent-driven for this plan.

---

## File Structure

- `src/frames/_build/frame-import.ts` — **create** — pure helpers: `skinToId`, `skinDisplayName`, `buildFrameManifest`.
- `src/frames/_build/import-aosp.ts` — **create** — offline CLI shell: read SDK, copy webp, write manifest. (Replaces `extract-aosp.ts`.)
- `src/frames/_build/extract-aosp.ts` — **delete**.
- `src/frames/_build/aosp-layout.ts` — **keep** (reused unchanged).
- `src/frames/_build/svg.ts` — **delete**.
- `src/frames/_build/generate.ts` — **delete**.
- `src/frames/schema.ts` — **modify** — `image`/`mask` fields; remove `colors`/`files`.
- `src/frames/load.ts` — **modify** — `loadFrame` → data-URIs; `listFrameInfos` no colors.
- `src/frames/<id>/` — **replace** — `manifest.json` + `back.webp` + `mask.webp` for 21 Pixel frames; delete all `*.svg` and the 3 `generic-*` dirs.
- `src/templates/types.ts` — **modify** — `frame.svg` → `frame.image` + `frame.mask?`.
- `src/templates/shared.ts` — **modify** — `deviceMarkup` raster compositing.
- `src/render/compose.ts` — **modify** — pass image/mask data-URIs.
- `package.json` — **modify** — scripts: drop `frames:build`/`frames:extract`, add `frames:import`.
- `NOTICE`, `CLAUDE.md`, `README.md` — **modify** — docs.
- Tests: `frames-import.test.ts` (new), `frames-schema.test.ts`, `frames-structural.test.ts`, `frames-geometry.test.ts`, `frames.test.ts`, `frames-list.test.ts`, `shared.test.ts`, `cli.m2.smoke.test.ts`, `renderSlot.test.ts` — modify/rewrite; `frames-svg-builder.test.ts` — **delete**.

---

## Task 1: Import tool (pure helpers + CLI)

**Files:**
- Create: `src/frames/_build/frame-import.ts`, `src/frames/_build/import-aosp.ts`, `tests/frames-import.test.ts`
- Delete: `src/frames/_build/extract-aosp.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test** — `tests/frames-import.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { skinToId, skinDisplayName, buildFrameManifest } from '../src/frames/_build/frame-import.js';

describe('frame-import helpers', () => {
  it('maps skin ids to frame ids', () => {
    expect(skinToId('pixel_9')).toBe('pixel-9');
    expect(skinToId('pixel_9_pro_xl')).toBe('pixel-9-pro-xl');
    expect(skinToId('pixel_tablet')).toBe('pixel-tablet');
  });

  it('derives display names (Pro/XL casing)', () => {
    expect(skinDisplayName('pixel_9')).toBe('Pixel 9');
    expect(skinDisplayName('pixel_9_pro_xl')).toBe('Pixel 9 Pro XL');
    expect(skinDisplayName('pixel_9a')).toBe('Pixel 9a');
    expect(skinDisplayName('pixel_tablet')).toBe('Pixel Tablet');
  });

  it('builds a manifest from parsed geometry, applying the radius fallback', () => {
    const geo = { display: { width: 1080, height: 2400 }, cornerRadius: null,
                  frame: { width: 1200, height: 2541 }, offset: { x: 59, y: 58 } };
    const m = buildFrameManifest('pixel_7', geo);
    expect(m).toEqual({
      id: 'pixel-7', displayName: 'Pixel 7', manufacturer: 'Google',
      intrinsic: { width: 1200, height: 2541 },
      screen: { x: 59, y: 58, width: 1080, height: 2400, radius: Math.round(0.08 * 1080) },
      image: 'back.webp', mask: 'mask.webp',
      source: 'AOSP emulator skin pixel_7', license: 'Apache-2.0',
    });
  });

  it('uses the layout corner radius when present', () => {
    const geo = { display: { width: 1080, height: 2424 }, cornerRadius: 87,
                  frame: { width: 1198, height: 2531 }, offset: { x: 55, y: 58 } };
    expect(buildFrameManifest('pixel_9', geo).screen.radius).toBe(87);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run tests/frames-import.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/frames/_build/frame-import.ts`**

```ts
import type { AospGeometry } from './aosp-layout.js';
import type { FrameManifest } from '../schema.js';

export function skinToId(skin: string): string {
  return skin.replaceAll('_', '-');
}

export function skinDisplayName(skin: string): string {
  return skin
    .split('_')
    .map((t) => (t === 'xl' ? 'XL' : t === 'pro' ? 'Pro' : t.charAt(0).toUpperCase() + t.slice(1)))
    .join(' ');
}

/** Pure: build a manifest object from a skin id + parsed layout geometry. */
export function buildFrameManifest(skin: string, geo: AospGeometry): FrameManifest {
  const radius = geo.cornerRadius ?? Math.round(0.08 * geo.display.width);
  return {
    id: skinToId(skin),
    displayName: skinDisplayName(skin),
    manufacturer: 'Google',
    intrinsic: { width: geo.frame.width, height: geo.frame.height },
    screen: { x: geo.offset.x, y: geo.offset.y, width: geo.display.width, height: geo.display.height, radius },
    image: 'back.webp',
    mask: 'mask.webp',
    source: `AOSP emulator skin ${skin}`,
    license: 'Apache-2.0',
  };
}
```

> Note: this references `FrameManifest` fields `image`/`mask` that the schema gains in Task 2. Until then `frame-import.ts` typechecks against the OLD `FrameManifest` and will show 2 errors (`image`/`mask` not assignable). That is part of the Task 2–4 red window. The UNIT TEST (Step 2/4) does not depend on the schema type, so it passes. Proceed.

- [ ] **Step 4: Run to verify it passes**
Run: `npx vitest run tests/frames-import.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the CLI shell `src/frames/_build/import-aosp.ts`**

```ts
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { parseAospLayout } from './aosp-layout.js';
import { buildFrameManifest, skinToId } from './frame-import.js';

const SDK = process.env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk');
const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const skins = process.argv.slice(2);
if (skins.length === 0) {
  console.error('Usage: npm run frames:import -- pixel_9 pixel_8 ...');
  process.exit(1);
}

for (const skin of skins) {
  const skinDir = path.join(SDK, 'skins', skin);
  const geo = parseAospLayout(readFileSync(path.join(skinDir, 'layout'), 'utf8'));
  const manifest = buildFrameManifest(skin, geo);
  const outDir = path.join(FRAMES_DIR, skinToId(skin));
  mkdirSync(outDir, { recursive: true });
  copyFileSync(path.join(skinDir, 'back.webp'), path.join(outDir, 'back.webp'));
  copyFileSync(path.join(skinDir, 'mask.webp'), path.join(outDir, 'mask.webp'));
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.error(`✓ ${manifest.id}  (${manifest.intrinsic.width}x${manifest.intrinsic.height})`);
}
console.error(`Imported ${skins.length} frame(s) from ${SDK}`);
```

- [ ] **Step 6: Delete the old extractor + update scripts**
Run: `rm src/frames/_build/extract-aosp.ts`
In `package.json` `scripts`, remove `"frames:build"` and `"frames:extract"`, add:
```json
    "frames:import": "tsx src/frames/_build/import-aosp.ts"
```

- [ ] **Step 7: Commit**
```bash
git add src/frames/_build/frame-import.ts src/frames/_build/import-aosp.ts tests/frames-import.test.ts package.json
git rm src/frames/_build/extract-aosp.ts
git commit -m "feat(frames): AOSP webp import tool (pure helpers + CLI), replace extract-aosp"
```

---

## Task 2: Manifest schema — image/mask, drop colors/files

**Files:** Modify `src/frames/schema.ts`; rewrite `tests/frames-schema.test.ts`.

> After this task `npm run typecheck` is RED across `generate.ts`/`svg.ts`/`load.ts`/`frame-import.ts` (they reference removed/added fields). Expected — closed in Task 5. The schema test itself is green.

- [ ] **Step 1: Rewrite `tests/frames-schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { FrameManifestSchema } from '../src/frames/schema.js';

const valid = {
  id: 'pixel-9',
  displayName: 'Pixel 9',
  manufacturer: 'Google',
  intrinsic: { width: 1198, height: 2531 },
  screen: { x: 55, y: 58, width: 1080, height: 2424, radius: 87 },
  image: 'back.webp',
  mask: 'mask.webp',
  source: 'AOSP emulator skin pixel_9',
  license: 'Apache-2.0',
};

describe('FrameManifestSchema', () => {
  it('accepts a well-formed webp manifest', () => {
    expect(FrameManifestSchema.safeParse(valid).success).toBe(true);
  });

  it('requires image', () => {
    const { image: _i, ...noImage } = valid;
    expect(FrameManifestSchema.safeParse(noImage).success).toBe(false);
  });

  it('makes mask optional', () => {
    const { mask: _m, ...noMask } = valid;
    expect(FrameManifestSchema.safeParse(noMask).success).toBe(true);
  });

  it('rejects a screen rect exceeding intrinsic bounds', () => {
    const bad = { ...valid, screen: { ...valid.screen, x: 200, width: 1198 } };
    const r = FrameManifestSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join(' ')).toMatch(/screen/);
  });

  it('rejects non-positive intrinsic dimensions', () => {
    expect(FrameManifestSchema.safeParse({ ...valid, intrinsic: { width: 0, height: 10 } }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run tests/frames-schema.test.ts`
Expected: FAIL — schema still has `colors`/`files`, no `image`.

- [ ] **Step 3: Edit `src/frames/schema.ts`** — replace the object passed to `FrameManifestSchema` so it has `image`/`mask` and NO `colors`/`files`. The full new schema body:

```ts
export const FrameManifestSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    manufacturer: z.string().min(1),
    intrinsic: intrinsicSchema,
    screen: screenSchema,
    shadow: shadowSchema.optional(),
    image: z.string().min(1),
    mask: z.string().min(1).optional(),
    // Optional provenance; the import tool always sets license (Apache-2.0).
    source: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.screen.x + m.screen.width > m.intrinsic.width) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['screen'],
        message: `screen rect exceeds intrinsic width (${m.screen.x}+${m.screen.width} > ${m.intrinsic.width})` });
    }
    if (m.screen.y + m.screen.height > m.intrinsic.height) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['screen'],
        message: `screen rect exceeds intrinsic height (${m.screen.y}+${m.screen.height} > ${m.intrinsic.height})` });
    }
  });
```

Keep the existing `intrinsicSchema`/`screenSchema`/`shadowSchema` definitions and the `export type FrameManifest = z.infer<typeof FrameManifestSchema>;` line. Delete the old `colors`/`files` fields and the colors↔files refine loop.

- [ ] **Step 4: Run schema test to verify it passes**
Run: `npx vitest run tests/frames-schema.test.ts`
Expected: PASS (5 tests). (Whole-suite typecheck is red — expected, see task header.)

- [ ] **Step 5: Commit**
```bash
git add src/frames/schema.ts tests/frames-schema.test.ts
git commit -m "feat(frames): manifest schema uses image/mask, drops colors/files"
```

---

## Task 3: Import the 21 frames + delete SVG assets/code

**Files:** Run import (writes `src/frames/<id>/` ×21); delete `src/frames/_build/svg.ts`, `src/frames/_build/generate.ts`, all `*.svg`, the 3 `generic-*` dirs, `tests/frames-svg-builder.test.ts`.

> Still in the red window (loader/render/types not yet updated). Verified here by a manifest-load sanity check.

- [ ] **Step 1: Import all 21 standard-trio Pixel skins**
Run:
```bash
npm run frames:import -- pixel_4 pixel_4_xl pixel_4a pixel_5 pixel_6 pixel_6_pro pixel_6a \
  pixel_7 pixel_7_pro pixel_7a pixel_8 pixel_8_pro pixel_8a pixel_9 pixel_9_pro pixel_9_pro_xl \
  pixel_9a pixel_10 pixel_10_pro pixel_10_pro_xl pixel_tablet
```
Expected: 21 `✓ <id> (WxH)` lines, ending `Imported 21 frame(s) ...`. Each `src/frames/<id>/` now has `back.webp` + `mask.webp` + a new-style `manifest.json`.

- [ ] **Step 2: Delete the SVG frames, builder, and generator**
```bash
rm src/frames/_build/svg.ts src/frames/_build/generate.ts
rm tests/frames-svg-builder.test.ts
rm -rf src/frames/generic-android src/frames/generic-tablet-7 src/frames/generic-tablet-10
find src/frames -name '*.svg' -delete
```

- [ ] **Step 3: Sanity-check that every frame manifest loads & validates**
Run:
```bash
npx tsx -e "import('./src/frames/load.ts').then(async m => { const ids = await m.listFrames(); for (const id of ids) await m.loadManifest(id); console.log(ids.length, 'frames OK:', ids.join(', ')); })"
```
Expected: `21 frames OK: pixel-10, pixel-10-pro, ... pixel-tablet` (no validation throw). (`loadManifest` doesn't read svgs, so it works despite the red window.)

- [ ] **Step 4: Confirm no SVGs / generic frames remain**
Run: `find src/frames -name '*.svg' | wc -l && ls src/frames | grep -c generic || true`
Expected: `0` svgs; no `generic-*` dirs.

- [ ] **Step 5: Commit (binary assets + deletions)**
```bash
git add -A src/frames tests/frames-svg-builder.test.ts
git status --short            # sanity: new webp/manifests added, *.svg + svg.ts + generate.ts + generic dirs deleted
git commit -m "feat(frames): import 21 AOSP webp frames; remove SVG assets, builder, generator, generic frames"
```
(`git add -A <pathspec>` stages additions, modifications, AND deletions under those paths. Verify with `git show --stat HEAD | tail -20` that the 21 `back.webp` + 21 `mask.webp` + 21 `manifest.json` are added and the svg files/dirs + `svg.ts` + `generate.ts` are deleted.)

---

## Task 4: Frame loader + template type → data-URIs

**Files:** Modify `src/frames/load.ts`, `src/templates/types.ts`; Test: `tests/frames.test.ts`.

> Still red until Task 5 finishes `deviceMarkup`/`compose`. After this task, `load.ts` and `types.ts` are on the new model; `shared.ts`/`compose.ts` are the remaining red spots.

- [ ] **Step 1: Rewrite `tests/frames.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loadFrame, listFrames } from '../src/frames/load.js';

describe('frames', () => {
  it('lists the built-in pixel-9 frame', async () => {
    expect(await listFrames()).toContain('pixel-9');
  });

  it('loads the pixel-9 manifest and frame image as a webp data-URI', async () => {
    const { manifest, imageDataUri, maskDataUri } = await loadFrame('pixel-9');
    expect(manifest.id).toBe('pixel-9');
    expect(manifest.intrinsic).toEqual({ width: 1198, height: 2531 });
    expect(imageDataUri.startsWith('data:image/webp;base64,')).toBe(true);
    expect(imageDataUri.length).toBeGreaterThan(100);
    expect(maskDataUri?.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('throws a clear error for an unknown frame', async () => {
    await expect(loadFrame('nope')).rejects.toThrow(/unknown frame/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run tests/frames.test.ts`
Expected: FAIL — `loadFrame` still returns `{ svg }` and reads `files`.

- [ ] **Step 3: Rewrite `loadFrame` + `listFrameInfos` in `src/frames/load.ts`**

Replace `loadFrame` and `FrameInfo`/`listFrameInfos` (keep `listFrames`/`loadManifest`/`FRAMES_DIR` as-is):

```ts
export async function loadFrame(
  id: string,
): Promise<{ manifest: FrameManifest; imageDataUri: string; maskDataUri?: string }> {
  const manifest = await loadManifest(id);
  const dir = path.join(FRAMES_DIR, id);
  const toDataUri = async (file: string) =>
    `data:image/webp;base64,${(await fs.readFile(path.join(dir, file))).toString('base64')}`;
  const imageDataUri = await toDataUri(manifest.image);
  const maskDataUri = manifest.mask ? await toDataUri(manifest.mask) : undefined;
  return { manifest, imageDataUri, maskDataUri };
}

export interface FrameInfo {
  id: string;
  displayName: string;
}

export async function listFrameInfos(): Promise<FrameInfo[]> {
  const ids = await listFrames();
  const infos: FrameInfo[] = [];
  for (const id of ids) {
    const manifest = await loadManifest(id);
    infos.push({ id, displayName: manifest.displayName });
  }
  return infos;
}
```

Also update the `loadManifest` not-found error to throw `Unknown frame: '${id}'` (it already does) so the test's `/unknown frame/i` matches — confirm the existing message is `Unknown frame: '${id}'` (it is). No change needed there.

- [ ] **Step 4: Update `src/templates/types.ts`** — change the `frame` shape in `TemplateProps`:

```ts
  frame: {
    intrinsic: { width: number; height: number };
    screen: { x: number; y: number; width: number; height: number; radius: number };
    image: string; // webp data-URI of back.webp
    mask?: string; // webp data-URI of mask.webp (optional)
  };
```

- [ ] **Step 5: Run the frames test**
Run: `npx vitest run tests/frames.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**
```bash
git add src/frames/load.ts src/templates/types.ts tests/frames.test.ts
git commit -m "feat(frames): loadFrame returns webp data-URIs; frame template type uses image/mask"
```

---

## Task 5: Render pipeline (raster compositing) — back to green

**Files:** Modify `src/templates/shared.ts`, `src/render/compose.ts`; rewrite `tests/shared.test.ts`, `tests/frames-structural.test.ts`, `tests/frames-geometry.test.ts`, `tests/frames-list.test.ts`; update `tests/cli.m2.smoke.test.ts`, `tests/renderSlot.test.ts`.

- [ ] **Step 1: Rewrite the `deviceMarkup` test in `tests/shared.test.ts`**

Update the `frame` fixture and the two `deviceMarkup` tests. Replace the fixture near the top:

```ts
const frame: TemplateProps['frame'] = {
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  image: 'data:image/webp;base64,AAAA',
};
```

Replace the existing `deviceMarkup` test(s) (the "emits device markup…" and the "forces the frame svg…" tests) with:

```ts
  it('emits device markup: screenshot img + frame image overlay (no inline svg)', () => {
    const m = computeDevice(frame, 1000);
    const html = deviceMarkup('/input/en-US/phone/a.png', frame, m, 'none');
    expect(html).toContain('/input/en-US/phone/a.png');           // screenshot
    expect(html).toContain('data:image/webp;base64,AAAA');         // frame overlay
    expect(html).toContain('object-fit:cover');
    expect(html).toContain('border-radius:');
    expect(html).not.toContain('<svg');                            // no inline svg anymore
  });
```

(Keep the other tests in the file: escapeHtml, backgroundCss, computeDevice, deviceTransform, readyScript.)

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run tests/shared.test.ts`
Expected: FAIL — `deviceMarkup` still emits `frame.svg`.

- [ ] **Step 3: Rewrite `deviceMarkup` in `src/templates/shared.ts`**

Replace the whole `deviceMarkup` function with:

```ts
export function deviceMarkup(
  screenshotUrl: string,
  frame: TemplateProps['frame'],
  m: DeviceMetrics,
  transform: string,
): string {
  // The screenshot sits behind the frame image, clipped to the screen rect with the
  // device's corner radius. The frame back.webp (transparent screen hole) overlays on top
  // and fills the device box, so it scales with the screenshot at any resolution.
  return `<div style="position:relative;width:${m.deviceWidth}px;height:${m.deviceHeight}px;transform:${transform};transform-origin:center center;">
      <img style="position:absolute;left:${m.screenLeft}%;top:${m.screenTop}%;width:${m.screenW}%;height:${m.screenH}%;object-fit:cover;border-radius:${m.screenRadius}px;" src="${escapeHtml(screenshotUrl)}" alt="">
      <img style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;" src="${frame.image}" alt="">
    </div>`;
}
```

(The `frame.image` is a data-URI — no escaping needed; base64 has no HTML-special chars.)

- [ ] **Step 4: Run shared test to verify it passes**
Run: `npx vitest run tests/shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `src/render/compose.ts`** — load the frame as data-URIs and pass them.

Change the frame load + the `template.render({...})` frame field:

```ts
  const { manifest, imageDataUri, maskDataUri } = await loadFrame(slot.frame.id);
```
and
```ts
    frame: { intrinsic: manifest.intrinsic, screen: manifest.screen, image: imageDataUri, mask: maskDataUri },
```
(Remove the old `const { manifest, svg } = await loadFrame(...)` and the `svg` usage. `slot.frame.color` is no longer passed — `loadFrame` takes only `id`.)

- [ ] **Step 6: Run typecheck — expect CLEAN now**
Run: `npm run typecheck`
Expected: clean (the red window closes here). If anything is still red, it points at a missed reference to `.svg`/`colors`/`files`/`loadFrame(color)` — fix that file.

- [ ] **Step 7: Rewrite `tests/frames-structural.test.ts`** (webp validity, not svg)

```ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { listFrames, loadManifest } from '../src/frames/load.js';

const FRAMES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/frames');

describe('every frame on disk is structurally valid (webp)', () => {
  it('discovers all 21 frames', async () => {
    expect((await listFrames()).length).toBe(21);
  });

  it('each frame: manifest validates; back.webp matches intrinsic; mask.webp present if declared', async () => {
    for (const id of await listFrames()) {
      const m = await loadManifest(id);
      expect(m.screen.x + m.screen.width).toBeLessThanOrEqual(m.intrinsic.width);
      expect(m.screen.y + m.screen.height).toBeLessThanOrEqual(m.intrinsic.height);

      const imgPath = path.join(FRAMES_DIR, id, m.image);
      expect(existsSync(imgPath), `${id}/${m.image}`).toBe(true);
      const meta = await sharp(imgPath).metadata();
      expect(meta.format, `${id} image format`).toBe('webp');
      expect([meta.width, meta.height], `${id} image size = intrinsic`).toEqual([m.intrinsic.width, m.intrinsic.height]);

      if (m.mask) {
        const maskPath = path.join(FRAMES_DIR, id, m.mask);
        expect(existsSync(maskPath), `${id}/${m.mask}`).toBe(true);
        expect((await sharp(maskPath).metadata()).format).toBe('webp');
      }
    }
  });
});
```

- [ ] **Step 8: Rewrite the geometry guard `tests/frames-geometry.test.ts`** (representative subset)

```ts
import { describe, it, expect } from 'vitest';
import { loadManifest } from '../src/frames/load.js';

const EXPECTED: Record<string, { intrinsic: [number, number]; screen: [number, number, number, number, number] }> = {
  'pixel-9':         { intrinsic: [1198, 2531], screen: [55, 58, 1080, 2424, 87] },
  'pixel-10-pro-xl': { intrinsic: [1466, 3101], screen: [60, 55, 1344, 2992, 108] },
  'pixel-tablet':    { intrinsic: [2798, 1837], screen: [119, 117, 2560, 1600, 205] },
};

describe('AOSP-derived frame geometry (representative)', () => {
  for (const [id, exp] of Object.entries(EXPECTED)) {
    it(`${id} matches the imported AOSP geometry`, async () => {
      const m = await loadManifest(id);
      expect([m.intrinsic.width, m.intrinsic.height]).toEqual(exp.intrinsic);
      expect([m.screen.x, m.screen.y, m.screen.width, m.screen.height, m.screen.radius]).toEqual(exp.screen);
      expect(m.license).toBe('Apache-2.0');
      expect(m.source).toMatch(/AOSP emulator skin/);
    });
  }
});
```

- [ ] **Step 9: Rewrite `tests/frames-list.test.ts`** (no colors)

```ts
import { describe, it, expect } from 'vitest';
import { listFrameInfos } from '../src/frames/load.js';

describe('listFrameInfos', () => {
  it('lists frames with display names (subset present)', async () => {
    const byId = new Map((await listFrameInfos()).map((i) => [i.id, i.displayName]));
    expect(byId.get('pixel-9')).toBe('Pixel 9');
    expect(byId.get('pixel-9-pro-xl')).toBe('Pixel 9 Pro XL');
    expect(byId.get('pixel-tablet')).toBe('Pixel Tablet');
  });

  it('returns ids in stable sorted order', async () => {
    const ids = (await listFrameInfos()).map((i) => i.id);
    expect(ids).toEqual([...ids].sort());
  });
});
```

- [ ] **Step 10: Fix frame ids in `tests/cli.m2.smoke.test.ts` and `tests/renderSlot.test.ts`**

In `cli.m2.smoke.test.ts`, the "frames list prints every built-in frame" test lists ids including `generic-android`, `generic-tablet-7`, `generic-tablet-10`, `pixel-tablet` — replace that array with ids that still exist:
```ts
    for (const id of ['pixel-9', 'pixel-9-pro', 'pixel-8', 'pixel-7', 'pixel-6', 'pixel-tablet']) {
```

In `renderSlot.test.ts`, any slot using `generic-android` must change to an existing frame (e.g. `pixel-7`). Grep first: `grep -n "generic-android\|generic-tablet" tests/renderSlot.test.ts`. Replace each `generic-android` frame id with `pixel-7` (and `generic-tablet-*` with `pixel-tablet` if present). Leave the rest of those tests unchanged.

- [ ] **Step 11: Run the full suite + typecheck**
Run: `npm test` then `npm run typecheck`
Expected: ALL pass, typecheck clean. If `generate.test.ts` (renders the init sample, frame `pixel-9`) fails, confirm it's not referencing a deleted frame; `pixel-9` still exists so it should pass.

- [ ] **Step 12: Commit**
```bash
git add src/templates/shared.ts src/render/compose.ts tests/
git commit -m "feat(frames): raster-composite webp frames in deviceMarkup; update tests to webp model"
```

---

## Task 6: Licensing + docs + final verification

**Files:** Modify `NOTICE`, `CLAUDE.md`, `README.md`.

- [ ] **Step 1: Reword `NOTICE`** — replace the "geometry derived" paragraph with:

```text
This product includes device-frame images (back.webp and mask.webp) and their
geometry from the Android Open Source Project emulator device skins
(https://source.android.com/), licensed under the Apache License, Version 2.0.
Those images are redistributed unmodified under src/frames/. See LICENSE-APACHE
for the full Apache-2.0 text.
```
(Keep the top two lines — product name + copyright — and the AOSP attribution line.)

- [ ] **Step 2: Update `CLAUDE.md`**
  (a) Scope-boundary sentence (~line 17-20): replace the clean-room-SVG clause with: `... we *consume* screenshots and never *capture* them, device frames are the AOSP emulator device images (back.webp/mask.webp) redistributed under Apache-2.0 and composited under the screenshot (project is MIT; see NOTICE/LICENSE-APACHE).`
  (b) Module-map: change the `src/frames/<id>/` row to `manifest.json + back.webp + mask.webp per device (21 AOSP webp frames)`. **Delete** the `src/frames/_build/svg.ts` and `src/frames/_build/generate.ts` rows; add a row: `src/frames/_build/import-aosp.ts | Offline importer: copy skin webp + parse layout → manifest (npm run frames:import)`.
  (c) "How to add a device frame" section: replace the SVG-generator steps with: a device is added by importing its AOSP skin — `npm run frames:import -- <skin>` (needs the local Android SDK) copies `back.webp`/`mask.webp` and writes the manifest from the skin's `layout`; the committed webp + manifest are the source of truth. `listFrames()` auto-discovers any dir with a `manifest.json`; `tests/frames-structural.test.ts` validates every frame.
  (d) Leave the "Milestones 1–4 complete" line unchanged.

- [ ] **Step 3: Update `README.md`** — Roadmap device-frames line (~line 184): update its description to `**Device frames** — Pixel 4–10 families + Pixel Tablet, from AOSP emulator skins (Apache-2.0).` Do NOT change its ⏳/✅ marker. Do not touch the `## License` section.

- [ ] **Step 4: Final verification**
Run: `npm test` (all pass) and `npm run typecheck` (clean). Report counts.

- [ ] **Step 5: Render spot-check (manual)** — render `pixel-9` frame-only on white AND a real screenshot in a tilted `pixel-9` frame; confirm: screenshot fills the screen, corners are clean (no square-corner bleed at the rounded display edges), bezel/buttons look right. **If corner bleed appears**, add `mask.webp` as a third overlay `<img>` in `deviceMarkup` (after the frame image: `<img ... src="${frame.mask}">` guarded by `frame.mask`) and re-verify; commit that as a follow-up. Otherwise no change.

- [ ] **Step 6: Commit**
```bash
git add NOTICE CLAUDE.md README.md
git commit -m "docs: webp AOSP device frames — NOTICE (bundled images), CLAUDE, README"
```

---

## Notes for the implementer

- **Do not** add a top-level `import { chromium } from 'playwright'` (CLAUDE.md gotcha #1). This plan doesn't touch render-browser code.
- `import-aosp.ts`/`aosp-layout.ts` need the local Android SDK; they are NOT in CI. The committed webp + manifests are the source of truth; tests never run the importer.
- The `sandbox/` directory is an untracked demo with a project-local `frame-only` template that references the OLD `frame.svg`; it is OUT OF SCOPE for this plan and will need a separate refresh afterward. Do not let sandbox break any committed test (no test reads sandbox).
- Red window spans Tasks 2–4; typecheck returns clean at Task 5 Step 6. Each of Tasks 1–4 is independently verified by the unit test / sanity check noted in it.
- `pixel-tablet` is landscape-native (intrinsic 2798×1837); it is a catalogued asset `generate` can't render yet (phone-only). That's expected.
