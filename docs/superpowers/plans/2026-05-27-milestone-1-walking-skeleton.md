# Milestone 1: Walking Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the thinnest end-to-end slice of `screenshot-composer`: `init` scaffolds a `play-screenshots/` workspace with a sample config and a synthesized sample screenshot, and `generate` renders one built-in template wrapped in one Pixel 9 frame to a phone PNG that satisfies Google Play's constraints.

**Architecture:** A single TypeScript npm package. The CLI (Commander) loads a Zod-validated TypeScript config via `jiti`. `generate` starts a minimal Node `http` server that serves a composition HTML page (`/render`) and the raw input screenshots (`/input/...`); Playwright (Chromium, auto-installed under `~/.screenshot-composer/chromium`) navigates to `/render`, waits for fonts+images+a `__READY__` signal, screenshots at the target `deviceScaleFactor`, and Sharp enforces the 8 MB ceiling before the bytes are written to `outputs/`. **Deliberate deviation from the spec:** the skeleton serves an HTML-string template instead of React+Tailwind+Vite SSR (spec §3/§8). Vite/React is introduced in Milestone 3; the render route contract (`/render?slot=&locale=&format=`) is kept identical so the swap is localized.

**Tech Stack:** TypeScript, Node 20+ (dev on v26), Commander.js, Zod, jiti, Playwright (Chromium), Sharp. Tests: Vitest. CLI run in dev via `tsx`. No build step is required to develop or test this milestone (publishing/build is Milestone 7).

**Scope boundary:** phone form factor only; one template (`bold-headline`); one frame (`pixel-9`); no caching, no i18n font bundling, no tablets, no editor, no Fastlane import. Those arrive in later milestones. **ESLint config and a CI workflow are deferred** to Milestone 2/7 to keep this skeleton focused on proving the render pipeline; TypeScript strict mode + `tsc --noEmit` is the only static check here.

---

## File Structure

Created in this milestone (all paths relative to the repo root):

| File | Responsibility |
|---|---|
| `package.json` | Package metadata, deps, scripts, `bin` |
| `tsconfig.json` | TS compiler options (ESM, strict) |
| `vitest.config.ts` | Test runner config (node env, long timeout for Chromium) |
| `.gitignore` | Ignore `node_modules`, `dist` |
| `src/index.ts` | Public entry: exports `defineConfig` + config types |
| `src/paths.ts` | Resolve home dir (`~/.screenshot-composer`) and per-project paths |
| `src/errors.ts` | Typed error classes + `exitCodeFor()` mapping |
| `src/config/schema.ts` | Zod schema, inferred types, `defineConfig` |
| `src/config/load.ts` | Load `.config.ts` via jiti + validate |
| `src/render/constraints.ts` | `resolveDimensions()` + `enforceConstraints()` (8 MB) |
| `src/frames/load.ts` | Frame manifest + SVG loader |
| `src/frames/pixel-9/manifest.json` | Pixel 9 frame manifest |
| `src/frames/pixel-9/obsidian.svg` | Clean-room Pixel 9 SVG |
| `src/templates/bold-headline/render.ts` | `renderHtml(props)` → composition HTML string |
| `src/render/compose.ts` | Build slot HTML + resolve input screenshot URL/path |
| `src/render/server.ts` | Minimal http server: `/render` + `/input/*` |
| `src/render/chromium.ts` | Ensure Chromium installed under home dir |
| `src/render/browser.ts` | Launch/cache/close a singleton Playwright browser |
| `src/render/renderSlot.ts` | Navigate, await readiness, screenshot, enforce constraints |
| `src/commands/generate.ts` | Orchestrate config → server → render → write outputs |
| `src/commands/init.ts` | Scaffold workspace, sample config, sample screenshot, `.gitignore` |
| `src/cli.ts` | Commander wiring + error→exit-code handling + `bin` shebang |
| `tests/fixtures/` | Fixture configs/projects used by tests |

---

## Task 1: Repo skeleton & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/index.ts`, `tests/sanity.test.ts`

- [ ] **Step 1: Write the sanity test**

`tests/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs typescript tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Write `package.json`**

`package.json`:
```json
{
  "name": "screenshot-composer",
  "version": "0.0.0",
  "description": "Compose Google Play Store screenshots from Android app screenshots",
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=20" },
  "bin": { "screenshot-composer": "dist/cli.js" },
  "main": "dist/index.js",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "cli": "tsx src/cli.ts"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "zod": "^3.23.8",
    "jiti": "^2.4.2",
    "sharp": "^0.33.5",
    "playwright": "^1.49.1",
    "execa": "^9.5.2"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "tsx": "^4.19.2",
    "vitest": "^2.1.8",
    "@types/node": "^22.10.2"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "verbatimModuleSyntax": false
  },
  "include": ["src", "tests"],
  "exclude": ["tests/fixtures"]
}
```

> **Import-extension note:** source and test imports use `.js` extensions that
> point at `.ts` files (idiomatic TS-ESM, matches the eventual NodeNext build).
> Both `tsx` and Vitest/Vite resolve `.js` specifiers to their `.ts` source, so
> no build step is needed. `tests/fixtures` is excluded from typecheck because
> those files import the bare specifier `screenshot-composer`, which only
> resolves at runtime via jiti's alias (Task 5).

- [ ] **Step 4: Write `vitest.config.ts` and `.gitignore` and entry stub**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 180_000, // first Chromium download + render
    hookTimeout: 180_000,
  },
});
```

`.gitignore`:
```
node_modules/
dist/
```

`src/index.ts` (filled in Task 4; stub for now):
```ts
export {};
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: dependencies install without errors; `node_modules/` created.

- [ ] **Step 6: Run the sanity test and typecheck**

Run: `npx vitest run tests/sanity.test.ts`
Expected: PASS (1 test).
Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore src/index.ts tests/sanity.test.ts package-lock.json
git commit -m "chore: scaffold screenshot-composer package skeleton"
```

---

## Task 2: Path resolution

**Files:**
- Create: `src/paths.ts`, `tests/paths.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/paths.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { HOME_DIR, CHROMIUM_DIR, projectPaths, WORKDIR_NAME } from '../src/paths.js';

describe('paths', () => {
  it('resolves the home cache dir under the user home', () => {
    expect(HOME_DIR).toBe(path.join(os.homedir(), '.screenshot-composer'));
    expect(CHROMIUM_DIR).toBe(path.join(HOME_DIR, 'chromium'));
  });

  it('resolves per-project paths under play-screenshots/', () => {
    const p = projectPaths('/repo');
    expect(WORKDIR_NAME).toBe('play-screenshots');
    expect(p.base).toBe('/repo/play-screenshots');
    expect(p.config).toBe('/repo/play-screenshots/screenshot-composer.config.ts');
    expect(p.inputs).toBe('/repo/play-screenshots/inputs');
    expect(p.outputs).toBe('/repo/play-screenshots/outputs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/paths.test.ts`
Expected: FAIL — cannot resolve `../src/paths.js`.

- [ ] **Step 3: Write the implementation**

`src/paths.ts`:
```ts
import os from 'node:os';
import path from 'node:path';

export const HOME_DIR = path.join(os.homedir(), '.screenshot-composer');
export const CHROMIUM_DIR = path.join(HOME_DIR, 'chromium');
export const FONTS_DIR = path.join(HOME_DIR, 'fonts');

export const WORKDIR_NAME = 'play-screenshots';

export interface ProjectPaths {
  base: string;
  config: string;
  inputs: string;
  outputs: string;
  templates: string;
  assets: string;
  cache: string;
  gitignore: string;
}

export function projectPaths(root: string): ProjectPaths {
  const base = path.join(root, WORKDIR_NAME);
  return {
    base,
    config: path.join(base, 'screenshot-composer.config.ts'),
    inputs: path.join(base, 'inputs'),
    outputs: path.join(base, 'outputs'),
    templates: path.join(base, 'templates'),
    assets: path.join(base, 'assets'),
    cache: path.join(base, '.cache'),
    gitignore: path.join(base, '.gitignore'),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/paths.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/paths.ts tests/paths.test.ts
git commit -m "feat: add path resolution for home and project dirs"
```

---

## Task 3: Typed errors and exit codes

**Files:**
- Create: `src/errors.ts`, `tests/errors.test.ts`

These map directly to the spec's exit-code contract: 1 config error, 2 missing input, 3 render failure, 4 constraint violation.

- [ ] **Step 1: Write the failing test**

`tests/errors.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  ConfigValidationError, MissingInputError, RenderError, ConstraintError, exitCodeFor,
} from '../src/errors.js';

describe('errors', () => {
  it('maps each error type to its documented exit code', () => {
    expect(exitCodeFor(new ConfigValidationError('cfg.ts', 'bad'))).toBe(1);
    expect(exitCodeFor(new MissingInputError('a.png'))).toBe(2);
    expect(exitCodeFor(new RenderError('boom'))).toBe(3);
    expect(exitCodeFor(new ConstraintError('too big'))).toBe(4);
  });

  it('maps unknown errors to exit code 3', () => {
    expect(exitCodeFor(new Error('???'))).toBe(3);
  });

  it('includes the file path in a config error message', () => {
    const e = new MissingInputError('inputs/en-US/phone/onboarding.png');
    expect(e.message).toContain('onboarding.png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/errors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/errors.ts`:
```ts
export class ConfigValidationError extends Error {
  constructor(public file: string, detail: string) {
    super(`Config error in ${file}\n  ${detail}`);
    this.name = 'ConfigValidationError';
  }
}

export class MissingInputError extends Error {
  constructor(public file: string) {
    super(`Missing input screenshot: ${file}`);
    this.name = 'MissingInputError';
  }
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
  }
}

export class ConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConstraintError';
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof ConfigValidationError) return 1;
  if (err instanceof MissingInputError) return 2;
  if (err instanceof ConstraintError) return 4;
  if (err instanceof RenderError) return 3;
  return 3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/errors.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts tests/errors.test.ts
git commit -m "feat: add typed errors and exit-code mapping"
```

---

## Task 4: Config schema and `defineConfig`

**Files:**
- Create: `src/config/schema.ts`, `tests/schema.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing test**

`tests/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../src/config/schema.js';

const valid = {
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },
  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9', color: 'obsidian' },
      copy: { headline: { 'en-US': 'Order in seconds' } },
    },
  ],
};

describe('ConfigSchema', () => {
  it('accepts a minimal valid config and applies defaults', () => {
    const parsed = ConfigSchema.parse(valid);
    expect(parsed.paths.inputs).toBe('./inputs');
    expect(parsed.slots[0].layout.tilt).toEqual({ x: 0, y: 0, z: 0 });
    expect(parsed.slots[0].layout.perspective).toBe(2000);
    expect(parsed.theme.fontFamily).toBe('system-ui');
  });

  it('rejects tilt outside [-45, 45]', () => {
    const bad = structuredClone(valid);
    (bad.slots[0] as any).layout = { tilt: { x: 0, y: -75, z: 0 } };
    const res = ConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path.join('.')).toContain('slots.0.layout.tilt.y');
    }
  });

  it('rejects more than 8 slots', () => {
    const bad = structuredClone(valid);
    bad.slots = Array.from({ length: 9 }, (_, i) => ({ ...valid.slots[0], id: `s${i}` }));
    expect(ConfigSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the schema**

`src/config/schema.ts`:
```ts
import { z } from 'zod';

export const FormFactor = z.enum(['phone', 'tablet7', 'tablet10']);
export type FormFactorT = z.infer<typeof FormFactor>;

const TiltSchema = z.object({
  x: z.number().min(-45).max(45),
  y: z.number().min(-45).max(45),
  z: z.number().min(-45).max(45),
});

const LayoutSchema = z.object({
  tilt: TiltSchema.default({ x: 0, y: 0, z: 0 }),
  translate: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  perspective: z.number().positive().default(2000),
});

const FrameRefSchema = z.object({
  id: z.string(),
  color: z.string().optional(),
});

const BackgroundSchema = z.object({
  type: z.enum(['solid', 'gradient']),
  color: z.string().optional(),
  direction: z.number().default(135),
  stops: z.array(z.string()).optional(),
});

const ThemeSchema = z.object({
  fontFamily: z.string().default('system-ui'),
  palette: z.object({ fg: z.string(), accent: z.string(), muted: z.string() }),
  background: BackgroundSchema,
});

const SlotSchema = z.object({
  id: z.string(),
  template: z.string(),
  screenshot: z.string(),
  frame: FrameRefSchema,
  layout: LayoutSchema.default({ tilt: { x: 0, y: 0, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 }),
  copy: z.record(z.string(), z.record(z.string(), z.string())),
});

const PathsSchema = z
  .object({
    inputs: z.string().default('./inputs'),
    outputs: z.string().default('./outputs'),
    templates: z.string().default('./templates'),
    assets: z.string().default('./assets'),
  })
  .default({ inputs: './inputs', outputs: './outputs', templates: './templates', assets: './assets' });

export const ConfigSchema = z.object({
  locales: z.array(z.string()).min(1),
  defaultLocale: z.string(),
  formFactors: z.array(FormFactor).min(1),
  paths: PathsSchema,
  theme: ThemeSchema,
  slots: z.array(SlotSchema).min(1).max(8),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type Theme = z.infer<typeof ThemeSchema>;

/** Identity helper that gives IDE autocomplete + type-checking in user config files. */
export function defineConfig(config: z.input<typeof ConfigSchema>): z.input<typeof ConfigSchema> {
  return config;
}
```

- [ ] **Step 4: Re-export from the package entry**

Replace `src/index.ts` with:
```ts
export { defineConfig, ConfigSchema } from './config/schema.js';
export type { Config, Slot, Theme, FormFactorT } from './config/schema.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/config/schema.ts src/index.ts tests/schema.test.ts
git commit -m "feat: add zod config schema and defineConfig helper"
```

---

## Task 5: Config loader via jiti

**Files:**
- Create: `src/config/load.ts`, `tests/fixtures/valid.config.ts`, `tests/fixtures/invalid.config.ts`, `tests/load.test.ts`

The loader aliases the bare specifier `screenshot-composer` to this package's own source entry so that a user config's `import { defineConfig } from 'screenshot-composer'` resolves even when running from source. **Note for Milestone 7:** the alias target is the `src/index.ts` source path here; the published build will resolve the same specifier through `node_modules`, and this alias becomes a harmless fallback.

- [ ] **Step 1: Write the fixtures**

`tests/fixtures/valid.config.ts`:
```ts
import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },
  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9', color: 'obsidian' },
      copy: { headline: { 'en-US': 'Order in seconds' } },
    },
  ],
});
```

`tests/fixtures/invalid.config.ts`:
```ts
import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', stops: ['#000'] },
  },
  // Intentionally invalid at runtime (not at type level): tilt.y is out of the
  // [-45, 45] range enforced by Zod. Caught by ConfigSchema.safeParse, not tsc.
  slots: [
    {
      id: '01',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9' },
      layout: { tilt: { x: 0, y: -75, z: 0 } },
      copy: { headline: { 'en-US': 'x' } },
    },
  ],
});
```

- [ ] **Step 2: Write the failing test**

`tests/load.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config/load.js';
import { ConfigValidationError } from '../src/errors.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('loadConfig', () => {
  it('loads and validates a TS config that imports defineConfig', async () => {
    const cfg = await loadConfig(path.join(here, 'fixtures/valid.config.ts'));
    expect(cfg.locales).toEqual(['en-US']);
    expect(cfg.slots[0].id).toBe('01-onboarding');
    expect(cfg.slots[0].layout.perspective).toBe(2000);
  });

  it('throws ConfigValidationError on invalid config', async () => {
    await expect(loadConfig(path.join(here, 'fixtures/invalid.config.ts')))
      .rejects.toBeInstanceOf(ConfigValidationError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/load.test.ts`
Expected: FAIL — `loadConfig` not found.

- [ ] **Step 4: Write the loader**

`src/config/load.ts`:
```ts
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { ConfigSchema, type Config } from './schema.js';
import { ConfigValidationError } from '../errors.js';

// In source/dev this resolves to src/index.ts; the published build resolves the
// specifier through node_modules and this alias is an unused fallback.
const SELF_ALIAS = fileURLToPath(new URL('../index.ts', import.meta.url));

export async function loadConfig(configPath: string): Promise<Config> {
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: { 'screenshot-composer': SELF_ALIAS },
  });

  let loaded: unknown;
  try {
    loaded = await jiti.import(configPath, { default: true });
  } catch (err) {
    throw new ConfigValidationError(configPath, (err as Error).message);
  }

  const result = ConfigSchema.safeParse(loaded);
  if (!result.success) {
    const first = result.error.issues[0];
    const loc = first ? first.path.join('.') : '(root)';
    throw new ConfigValidationError(configPath, `${loc}: ${first?.message ?? 'invalid config'}`);
  }
  return result.data;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/load.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/config/load.ts tests/fixtures/valid.config.ts tests/fixtures/invalid.config.ts tests/load.test.ts
git commit -m "feat: load and validate TypeScript config via jiti"
```

---

## Task 6: Dimensions and 8 MB constraint enforcement

**Files:**
- Create: `src/render/constraints.ts`, `tests/constraints.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/constraints.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { resolveDimensions, enforceConstraints } from '../src/render/constraints.js';
import { ConstraintError } from '../src/errors.js';

describe('resolveDimensions', () => {
  it('returns 1080x1920 @1x for phone', () => {
    expect(resolveDimensions('phone')).toEqual({ width: 1080, height: 1920, scale: 1 });
  });
  it('throws for unsupported form factors in this milestone', () => {
    expect(() => resolveDimensions('tablet10')).toThrow(/not supported yet/);
  });
});

describe('enforceConstraints', () => {
  it('returns the PNG unchanged when already under 8 MB', async () => {
    const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#fff' } })
      .png().toBuffer();
    const out = await enforceConstraints(png, '01');
    expect(out).toBe(png);
  });

  it('downgrades to JPEG when the PNG exceeds 8 MB', async () => {
    // Random noise PNG that will not compress below 8 MB.
    const pixels = Buffer.alloc(4000 * 4000 * 3);
    for (let i = 0; i < pixels.length; i++) pixels[i] = Math.floor(Math.random() * 256);
    const png = await sharp(pixels, { raw: { width: 4000, height: 4000, channels: 3 } }).png().toBuffer();
    expect(png.byteLength).toBeGreaterThan(8 * 1024 * 1024);
    const out = await enforceConstraints(png, '01');
    expect(out.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
    // JPEG magic bytes
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/constraints.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/render/constraints.ts`:
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

const MAX_BYTES = 8 * 1024 * 1024;

/** Returns the PNG unchanged if under 8 MB, else the smallest acceptable JPEG. */
export async function enforceConstraints(png: Buffer, slotId: string): Promise<Buffer> {
  if (png.byteLength <= MAX_BYTES) return png;
  for (const quality of [95, 90, 85, 80, 75]) {
    const jpeg = await sharp(png).jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
    if (jpeg.byteLength <= MAX_BYTES) return jpeg;
  }
  throw new ConstraintError(`Cannot fit output under 8 MB for slot ${slotId}`);
}

/** Returns the file extension matching a PNG or JPEG buffer. */
export function extFor(buf: Buffer): 'png' | 'jpg' {
  return buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg' : 'png';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/constraints.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/constraints.ts tests/constraints.test.ts
git commit -m "feat: add dimension resolution and 8 MB constraint enforcement"
```

---

## Task 7: Pixel 9 frame asset and loader

**Files:**
- Create: `src/frames/pixel-9/manifest.json`, `src/frames/pixel-9/obsidian.svg`, `src/frames/load.ts`, `tests/frames.test.ts`

- [ ] **Step 1: Write the manifest and SVG**

`src/frames/pixel-9/manifest.json`:
```json
{
  "id": "pixel-9",
  "displayName": "Pixel 9",
  "manufacturer": "Google",
  "colors": ["obsidian"],
  "intrinsic": { "width": 800, "height": 1700 },
  "screen": { "x": 28, "y": 30, "width": 744, "height": 1640, "radius": 44 },
  "shadow": { "x": 0, "y": 24, "blur": 64, "color": "rgba(0,0,0,0.18)" },
  "files": { "obsidian": "obsidian.svg" }
}
```

`src/frames/pixel-9/obsidian.svg` (clean-room redraw: rounded body, transparent screen cutout, camera, side buttons; `viewBox` matches `intrinsic`):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1700" width="800" height="1700">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b2b2f"/>
      <stop offset="1" stop-color="#0e0e10"/>
    </linearGradient>
    <mask id="screenHole">
      <rect x="0" y="0" width="800" height="1700" fill="#fff"/>
      <rect x="28" y="30" width="744" height="1640" rx="44" ry="44" fill="#000"/>
    </mask>
  </defs>
  <!-- side buttons -->
  <rect x="792" y="360" width="10" height="150" rx="5" fill="#1a1a1c"/>
  <rect x="792" y="560" width="10" height="90" rx="5" fill="#1a1a1c"/>
  <!-- body with screen cut out via mask -->
  <rect x="2" y="2" width="796" height="1696" rx="72" ry="72" fill="url(#body)" mask="url(#screenHole)"/>
  <!-- inner bezel ring -->
  <rect x="24" y="26" width="752" height="1648" rx="48" ry="48" fill="none" stroke="#000" stroke-width="6"/>
  <!-- front camera -->
  <circle cx="400" cy="60" r="11" fill="#070708"/>
</svg>
```

- [ ] **Step 2: Write the failing test**

`tests/frames.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadFrame, listFrames } from '../src/frames/load.js';

describe('frames', () => {
  it('lists the built-in pixel-9 frame', async () => {
    const ids = await listFrames();
    expect(ids).toContain('pixel-9');
  });

  it('loads the pixel-9 manifest and svg, defaulting the color', async () => {
    const { manifest, svg } = await loadFrame('pixel-9');
    expect(manifest.id).toBe('pixel-9');
    expect(manifest.screen.width).toBe(744);
    expect(manifest.intrinsic).toEqual({ width: 800, height: 1700 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 800 1700"');
  });

  it('throws a clear error for an unknown frame', async () => {
    await expect(loadFrame('nope')).rejects.toThrow(/unknown frame/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/frames.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the loader**

`src/frames/load.ts`:
```ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const FRAMES_DIR = path.dirname(fileURLToPath(import.meta.url));

export interface FrameManifest {
  id: string;
  displayName: string;
  manufacturer: string;
  colors: string[];
  intrinsic: { width: number; height: number };
  screen: { x: number; y: number; width: number; height: number; radius: number };
  shadow?: { x: number; y: number; blur: number; color: string };
  files: Record<string, string>;
}

export async function listFrames(): Promise<string[]> {
  const entries = await fs.readdir(FRAMES_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function loadFrame(
  id: string,
  color?: string,
): Promise<{ manifest: FrameManifest; svg: string; color: string }> {
  const dir = path.join(FRAMES_DIR, id);
  let raw: string;
  try {
    raw = await fs.readFile(path.join(dir, 'manifest.json'), 'utf8');
  } catch {
    throw new Error(`Unknown frame: '${id}'`);
  }
  const manifest = JSON.parse(raw) as FrameManifest;
  const chosen = color && manifest.files[color] ? color : manifest.colors[0];
  const svg = await fs.readFile(path.join(dir, manifest.files[chosen]), 'utf8');
  return { manifest, svg, color: chosen };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/frames.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/frames/pixel-9/manifest.json src/frames/pixel-9/obsidian.svg src/frames/load.ts tests/frames.test.ts
git commit -m "feat: add pixel-9 clean-room frame and frame loader"
```

---

## Task 8: `bold-headline` template (HTML string)

**Files:**
- Create: `src/templates/bold-headline/render.ts`, `tests/template.test.ts`

The template is a pure function: given resolved props it returns a full HTML document sized to the logical viewport, with the background, headline, tilted device, framed screenshot, and the `__READY__` readiness script.

- [ ] **Step 1: Write the failing test**

`tests/template.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderHtml, type TemplateProps } from '../src/templates/bold-headline/render.js';

const props: TemplateProps = {
  width: 1080,
  height: 1920,
  headline: 'Order in seconds',
  screenshotUrl: '/input/en-US/phone/onboarding.png',
  frame: {
    intrinsic: { width: 800, height: 1700 },
    screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
    svg: '<svg viewBox="0 0 800 1700"></svg>',
  },
  layout: { tilt: { x: 4, y: -18, z: 0 }, translate: { x: 0, y: 40 }, perspective: 2000 },
  theme: {
    fontFamily: 'system-ui',
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },
};

describe('bold-headline renderHtml', () => {
  it('embeds the headline, screenshot, frame svg and readiness signal', () => {
    const html = renderHtml(props);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Order in seconds');
    expect(html).toContain('/input/en-US/phone/onboarding.png');
    expect(html).toContain('viewBox="0 0 800 1700"');
    expect(html).toContain('__READY__');
    expect(html).toContain('width: 1080px');
    expect(html).toContain('height: 1920px');
  });

  it('applies the tilt transform from layout', () => {
    const html = renderHtml(props);
    expect(html).toContain('rotateX(4deg)');
    expect(html).toContain('rotateY(-18deg)');
    expect(html).toContain('perspective(2000px)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/template.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the template**

`src/templates/bold-headline/render.ts`:
```ts
export interface TemplateProps {
  width: number;
  height: number;
  headline: string;
  screenshotUrl: string;
  frame: {
    intrinsic: { width: number; height: number };
    screen: { x: number; y: number; width: number; height: number; radius: number };
    svg: string;
  };
  layout: {
    tilt: { x: number; y: number; z: number };
    translate: { x: number; y: number };
    perspective: number;
  };
  theme: {
    fontFamily: string;
    palette: { fg: string; accent: string; muted: string };
    background: { type: 'solid' | 'gradient'; color?: string; direction?: number; stops?: string[] };
  };
}

function backgroundCss(bg: TemplateProps['theme']['background']): string {
  if (bg.type === 'gradient' && bg.stops && bg.stops.length >= 2) {
    return `linear-gradient(${bg.direction ?? 135}deg, ${bg.stops.join(', ')})`;
  }
  return bg.color ?? '#111827';
}

export function renderHtml(props: TemplateProps): string {
  const { width, height, headline, screenshotUrl, frame, layout, theme } = props;
  const { intrinsic, screen } = frame;

  // Device occupies ~72% of canvas height; width derived from frame aspect.
  const deviceHeight = Math.round(height * 0.72);
  const deviceWidth = Math.round((deviceHeight * intrinsic.width) / intrinsic.height);

  // Screenshot placement as percentages of the device box (from the manifest).
  const screenLeft = (screen.x / intrinsic.width) * 100;
  const screenTop = (screen.y / intrinsic.height) * 100;
  const screenW = (screen.width / intrinsic.width) * 100;
  const screenH = (screen.height / intrinsic.height) * 100;
  const screenRadius = (screen.radius / intrinsic.width) * deviceWidth;

  const transform = `perspective(${layout.perspective}px) rotateX(${layout.tilt.x}deg) rotateY(${layout.tilt.y}deg) rotateZ(${layout.tilt.z}deg) translate(${layout.translate.x}px, ${layout.translate.y}px)`;

  return `<!DOCTYPE html>
<html dir="ltr">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; }
  body {
    font-family: ${theme.fontFamily}, system-ui, sans-serif;
    background: ${backgroundCss(theme.background)};
    color: ${theme.palette.fg};
    overflow: hidden;
    position: relative;
  }
  .headline {
    position: absolute; top: 0; left: 0; right: 0;
    padding: 96px 80px 0;
    text-align: center;
    font-size: 76px; font-weight: 800; line-height: 1.05;
    color: #ffffff;
  }
  .stage {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: ${Math.round(height * 0.74)}px;
    display: flex; align-items: flex-end; justify-content: center;
  }
  .device {
    position: relative;
    width: ${deviceWidth}px; height: ${deviceHeight}px;
    transform: ${transform};
    transform-origin: center center;
  }
  .device .screen {
    position: absolute;
    left: ${screenLeft}%; top: ${screenTop}%;
    width: ${screenW}%; height: ${screenH}%;
    object-fit: cover;
    border-radius: ${screenRadius}px;
  }
  .device .frame {
    position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none;
  }
</style>
</head>
<body>
  <div class="headline">${escapeHtml(headline)}</div>
  <div class="stage">
    <div class="device">
      <img class="screen" src="${screenshotUrl}" alt="">
      <div class="frame">${frame.svg}</div>
    </div>
  </div>
  <script>
    (async () => {
      await document.fonts.ready;
      const imgs = Array.from(document.images).filter((i) => !i.complete);
      await Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
      window.__READY__ = true;
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/template.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/templates/bold-headline/render.ts tests/template.test.ts
git commit -m "feat: add bold-headline HTML template"
```

---

## Task 9: Slot composition

**Files:**
- Create: `src/render/compose.ts`, `tests/compose.test.ts`

`composeSlotHtml` ties config + frame + template together, resolves the input screenshot's on-disk path and its server URL, and throws `MissingInputError` when the screenshot is absent.

- [ ] **Step 1: Write the failing test**

`tests/compose.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compose.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/render/compose.ts`:
```ts
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Config, FormFactorT } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { loadFrame } from '../frames/load.js';
import { renderHtml } from '../templates/bold-headline/render.js';
import { resolveDimensions } from './constraints.js';
import { MissingInputError, RenderError } from '../errors.js';

export interface SlotRef {
  slotId: string;
  locale: string;
  format: FormFactorT;
}

export function inputUrl(locale: string, format: string, file: string): string {
  return `/input/${locale}/${format}/${file}`;
}

export function inputFilePath(paths: ProjectPaths, locale: string, format: string, file: string): string {
  return path.join(paths.inputs, locale, format, file);
}

export async function composeSlotHtml(config: Config, paths: ProjectPaths, ref: SlotRef): Promise<string> {
  const slot = config.slots.find((s) => s.id === ref.slotId);
  if (!slot) throw new RenderError(`No slot with id '${ref.slotId}' in config`);

  // Skeleton ships only 'bold-headline'.
  if (slot.template !== 'bold-headline') {
    throw new RenderError(`Template '${slot.template}' is not available yet (Milestone 3). Use 'bold-headline'.`);
  }

  const filePath = inputFilePath(paths, ref.locale, ref.format, slot.screenshot);
  if (!existsSync(filePath)) throw new MissingInputError(filePath);

  const { width, height } = resolveDimensions(ref.format);
  const { manifest, svg } = await loadFrame(slot.frame.id, slot.frame.color);

  const headline = slot.copy.headline?.[ref.locale] ?? slot.copy.headline?.[config.defaultLocale] ?? '';

  return renderHtml({
    width,
    height,
    headline,
    screenshotUrl: inputUrl(ref.locale, ref.format, slot.screenshot),
    frame: { intrinsic: manifest.intrinsic, screen: manifest.screen, svg },
    layout: slot.layout,
    theme: config.theme,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/compose.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/compose.ts tests/compose.test.ts
git commit -m "feat: compose slot HTML from config, frame and template"
```

---

## Task 10: Render server

**Files:**
- Create: `src/render/server.ts`, `tests/server.test.ts`

Serves `/render?slot=&locale=&format=` (composition HTML) and `/input/<locale>/<format>/<file>` (raw screenshot bytes) on an ephemeral localhost port.

- [ ] **Step 1: Write the failing test**

`tests/server.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/render/server.ts`:
```ts
import http from 'node:http';
import path from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import type { Config, FormFactorT } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { composeSlotHtml } from './compose.js';
import { MissingInputError } from '../errors.js';

export interface RenderServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function startRenderServer(opts: { config: Config; paths: ProjectPaths }): Promise<RenderServer> {
  const { config, paths } = opts;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (url.pathname === '/render') {
        const slotId = url.searchParams.get('slot') ?? '';
        const locale = url.searchParams.get('locale') ?? config.defaultLocale;
        const format = (url.searchParams.get('format') ?? 'phone') as FormFactorT;
        const html = await composeSlotHtml(config, paths, { slotId, locale, format });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (url.pathname.startsWith('/input/')) {
        const rel = decodeURIComponent(url.pathname.slice('/input/'.length));
        // Prevent path traversal.
        const filePath = path.join(paths.inputs, rel);
        if (!filePath.startsWith(paths.inputs) || !existsSync(filePath)) {
          res.writeHead(404).end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
        createReadStream(filePath).pipe(res);
        return;
      }

      res.writeHead(404).end('not found');
    } catch (err) {
      const code = err instanceof MissingInputError ? 404 : 500;
      res.writeHead(code, { 'content-type': 'text/plain' }).end((err as Error).message);
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
```


- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/server.ts tests/server.test.ts
git commit -m "feat: add render http server for composition and inputs"
```

---

## Task 11: Chromium provisioning and browser singleton

**Files:**
- Create: `src/render/chromium.ts`, `src/render/browser.ts`, `tests/browser.test.ts`

> **First run downloads Chromium (~170 MB) into `~/.screenshot-composer/chromium`.** This test (and Tasks 12–15) are integration tests that require that download; the 180 s Vitest timeout covers it.

- [ ] **Step 1: Write the failing test**

`tests/browser.test.ts`:
```ts
import { describe, it, expect, afterAll } from 'vitest';
import { ensureChromium } from '../src/render/chromium.js';
import { getBrowser, closeBrowser } from '../src/render/browser.js';

afterAll(async () => { await closeBrowser(); });

describe('chromium provisioning', () => {
  it('ensures Chromium and launches a browser that can open a page', async () => {
    await ensureChromium();
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent('<h1 id="t">hi</h1>');
    expect(await page.textContent('#t')).toBe('hi');
    await page.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/browser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `chromium.ts`**

`src/render/chromium.ts`:
```ts
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { execa } from 'execa';
import { CHROMIUM_DIR } from '../paths.js';

/** Ensures Chromium is installed under ~/.screenshot-composer/chromium. */
export async function ensureChromium(log: Pick<Console, 'error'> = console): Promise<void> {
  await fs.mkdir(CHROMIUM_DIR, { recursive: true });
  process.env.PLAYWRIGHT_BROWSERS_PATH = CHROMIUM_DIR;

  const entries = existsSync(CHROMIUM_DIR) ? await fs.readdir(CHROMIUM_DIR) : [];
  if (entries.some((e) => e.startsWith('chromium'))) return;

  log.error('Downloading Chromium (one-time, ~170 MB)…');
  await execa('playwright', ['install', 'chromium'], {
    preferLocal: true,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: CHROMIUM_DIR },
    stdio: 'inherit',
  });
}
```

- [ ] **Step 4: Write `browser.ts`**

`src/render/browser.ts`:
```ts
import { chromium, type Browser } from 'playwright';
import { CHROMIUM_DIR } from '../paths.js';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  process.env.PLAYWRIGHT_BROWSERS_PATH = CHROMIUM_DIR;
  if (!browser) {
    browser = await chromium.launch({
      args: ['--disable-dev-shm-usage', '--font-render-hinting=none', '--force-color-profile=srgb'],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/browser.test.ts`
Expected: PASS (1 test). First run is slow (Chromium download).

- [ ] **Step 6: Commit**

```bash
git add src/render/chromium.ts src/render/browser.ts tests/browser.test.ts
git commit -m "feat: provision Chromium and launch a browser singleton"
```

---

## Task 12: Render a slot to a PNG buffer

**Files:**
- Create: `src/render/renderSlot.ts`, `tests/renderSlot.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/renderSlot.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderSlot.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/render/renderSlot.ts`:
```ts
import type { RenderServer } from './server.js';
import type { FormFactorT } from '../config/schema.js';
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
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: 'light',
    locale,
  });

  try {
    const page = await context.newPage();
    const res = await page.goto(
      `${server.url}/render?slot=${encodeURIComponent(slotId)}&locale=${encodeURIComponent(locale)}&format=${format}`,
      { waitUntil: 'networkidle' },
    );
    if (!res || !res.ok()) {
      throw new RenderError(`Render route failed for slot '${slotId}' (${res?.status() ?? 'no response'})`);
    }

    await page.evaluate(async () => {
      // @ts-ignore - browser context
      await document.fonts.ready;
      // @ts-ignore
      const imgs = Array.from(document.images).filter((i) => !i.complete);
      await Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
      await new Promise<void>((resolve) => {
        // @ts-ignore
        const check = () => (window.__READY__ ? resolve() : setTimeout(check, 16));
        check();
      });
    });

    const png = await page.screenshot({ type: 'png', fullPage: false });
    return await enforceConstraints(png, slotId);
  } finally {
    await context.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderSlot.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/render/renderSlot.ts tests/renderSlot.test.ts
git commit -m "feat: render a slot to a constrained PNG via Playwright"
```

---

## Task 13: `generate` command

**Files:**
- Create: `src/commands/generate.ts`, `tests/generate.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/generate.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { runGenerate } from '../src/commands/generate.js';
import { closeBrowser } from '../src/render/browser.js';
import { projectPaths } from '../src/paths.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let root: string;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-generate-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await sharp({ create: { width: 1080, height: 2280, channels: 3, background: '#22aa55' } })
    .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'));
  await fs.copyFile(path.join(here, 'fixtures/valid.config.ts'), p.config);
});

afterAll(async () => { await closeBrowser(); });

describe('runGenerate', () => {
  it('writes a valid phone PNG to outputs/', async () => {
    await runGenerate(root, {});
    const p = projectPaths(root);
    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
    const stat = await fs.stat(out);
    expect(stat.size).toBeLessThanOrEqual(8 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/commands/generate.ts`:
```ts
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { projectPaths } from '../paths.js';
import { loadConfig } from '../config/load.js';
import { ensureChromium } from '../render/chromium.js';
import { startRenderServer } from '../render/server.js';
import { renderSlot } from '../render/renderSlot.js';
import { closeBrowser } from '../render/browser.js';
import { extFor } from '../render/constraints.js';
import type { FormFactorT } from '../config/schema.js';

export interface GenerateOptions {
  locale?: string;
  format?: FormFactorT;
  slot?: string;
}

export async function runGenerate(root: string, opts: GenerateOptions): Promise<void> {
  const paths = projectPaths(root);
  const config = await loadConfig(paths.config);

  const locales = opts.locale ? [opts.locale] : config.locales;
  const formats = opts.format ? [opts.format] : config.formFactors;
  const slots = opts.slot ? config.slots.filter((s) => s.id === opts.slot) : config.slots;

  await ensureChromium();
  const server = await startRenderServer({ config, paths });

  try {
    for (const slot of slots) {
      for (const locale of locales) {
        for (const format of formats) {
          const buf = await renderSlot(server, slot.id, locale, format);
          const outDir = path.join(paths.outputs, locale, format);
          await fs.mkdir(outDir, { recursive: true });
          const outFile = path.join(outDir, `${slot.id}.${extFor(buf)}`);
          await fs.writeFile(outFile, buf);
          console.error(`✓ ${locale}/${format}/${slot.id}`);
        }
      }
    }
  } finally {
    await server.close();
    await closeBrowser();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/generate.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/commands/generate.ts tests/generate.test.ts
git commit -m "feat: add generate command orchestrating render to outputs"
```

---

## Task 14: `init` command

**Files:**
- Create: `src/commands/init.ts`, `tests/init.test.ts`

`init` scaffolds the workspace, writes a sample config (importing from `screenshot-composer`), synthesizes a sample phone screenshot with Sharp, and writes the `.gitignore`. It refuses to overwrite an existing config.

- [ ] **Step 1: Write the failing test**

`tests/init.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { runInit } from '../src/commands/init.js';
import { loadConfig } from '../src/config/load.js';
import { projectPaths } from '../src/paths.js';

describe('runInit', () => {
  it('scaffolds a working workspace whose config validates', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-init-'));
    await runInit(root);
    const p = projectPaths(root);

    // config + gitignore + sample screenshot exist
    await fs.access(p.config);
    const gi = await fs.readFile(p.gitignore, 'utf8');
    expect(gi).toContain('outputs/');
    expect(gi).toContain('.cache/');

    const sample = path.join(p.inputs, 'en-US', 'phone', 'onboarding.png');
    const meta = await sharp(sample).metadata();
    expect(meta.format).toBe('png');

    // the scaffolded config loads and validates
    const cfg = await loadConfig(p.config);
    expect(cfg.slots[0].template).toBe('bold-headline');
    expect(cfg.slots[0].frame.id).toBe('pixel-9');
  });

  it('refuses to overwrite an existing config', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-init2-'));
    await runInit(root);
    await expect(runInit(root)).rejects.toThrow(/already exists/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/init.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/commands/init.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/init.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.ts tests/init.test.ts
git commit -m "feat: add init command scaffolding the workspace"
```

---

## Task 15: CLI wiring and end-to-end smoke test

**Files:**
- Create: `src/cli.ts`, `tests/cli.smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

`tests/cli.smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = (args: string[], cwd: string) =>
  execa('npx', ['tsx', path.join(repoRoot, 'src/cli.ts'), ...args], { cwd, reject: false });

describe('CLI smoke', () => {
  it('prints a version', async () => {
    const res = await cli(['--version'], repoRoot);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('init then generate produces an output PNG', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-cli-'));
    const init = await cli(['init'], root);
    expect(init.exitCode).toBe(0);
    const gen = await cli(['generate'], root);
    expect(gen.exitCode).toBe(0);
    const out = path.join(root, 'play-screenshots', 'outputs', 'en-US', 'phone', '01-onboarding.png');
    await fs.access(out);
  });

  it('exits 1 when config is missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-cli-missing-'));
    const gen = await cli(['generate'], root);
    expect(gen.exitCode).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli.smoke.test.ts`
Expected: FAIL — `src/cli.ts` does not exist.

- [ ] **Step 3: Write the CLI**

`src/cli.ts`:
```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { runInit } from './commands/init.js';
import { runGenerate } from './commands/generate.js';
import { exitCodeFor } from './errors.js';
import type { FormFactorT } from './config/schema.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();
program
  .name('screenshot-composer')
  .description('Compose Google Play Store screenshots from Android app screenshots')
  .version(pkg.version);

program
  .command('init')
  .description('Scaffold a play-screenshots/ workspace with a sample config')
  .action(async () => {
    await guard(() => runInit(process.cwd()));
  });

program
  .command('generate')
  .description('Render all slots × locales × form factors to outputs/')
  .option('--locale <locale>', 'render only this locale')
  .option('--format <format>', 'render only this form factor')
  .option('--slot <slotId>', 'render only this slot')
  .action(async (opts: { locale?: string; format?: string; slot?: string }) => {
    await guard(() =>
      runGenerate(process.cwd(), {
        locale: opts.locale,
        format: opts.format as FormFactorT | undefined,
        slot: opts.slot,
      }),
    );
  });

async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(exitCodeFor(err));
  }
}

program.parseAsync(process.argv);
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `npx vitest run tests/cli.smoke.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run`
Expected: all tests PASS.
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts tests/cli.smoke.test.ts
git commit -m "feat: wire Commander CLI for init and generate"
```

---

## Done criteria for Milestone 1

- `npx tsx src/cli.ts init` in an empty dir scaffolds `play-screenshots/` with a sample config and a sample screenshot.
- `npx tsx src/cli.ts generate` renders `play-screenshots/outputs/en-US/phone/01-onboarding.png`, a 1080×1920 PNG ≤ 8 MB, showing the sample screenshot inside a Pixel 9 frame under a headline on a gradient background.
- `npx vitest run` passes; `npx tsc --noEmit` is clean.
- Exit codes: missing config → 1, missing input → 2.

These prove the full pipeline end-to-end and set up Milestone 2 (full config + CLI surface).

---

## Milestone 2 backlog (raised during Milestone 1 code review)

Config-validation hardening deferred here intentionally — it belongs with M2's "full Zod schema + line-accurate error reporting":

- **Discriminated union for `background`:** enforce `color` for `type: 'solid'` and `stops` (≥2) for `type: 'gradient'` via `z.discriminatedUnion`, so invalid theme backgrounds fail at config-load instead of degrading at render.
- **Cross-field `defaultLocale ∈ locales`:** add a `.superRefine` so a typo'd `defaultLocale` is caught with a clear message.
- **Color validation:** validate palette/stop strings against a CSS-color pattern.
- **Clean missing-config message:** when `generate` runs with no config file, surface a friendly "No config found — run `screenshot-composer init` first" instead of leaking the raw jiti/`require` stack (currently still exits 1, just with an internal message).
