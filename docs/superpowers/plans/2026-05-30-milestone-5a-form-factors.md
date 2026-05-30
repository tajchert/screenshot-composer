# Milestone 5a — Form factors + tablet frames + orientation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all three Google Play form factors renderable — phone, 7" tablet, 10" tablet — with `deviceScaleFactor` upscaling and a per-slot, per-form-factor orientation model, so the existing `pixel-tablet` frame finally renders.

**Architecture:** A new pure helper `src/render/target.ts` resolves `(slot, format) → {width, height, scale, orientation}` from a fixed table, applying sensible per-form-factor orientation defaults plus optional per-slot overrides. `compose` and `renderSlot` both consume it so the logical viewport (template authoring size) and the Playwright viewport never drift; tablet10 upscales ×2 via `deviceScaleFactor`. Frames composite in their native orientation — the orientation field only sets the output canvas dimensions, so no frame-rotation code is needed.

**Tech Stack:** TypeScript (ESM, `.js`-pointing imports), Zod (config schema), Playwright/Chromium (render), Sharp (constraints), Vitest (tests, real Chromium for render tests).

**Spec:** `docs/superpowers/specs/2026-05-29-milestone-5a-form-factors-design.md`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/config/schema.ts` | Config Zod schema + types | Add `OrientationEnum`, `Orientation` type, and `orientation` field on `SlotSchema`. |
| `src/render/constraints.ts` | Dimension table + 8 MB enforcement | `resolveDimensions(format, orientation?)` returns the full 6-row table; remove the phone-only throw. |
| `src/render/target.ts` *(new)* | Resolve a render target for a slot+format | `DEFAULT_ORIENTATION`, `resolveOrientation`, `resolveRenderTarget`. |
| `src/render/compose.ts` | Build slot HTML | Use `resolveRenderTarget(slot, format)` for `width`/`height`. |
| `src/render/server.ts` | `/render` + `/input` server | Expose `config` read-only on `RenderServer`. |
| `src/render/renderSlot.ts` | Navigate + screenshot | Resolve slot via `server.config`, size viewport from `resolveRenderTarget`. |
| `tests/schema.test.ts` | Schema unit tests | Add orientation accept/reject cases. |
| `tests/constraints.test.ts` | Dimension unit tests | Replace the "throws" test with the full table. |
| `tests/target.test.ts` *(new)* | target helper unit tests | Defaults + overrides. |
| `tests/tablet-render.test.ts` *(new)* | tablet render integration | Real Chromium tablet renders. |
| `tests/generate.tablet.test.ts` *(new)* | generate multi-form-factor | End-to-end `runGenerate` to phone + tablet10. |
| `CLAUDE.md`, `README.md` | Docs | Reflect tablets now render. |

**TDD note:** `src/config/schema.ts` exports `Orientation`; `constraints.ts` and `target.ts` import it from there. Build order respects deps: schema → constraints → target → compose/server/renderSlot → integration → docs.

---

## Task 1: Orientation in the config schema

**Files:**
- Modify: `src/config/schema.ts`
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these two `it` blocks inside the existing `describe('ConfigSchema', ...)` in `tests/schema.test.ts`:

```ts
  it('accepts a per-form-factor orientation override on a slot', () => {
    const cfg = structuredClone(valid);
    (cfg.slots[0] as any).orientation = { tablet10: 'portrait' };
    const res = ConfigSchema.safeParse(cfg);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.slots[0].orientation).toEqual({ tablet10: 'portrait' });
    }
  });

  it('rejects an invalid orientation value', () => {
    const bad = structuredClone(valid);
    (bad.slots[0] as any).orientation = { phone: 'sideways' };
    const res = ConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path.join('.')).toContain('slots.0.orientation.phone');
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL — the override test fails because `orientation` is stripped (undefined, not `{ tablet10: 'portrait' }`), and the reject test fails because the unknown value is currently ignored rather than rejected.

- [ ] **Step 3: Add the orientation schema**

In `src/config/schema.ts`, add the enum + type just after the `FormFactor` definition (near the top):

```ts
export const OrientationEnum = z.enum(['portrait', 'landscape']);
export type Orientation = z.infer<typeof OrientationEnum>;
```

Then add the `orientation` field to `SlotSchema`. The current `SlotSchema` is:

```ts
const SlotSchema = z.object({
  id: z.string(),
  template: z.string(),
  screenshot: z.string(),
  frame: FrameRefSchema,
  layout: LayoutSchema.default({}),
  copy: z.record(z.string(), z.record(z.string(), z.string())),
});
```

Insert the `orientation` field after `layout`:

```ts
const SlotSchema = z.object({
  id: z.string(),
  template: z.string(),
  screenshot: z.string(),
  frame: FrameRefSchema,
  layout: LayoutSchema.default({}),
  orientation: z
    .object({
      phone: OrientationEnum.optional(),
      tablet7: OrientationEnum.optional(),
      tablet10: OrientationEnum.optional(),
    })
    .optional(),
  copy: z.record(z.string(), z.record(z.string(), z.string())),
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS (all schema tests, including the two new ones).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors).

- [ ] **Step 6: Commit**

```bash
git add src/config/schema.ts tests/schema.test.ts
git commit -m "feat(schema): per-slot per-form-factor orientation field"
```

---

## Task 2: Full dimension table in `resolveDimensions`

**Files:**
- Modify: `src/render/constraints.ts`
- Test: `tests/constraints.test.ts`

- [ ] **Step 1: Rewrite the `resolveDimensions` tests**

Replace the entire `describe('resolveDimensions', ...)` block in `tests/constraints.test.ts` (currently the phone + "throws" cases) with the full table:

```ts
describe('resolveDimensions', () => {
  it('phone portrait (default) is 1080x1920 @1x', () => {
    expect(resolveDimensions('phone')).toEqual({ width: 1080, height: 1920, scale: 1 });
    expect(resolveDimensions('phone', 'portrait')).toEqual({ width: 1080, height: 1920, scale: 1 });
  });
  it('phone landscape is 1920x1080 @1x', () => {
    expect(resolveDimensions('phone', 'landscape')).toEqual({ width: 1920, height: 1080, scale: 1 });
  });
  it('tablet7 landscape is 1920x1200 @1x; portrait is 1200x1920 @1x', () => {
    expect(resolveDimensions('tablet7', 'landscape')).toEqual({ width: 1920, height: 1200, scale: 1 });
    expect(resolveDimensions('tablet7', 'portrait')).toEqual({ width: 1200, height: 1920, scale: 1 });
  });
  it('tablet10 landscape is 1920x1080 @2x; portrait is 1080x1920 @2x', () => {
    expect(resolveDimensions('tablet10', 'landscape')).toEqual({ width: 1920, height: 1080, scale: 2 });
    expect(resolveDimensions('tablet10', 'portrait')).toEqual({ width: 1080, height: 1920, scale: 2 });
  });
});
```

(Leave the `describe('enforceConstraints', ...)` block untouched.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/constraints.test.ts`
Expected: FAIL — `resolveDimensions('phone', 'landscape')` and all tablet cases throw "not supported yet" / produce wrong values.

- [ ] **Step 3: Implement the full table**

In `src/render/constraints.ts`, change the import line and replace `resolveDimensions`. The current top of the file is:

```ts
import sharp from 'sharp';
import type { FormFactorT } from '../config/schema.js';
import { ConstraintError } from '../errors.js';

export interface Dimensions {
  width: number;
  height: number;
  scale: number;
}

export function resolveDimensions(format: FormFactorT): Dimensions {
  if (format === 'phone') return { width: 1080, height: 1920, scale: 1 };
  throw new Error(`Form factor '${format}' is not supported yet (Milestone 5). Use 'phone'.`);
}
```

Replace it with:

```ts
import sharp from 'sharp';
import type { FormFactorT, Orientation } from '../config/schema.js';
import { ConstraintError } from '../errors.js';

export interface Dimensions {
  width: number;
  height: number;
  scale: number;
}

/**
 * Logical viewport (template authoring size) + deviceScaleFactor for each
 * (form factor, orientation). Logical × scale = the exported pixel size, which
 * stays within Google Play's 320–7680 side range and 16:9 / 9:16 aspect rules.
 */
export function resolveDimensions(format: FormFactorT, orientation: Orientation = 'portrait'): Dimensions {
  const portrait = orientation === 'portrait';
  switch (format) {
    case 'phone':
      return portrait ? { width: 1080, height: 1920, scale: 1 } : { width: 1920, height: 1080, scale: 1 };
    case 'tablet7':
      return portrait ? { width: 1200, height: 1920, scale: 1 } : { width: 1920, height: 1200, scale: 1 };
    case 'tablet10':
      return portrait ? { width: 1080, height: 1920, scale: 2 } : { width: 1920, height: 1080, scale: 2 };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/constraints.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean. (Existing `resolveDimensions(format)` call sites in `compose.ts`/`renderSlot.ts` still compile — `orientation` defaults to `'portrait'`, and for phone that is the existing behavior.)

- [ ] **Step 6: Commit**

```bash
git add src/render/constraints.ts tests/constraints.test.ts
git commit -m "feat(render): resolveDimensions covers all form factors x orientation"
```

---

## Task 3: `resolveRenderTarget` helper

**Files:**
- Create: `src/render/target.ts`
- Test: `tests/target.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/target.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Slot } from '../src/config/schema.js';
import { resolveOrientation, resolveRenderTarget, DEFAULT_ORIENTATION } from '../src/render/target.js';

// Minimal Slot stub; only fields the target helper reads matter.
function slot(orientation?: Slot['orientation']): Slot {
  return {
    id: 's',
    template: 'bold-headline',
    screenshot: 'x.png',
    frame: { id: 'pixel-9' },
    layout: { tilt: { x: 0, y: 0, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 },
    orientation,
    copy: {},
  } as Slot;
}

describe('DEFAULT_ORIENTATION', () => {
  it('phone is portrait, tablets are landscape', () => {
    expect(DEFAULT_ORIENTATION).toEqual({ phone: 'portrait', tablet7: 'landscape', tablet10: 'landscape' });
  });
});

describe('resolveOrientation', () => {
  it('falls back to the per-form-factor default when unset', () => {
    expect(resolveOrientation(slot(), 'phone')).toBe('portrait');
    expect(resolveOrientation(slot(), 'tablet10')).toBe('landscape');
  });
  it('honors a per-form-factor override', () => {
    expect(resolveOrientation(slot({ tablet10: 'portrait' }), 'tablet10')).toBe('portrait');
    // An override for one factor does not affect others.
    expect(resolveOrientation(slot({ tablet10: 'portrait' }), 'phone')).toBe('portrait');
    expect(resolveOrientation(slot({ phone: 'landscape' }), 'phone')).toBe('landscape');
  });
});

describe('resolveRenderTarget', () => {
  it('tablet10 default = landscape 1920x1080 @2x', () => {
    expect(resolveRenderTarget(slot(), 'tablet10')).toEqual({
      width: 1920, height: 1080, scale: 2, orientation: 'landscape',
    });
  });
  it('tablet7 portrait override = 1200x1920 @1x', () => {
    expect(resolveRenderTarget(slot({ tablet7: 'portrait' }), 'tablet7')).toEqual({
      width: 1200, height: 1920, scale: 1, orientation: 'portrait',
    });
  });
  it('phone default = portrait 1080x1920 @1x', () => {
    expect(resolveRenderTarget(slot(), 'phone')).toEqual({
      width: 1080, height: 1920, scale: 1, orientation: 'portrait',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/target.test.ts`
Expected: FAIL — `src/render/target.js` does not exist (import error).

- [ ] **Step 3: Implement `src/render/target.ts`**

```ts
import type { FormFactorT, Orientation, Slot } from '../config/schema.js';
import { resolveDimensions, type Dimensions } from './constraints.js';

/** Default orientation per form factor: phones portrait, tablets landscape. */
export const DEFAULT_ORIENTATION: Record<FormFactorT, Orientation> = {
  phone: 'portrait',
  tablet7: 'landscape',
  tablet10: 'landscape',
};

/** A slot's per-form-factor override wins; otherwise the form-factor default. */
export function resolveOrientation(slot: Slot, format: FormFactorT): Orientation {
  return slot.orientation?.[format] ?? DEFAULT_ORIENTATION[format];
}

export interface RenderTarget extends Dimensions {
  orientation: Orientation;
}

/** Logical viewport + deviceScaleFactor + resolved orientation for a slot+format. */
export function resolveRenderTarget(slot: Slot, format: FormFactorT): RenderTarget {
  const orientation = resolveOrientation(slot, format);
  const { width, height, scale } = resolveDimensions(format, orientation);
  return { width, height, scale, orientation };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/target.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/render/target.ts tests/target.test.ts
git commit -m "feat(render): resolveRenderTarget (orientation defaults + overrides)"
```

---

## Task 4: Wire `compose` to use the render target

**Files:**
- Modify: `src/render/compose.ts`

No new test here — Task 6/7 exercise the behavior end-to-end, and the phone path is covered by existing tests (this task must not regress them).

- [ ] **Step 1: Update `compose.ts`**

The current file imports and uses `resolveDimensions`:

```ts
import { resolveDimensions } from './constraints.js';
```
```ts
  const { width, height } = resolveDimensions(ref.format);
```

Change the import to `target.js` and pass the slot:

```ts
import { resolveRenderTarget } from './target.js';
```
```ts
  const { width, height } = resolveRenderTarget(slot, ref.format);
```

(`slot` is already resolved earlier in `composeSlotHtml` via `config.slots.find(...)`. Leave the rest of the file unchanged.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. (`resolveDimensions` is no longer imported in this file.)

- [ ] **Step 3: Run the phone render tests to confirm no regression**

Run: `npx vitest run tests/renderSlot.test.ts`
Expected: PASS (all 7 phone renders still 1080×1920). This proves the compose change is behavior-preserving for phone.

- [ ] **Step 4: Commit**

```bash
git add src/render/compose.ts
git commit -m "refactor(render): compose sizes via resolveRenderTarget"
```

---

## Task 5: Expose `config` on the server; size the viewport in `renderSlot`

**Files:**
- Modify: `src/render/server.ts`
- Modify: `src/render/renderSlot.ts`

- [ ] **Step 1: Expose `config` on `RenderServer`**

In `src/render/server.ts`, the current interface is:

```ts
export interface RenderServer {
  url: string;
  port: number;
  close(): Promise<void>;
}
```

Add the config field:

```ts
export interface RenderServer {
  url: string;
  port: number;
  config: Config;
  close(): Promise<void>;
}
```

Then add `config` to the returned object. The current return is:

```ts
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
```

Change to:

```ts
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    config,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
```

(`Config` is already imported at the top of `server.ts`.)

- [ ] **Step 2: Size the viewport from the resolved target in `renderSlot`**

In `src/render/renderSlot.ts`, the current top + body start is:

```ts
import { getBrowser } from './browser.js';
import { resolveDimensions, enforceConstraints } from './constraints.js';
import { RenderError } from '../errors.js';

export async function renderSlot(
  server: RenderServer,
  slotId: string,
  locale: string,
  format: FormFactorT,
): Promise<Buffer> {
  const { width, height, scale } = resolveDimensions(format);
  const browser = await getBrowser();
```

Change the imports and the dimension resolution:

```ts
import { getBrowser } from './browser.js';
import { enforceConstraints } from './constraints.js';
import { resolveRenderTarget } from './target.js';
import { RenderError } from '../errors.js';

export async function renderSlot(
  server: RenderServer,
  slotId: string,
  locale: string,
  format: FormFactorT,
): Promise<Buffer> {
  const slot = server.config.slots.find((s) => s.id === slotId);
  if (!slot) throw new RenderError(`No slot with id '${slotId}' in config`);
  const { width, height, scale } = resolveRenderTarget(slot, format);
  const browser = await getBrowser();
```

(Leave the rest of `renderSlot` — context creation using `width`/`height`/`scale`, navigation, readiness, screenshot — unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Run the phone render + generate tests to confirm no regression**

Run: `npx vitest run tests/renderSlot.test.ts tests/generate.test.ts`
Expected: PASS — viewport sizing is unchanged for phone (orientation defaults to portrait → 1080×1920 @1x), and `server.config` is now populated.

- [ ] **Step 5: Commit**

```bash
git add src/render/server.ts src/render/renderSlot.ts
git commit -m "feat(render): renderSlot sizes viewport per slot orientation via server.config"
```

---

## Task 6: Integration — render tablet form factors

**Files:**
- Create: `tests/tablet-render.test.ts`

This test launches real Chromium (like `renderSlot.test.ts`). It renders the landscape-native `pixel-tablet` frame to `tablet10` (default landscape, ×2 → 3840×2160) and a `tablet7` portrait override (1200×1920).

- [ ] **Step 1: Write the failing test**

Create `tests/tablet-render.test.ts`:

```ts
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
    expect(buf.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
  }, 180_000);
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/tablet-render.test.ts`
Expected: PASS. (If it fails, the failure is real — investigate before proceeding; do not weaken assertions.)

- [ ] **Step 3: Commit**

```bash
git add tests/tablet-render.test.ts
git commit -m "test(render): tablet form factors render at correct dimensions"
```

---

## Task 7: Integration — `generate` writes multiple form factors

**Files:**
- Create: `tests/generate.tablet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/generate.tablet.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { runGenerate } from '../src/commands/generate.js';
import { closeBrowser } from '../src/render/browser.js';
import { projectPaths } from '../src/paths.js';

let root: string;

const CONFIG = `import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone', 'tablet10'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'solid', color: '#101418' },
  },
  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'shot.png',
      frame: { id: 'pixel-9' },
      copy: { headline: { 'en-US': 'Hello' } },
    },
  ],
});
`;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-gen-tablet-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await sharp({ create: { width: 1080, height: 2280, channels: 3, background: '#22aa55' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'shot.png'));
  await fs.mkdir(path.join(p.inputs, 'en-US', 'tablet10'), { recursive: true });
  await sharp({ create: { width: 2560, height: 1600, channels: 3, background: '#22aa55' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'tablet10', 'shot.png'));
  await fs.writeFile(p.config, CONFIG, 'utf8');
}, 180_000);

afterAll(async () => { await closeBrowser(); });

describe('runGenerate (multi form factor)', () => {
  it('writes both a phone and a tablet10 output with correct dimensions', async () => {
    await runGenerate(root, {});
    const p = projectPaths(root);

    const phone = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const pMeta = await sharp(phone).metadata();
    expect(pMeta.width).toBe(1080);
    expect(pMeta.height).toBe(1920);

    const tablet = path.join(p.outputs, 'en-US', 'tablet10', '01-onboarding.png');
    const tMeta = await sharp(tablet).metadata();
    expect(tMeta.width).toBe(3840);
    expect(tMeta.height).toBe(2160);
    const stat = await fs.stat(tablet);
    expect(stat.size).toBeLessThanOrEqual(8 * 1024 * 1024);
  }, 180_000);
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/generate.tablet.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS (all prior tests + the new tablet tests).

- [ ] **Step 4: Commit**

```bash
git add tests/generate.tablet.test.ts
git commit -m "test(generate): renders phone + tablet10 end-to-end"
```

---

## Task 8: Update docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: CLAUDE.md — module map line**

Replace (line ~96):

```
| `src/render/constraints.ts` | `resolveDimensions()` (phone only today), `enforceConstraints()`, `extFor()` |
```

with:

```
| `src/render/constraints.ts` | `resolveDimensions(format, orientation)` (all form factors), `enforceConstraints()`, `extFor()` |
```

- [ ] **Step 2: CLAUDE.md — add the `target.ts` module map row**

Immediately after the `src/render/constraints.ts` row, add:

```
| `src/render/target.ts` | `resolveRenderTarget(slot, format)` → logical viewport + DSF + orientation (defaults + per-slot overrides) |
```

- [ ] **Step 3: CLAUDE.md — tablet/frame note**

Replace (lines ~161–162):

```
Tablet frames are catalogued but `resolveDimensions` is phone-only until Milestone 5; until
then they ship as validated assets that `frames list` shows but `generate` cannot render.
```

with:

```
Tablet frames render as of Milestone 5a. The frame composites in its native orientation (the
landscape `pixel-tablet` stays landscape); a slot's `orientation` map only sets the output
canvas, so a tablet slot's screenshot must match the frame's screen aspect (a landscape
screenshot for the landscape tablet frame), placed under `inputs/{locale}/{tablet7|tablet10}/`.
```

- [ ] **Step 4: CLAUDE.md — current-state line**

Replace (lines ~201–205):

```
deferred items). Current state: **Milestones 1–4 complete**, plus **Milestone 7 (partial):
npm + Homebrew distribution** (build pipeline + manual release; see `RELEASING.md` and
`docs/superpowers/specs/2026-05-29-track-b-distribution-design.md`). Remaining: **Milestone 5
(form factors, theming, tilt)**, M6 (caching, Fastlane import), and M7's CI-automated
releases + Docker.
```

with:

```
deferred items). Current state: **Milestones 1–4 complete**, **Milestone 5a complete** (all
form factors + tablet frames + per-slot orientation), plus **Milestone 7 (partial): npm +
Homebrew distribution** (build pipeline + manual release; see `RELEASING.md` and
`docs/superpowers/specs/2026-05-29-track-b-distribution-design.md`). Remaining: **Milestone 5b
(bundled fonts, RTL, text-fit)**, M6 (caching, Fastlane import), and M7's CI-automated
releases + Docker.
```

- [ ] **Step 5: README.md — intro line**

Replace (lines ~17–19, within the blockquote):

```
> AOSP device frames. Today it renders the **phone** form factor with **3 built-in
> templates** (`bold-headline`, `showcase`, `overlap`) and **19 device frames** (Pixel 4a/5,
> the Pixel 6–10 families, and Pixel Tablet). Tablets, full i18n fonts, caching, a visual
```

with:

```
> AOSP device frames. Today it renders **all three form factors** (phone, 7" and 10" tablet)
> with **3 built-in templates** (`bold-headline`, `showcase`, `overlap`) and **19 device
> frames** (Pixel 4a/5, the Pixel 6–10 families, and Pixel Tablet). Full i18n fonts, caching, a visual
```

- [ ] **Step 6: README.md — config comment**

Replace (line ~107):

```
  formFactors: ['phone'],        // only 'phone' is renderable today
```

with:

```
  formFactors: ['phone', 'tablet10'],  // 'phone' | 'tablet7' | 'tablet10'
```

- [ ] **Step 7: README.md — export-size + limitations**

Replace (line ~168):

```
The current phone export is **1080×1920**. You upload the files to Play yourself.
```

with:

```
Exports: phone 1080×1920, 7" tablet 1920×1200, 10" tablet 3840×2160 (defaults; tablets
default to landscape). Set a slot's `orientation` map to override per form factor, e.g.
`orientation: { tablet10: 'portrait' }`. You upload the files to Play yourself.
```

Replace the "Phone only" limitation (lines ~172–173):

```
- **Phone only.** The config schema accepts `tablet7`/`tablet10`, but rendering them is not
  implemented yet — `generate` will error. Use `['phone']`.
```

with:

```
- **Tablet screenshots must be landscape.** The `pixel-tablet` frame is landscape-native, so
  provide landscape-shaped screenshots under `inputs/{locale}/{tablet7,tablet10}/`. A
  portrait-native tablet frame is a future asset.
```

- [ ] **Step 8: README.md — roadmap line**

Replace (line ~189):

```
5. ⏳ **All form factors + i18n + theming + tilt** — tablets, bundled fonts, RTL, text-fit.
```

with:

```
5. 🚧 **Form factors + i18n + theming + tilt** — ✅ 5a: tablets + per-slot orientation; ⏳ 5b: bundled fonts, RTL, text-fit.
```

- [ ] **Step 9: Verify docs build/typecheck unaffected and commit**

Run: `npm run typecheck`
Expected: clean (docs-only change, sanity check).

```bash
git add CLAUDE.md README.md
git commit -m "docs: Milestone 5a — tablets render, orientation model"
```

---

## Final verification

- [ ] **Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass (including the two new integration files), typecheck clean.

- [ ] **Manual smoke (optional but recommended):** generate a tablet in a temp project and eyeball the PNG dimensions:

```bash
# from the worktree root, against a temp project you set up with init + a tablet10 input
npm run cli -- generate --format tablet10
```
Expected: writes `outputs/<locale>/tablet10/<slot>.png` at 3840×2160.

---

## Notes / out of scope (→ Milestone 5b)

- Headline text sizing is still fixed-px per template; it may look small at tablet/landscape
  aspects. **Auto shrink-to-fit** is 5b — 5a only guarantees correct, non-overflowing dims.
- Bundled fonts (Inter + Manrope + Geist) and RTL (`dir` from locale + logical CSS) are 5b.
- Portrait-native tablet frame assets are a future addition; 5a composites frames in their
  native orientation only.
