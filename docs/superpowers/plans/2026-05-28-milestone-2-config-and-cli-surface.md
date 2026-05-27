# Milestone 2: Config Hardening + CLI Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the config schema and round out the CLI to the full Milestone-2 surface: stronger validation with friendly multi-issue error reporting, and the `doctor`, `clean`, `templates list`, `frames list`, and enriched `--version` commands.

**Architecture:** Builds directly on the Milestone 1 walking skeleton (already merged to `master`). Schema gains a discriminated-union background, a `defaultLocale ∈ locales` refinement, and CSS-color validation. Config errors are reformatted into a readable multi-issue report (field paths, not source-line numbers — a deliberate scope decision). Each new command is a small `runX(...)` function in `src/commands/` (pure/IO-thin, unit-testable) wired into Commander in `src/cli.ts`. A `src/version.ts` collects tool/Node/Playwright/Chromium versions.

**Tech Stack:** TypeScript, Node 20+ (dev on v26), Commander.js, Zod, Sharp/Playwright (already wired). Tests: Vitest. CLI run in dev via `tsx`. No build step needed to develop or test.

**Scope decisions baked in (from brainstorming):**
- Error reporting is **path-based** (e.g. `slots[0].layout.tilt.y: …`), reporting **all** issues — no AST source-line mapping.
- `clean` removes the downloaded **Chromium** (`~/.screenshot-composer/chromium`) **and** the project `.cache/`; `--cache` limits it to just the project `.cache/`.
- `doctor` checks Node version, Chromium presence, and config validity. **No fonts check** (fonts arrive in Milestone 5).
- `templates list` / `frames list` list **built-ins plus project-local** entries by directory; the full template contract/resolver and project-local frames are Milestones 3/4 — this milestone only enumerates.

**Out of scope (later milestones):** caching behavior itself (M6), the template contract/`meta.ts`/resolver (M3), additional frames + project-local frames (M4), i18n/fonts (M5), the visual editor, Fastlane import (M6), npm/Homebrew/Docker packaging (M7).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/config/schema.ts` | modify | Discriminated-union background, CSS-color validation, `defaultLocale ∈ locales` refine |
| `src/config/format-error.ts` | create | Format a `ZodError` into a readable multi-issue report with field paths |
| `src/config/load.ts` | modify | Use the formatter; friendly "no config found" message |
| `src/errors.ts` | modify | `ConfigValidationError` becomes message-passthrough (no auto-prefix) |
| `src/version.ts` | create | Collect + format tool/Node/Playwright/Chromium versions |
| `src/fsutil.ts` | create | `dirSize()` helper (recursive byte count) |
| `src/templates/registry.ts` | create | Built-in template id registry + `listTemplates(paths)` |
| `src/frames/load.ts` | modify | Add `listFrameInfos()` (id + displayName + colors) |
| `src/commands/doctor.ts` | create | `runDoctor(root)` → checks + ok flag |
| `src/commands/clean.ts` | create | `runClean(root, opts, chromiumDir?)` → removed targets |
| `src/commands/templatesList.ts` | create | `runTemplatesList(root)` → prints templates |
| `src/commands/framesList.ts` | create | `runFramesList()` → prints frames |
| `src/cli.ts` | modify | Wire `doctor`, `clean`, `templates list`, `frames list`, enriched `--version` |
| `tests/*.test.ts` | create | One test file per unit + a Milestone-2 CLI smoke test |

---

## Task 1: Harden the config schema

**Files:**
- Modify: `src/config/schema.ts`
- Test: `tests/schema.test.ts` (extend existing)

- [ ] **Step 1: Write the failing tests** (append these cases to the existing `tests/schema.test.ts` `describe('ConfigSchema', ...)` block)

```ts
  it('rejects a gradient background with fewer than 2 stops', () => {
    const bad = structuredClone(valid);
    bad.theme.background = { type: 'gradient', stops: ['#000'] } as any;
    const res = ConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
  });

  it('rejects a solid background with no color', () => {
    const bad = structuredClone(valid);
    bad.theme.background = { type: 'solid' } as any;
    expect(ConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a solid background with a color', () => {
    const ok = structuredClone(valid);
    ok.theme.background = { type: 'solid', color: '#101828' } as any;
    expect(ConfigSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects an invalid CSS color in the palette', () => {
    const bad = structuredClone(valid);
    bad.theme.palette.fg = 'not a color!!';
    expect(ConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects defaultLocale that is not in locales', () => {
    const bad = structuredClone(valid);
    bad.defaultLocale = 'fr';
    const res = ConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join('.') === 'defaultLocale')).toBe(true);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/schema.test.ts`
Expected: the 5 new cases FAIL (current schema accepts these), existing cases still PASS.

- [ ] **Step 3: Rewrite the background/theme/color parts of `src/config/schema.ts`**

Replace the `BackgroundSchema` and `ThemeSchema` definitions (lines 23–34 in the current file) with:

```ts
// Permissive CSS color: hex, rgb(a)/hsl(a) functions, or a bare keyword.
const CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)$/;
const cssColor = z.string().regex(CSS_COLOR, 'must be a valid CSS color');

const SolidBackground = z.object({
  type: z.literal('solid'),
  color: cssColor,
});

const GradientBackground = z.object({
  type: z.literal('gradient'),
  direction: z.number().default(135),
  stops: z.array(cssColor).min(2, 'a gradient needs at least 2 color stops'),
});

const BackgroundSchema = z.discriminatedUnion('type', [SolidBackground, GradientBackground]);

const ThemeSchema = z.object({
  fontFamily: z.string().default('system-ui'),
  palette: z.object({ fg: cssColor, accent: cssColor, muted: cssColor }),
  background: BackgroundSchema,
});
```

Then replace the `ConfigSchema` definition (lines 54–61) with a version that adds the cross-field refinement:

```ts
export const ConfigSchema = z
  .object({
    locales: z.array(z.string()).min(1),
    defaultLocale: z.string(),
    formFactors: z.array(FormFactor).min(1),
    paths: PathsSchema,
    theme: ThemeSchema,
    slots: z.array(SlotSchema).min(1).max(8),
  })
  .superRefine((cfg, ctx) => {
    if (!cfg.locales.includes(cfg.defaultLocale)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultLocale'],
        message: `'${cfg.defaultLocale}' is not one of locales [${cfg.locales.join(', ')}]`,
      });
    }
  });
```

Leave `FrameRefSchema.color` as a plain `z.string().optional()` — it's a frame **color-name** (e.g. `obsidian`), not a CSS color. Leave `defineConfig`, the type exports (`Config`/`Slot`/`Theme`), `TiltSchema`, `LayoutSchema`, `PathsSchema`, `SlotSchema` unchanged. `z.infer`/`z.input` continue to work through the `.superRefine` (it returns a `ZodEffects`).

- [ ] **Step 4: Run the schema tests + typecheck**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS (original 3 cases + 5 new = 8 tests).
Run: `npx tsc --noEmit`
Expected: clean (exit 0). The template (`src/templates/bold-headline/render.ts`) keeps its own structurally-loose background type, which the discriminated-union output type is assignable to — no change needed there.

- [ ] **Step 5: Run the full suite to catch fallout**

Run: `npx vitest run`
Expected: all pass. Note: `tests/load.test.ts` uses `tests/fixtures/invalid.config.ts` (tilt.y = -75, gradient with 1 stop) — it now fails validation for *two* reasons, and the test only asserts the error contains `tilt.y`, so it still passes.

- [ ] **Step 6: Commit**

```bash
git add src/config/schema.ts tests/schema.test.ts
git commit -m "feat: harden config schema (gradient stops, css colors, defaultLocale)"
```

---

## Task 2: Friendly multi-issue config error reporting

**Files:**
- Create: `src/config/format-error.ts`
- Modify: `src/errors.ts`, `src/config/load.ts`
- Test: `tests/format-error.test.ts`; extend `tests/load.test.ts`

- [ ] **Step 1: Write the failing test for the formatter**

`tests/format-error.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../src/config/schema.js';
import { formatZodError } from '../src/config/format-error.js';

function errorFor(obj: unknown) {
  const r = ConfigSchema.safeParse(obj);
  if (r.success) throw new Error('expected parse to fail');
  return r.error;
}

describe('formatZodError', () => {
  it('renders the file header and one bullet per issue with dotted+indexed paths', () => {
    const err = errorFor({
      locales: ['en-US'],
      defaultLocale: 'en-US',
      formFactors: ['phone'],
      theme: {
        palette: { fg: '#000', accent: '#111', muted: '#222' },
        background: { type: 'gradient', stops: ['#000', '#111'] },
      },
      slots: [
        {
          id: '01',
          template: 'bold-headline',
          screenshot: 'a.png',
          frame: { id: 'pixel-9' },
          layout: { tilt: { x: 0, y: -75, z: 0 } },
          copy: { headline: { 'en-US': 'x' } },
        },
      ],
    });
    const out = formatZodError('cfg.ts', err);
    expect(out).toContain('cfg.ts');
    expect(out).toContain('slots[0].layout.tilt.y');
    // each issue is a bullet line
    expect(out.split('\n').filter((l) => l.trim().startsWith('•')).length).toBeGreaterThanOrEqual(1);
  });

  it('labels root-level issues as (root)', () => {
    const err = errorFor('not an object');
    const out = formatZodError('cfg.ts', err);
    expect(out).toContain('(root)');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/format-error.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the formatter**

`src/config/format-error.ts`:
```ts
import type { ZodError, ZodIssue } from 'zod';

/** Render a Zod path like ['slots',0,'layout','tilt','y'] → 'slots[0].layout.tilt.y'. */
export function formatPath(path: ZodIssue['path']): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out ? `.${seg}` : String(seg);
  }
  return out || '(root)';
}

/** Format a ZodError into a readable multi-issue report (all issues, by field path). */
export function formatZodError(file: string, error: ZodError): string {
  const bullets = error.issues.map((i) => `  • ${formatPath(i.path)}: ${i.message}`);
  return `Invalid config: ${file}\n${bullets.join('\n')}`;
}
```

- [ ] **Step 4: Run the formatter test**

Run: `npx vitest run tests/format-error.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Make `ConfigValidationError` a message-passthrough**

Replace the `ConfigValidationError` class in `src/errors.ts` (lines 1–6) with:
```ts
export class ConfigValidationError extends Error {
  constructor(public file: string, message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}
```
(The old constructor wrapped the message with `Config error in …`; callers now pass a fully-formatted message. `exitCodeFor` and the other error classes are unchanged.)

- [ ] **Step 6: Wire the formatter + friendly missing-config message into `load.ts`**

Replace the entire body of `src/config/load.ts` with:
```ts
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createJiti } from 'jiti';
import { ConfigSchema, type Config } from './schema.js';
import { ConfigValidationError } from '../errors.js';
import { formatZodError } from './format-error.js';

// In source/dev this resolves to src/index.ts; the published build resolves the
// specifier through node_modules and this alias is an unused fallback.
const SELF_ALIAS = fileURLToPath(new URL('../index.ts', import.meta.url));

export async function loadConfig(configPath: string): Promise<Config> {
  if (!existsSync(configPath)) {
    throw new ConfigValidationError(
      configPath,
      `No config found at ${configPath}\n  Run \`screenshot-composer init\` to create one.`,
    );
  }

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: { 'screenshot-composer': SELF_ALIAS },
  });

  let loaded: unknown;
  try {
    loaded = await jiti.import(configPath, { default: true });
  } catch (err) {
    throw new ConfigValidationError(configPath, `Could not load ${configPath}\n  ${(err as Error).message}`);
  }

  const result = ConfigSchema.safeParse(loaded);
  if (!result.success) {
    throw new ConfigValidationError(configPath, formatZodError(configPath, result.error));
  }
  return result.data;
}
```

- [ ] **Step 7: Extend `tests/load.test.ts` with a missing-config case**

Add this test inside the existing `describe('loadConfig', ...)` block in `tests/load.test.ts`:
```ts
  it('throws a friendly error when no config file exists', async () => {
    await expect(loadConfig(path.join(here, 'fixtures/does-not-exist.config.ts')))
      .rejects.toThrow(/No config found/);
  });
```

- [ ] **Step 8: Run affected tests + full suite + typecheck**

Run: `npx vitest run tests/format-error.test.ts tests/load.test.ts tests/errors.test.ts`
Expected: PASS. (`errors.test.ts` only asserts `exitCodeFor` + `MissingInputError` message — unaffected by the `ConfigValidationError` change.)
Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass; tsc clean.

- [ ] **Step 9: Commit**

```bash
git add src/config/format-error.ts src/config/load.ts src/errors.ts tests/format-error.test.ts tests/load.test.ts
git commit -m "feat: readable multi-issue config errors and friendly missing-config message"
```

---

## Task 3: Recursive directory-size helper

**Files:**
- Create: `src/fsutil.ts`
- Test: `tests/fsutil.test.ts`

Used by `clean` to report bytes freed. Isolated so it's independently testable.

- [ ] **Step 1: Write the failing test**

`tests/fsutil.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { dirSize } from '../src/fsutil.js';

describe('dirSize', () => {
  it('returns 0 for a missing path', async () => {
    expect(await dirSize('/no/such/path/here')).toBe(0);
  });

  it('sums file sizes recursively', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-size-'));
    await fs.writeFile(path.join(root, 'a.txt'), '12345'); // 5 bytes
    await fs.mkdir(path.join(root, 'sub'));
    await fs.writeFile(path.join(root, 'sub', 'b.txt'), '1234567890'); // 10 bytes
    expect(await dirSize(root)).toBe(15);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/fsutil.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

`src/fsutil.ts`:
```ts
import path from 'node:path';
import { promises as fs } from 'node:fs';

/** Total size in bytes of all files under `target` (0 if it does not exist). */
export async function dirSize(target: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(target, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else if (entry.isFile()) {
      total += (await fs.stat(full)).size;
    }
  }
  return total;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/fsutil.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/fsutil.ts tests/fsutil.test.ts
git commit -m "feat: add recursive dirSize helper"
```

---

## Task 4: `clean` command

**Files:**
- Create: `src/commands/clean.ts`
- Test: `tests/clean.test.ts`

`runClean` takes the chromium dir as an injectable parameter (default `CHROMIUM_DIR`) so tests never touch the real `~/.screenshot-composer/chromium`.

- [ ] **Step 1: Write the failing test**

`tests/clean.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs, existsSync } from 'node:fs';
import { runClean } from '../src/commands/clean.js';
import { projectPaths } from '../src/paths.js';

async function makeFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-clean-'));
  const p = projectPaths(root);
  await fs.mkdir(p.cache, { recursive: true });
  await fs.writeFile(path.join(p.cache, 'x.png'), '12345');
  const chromiumDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-chromium-'));
  await fs.mkdir(path.join(chromiumDir, 'chromium-123'), { recursive: true });
  await fs.writeFile(path.join(chromiumDir, 'chromium-123', 'bin'), '1234567890');
  return { root, p, chromiumDir };
}

describe('runClean', () => {
  it('removes both Chromium and the project cache by default', async () => {
    const { root, p, chromiumDir } = await makeFixture();
    const { removed } = await runClean(root, {}, chromiumDir);
    expect(existsSync(chromiumDir)).toBe(false);
    expect(existsSync(p.cache)).toBe(false);
    expect(removed.map((r) => r.path).sort()).toEqual([chromiumDir, p.cache].sort());
    expect(removed.find((r) => r.path === chromiumDir)!.bytes).toBe(10);
  });

  it('with --cache removes only the project cache, leaving Chromium', async () => {
    const { root, p, chromiumDir } = await makeFixture();
    const { removed } = await runClean(root, { cache: true }, chromiumDir);
    expect(existsSync(p.cache)).toBe(false);
    expect(existsSync(chromiumDir)).toBe(true);
    expect(removed.map((r) => r.path)).toEqual([p.cache]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/clean.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the command**

`src/commands/clean.ts`:
```ts
import { promises as fs, existsSync } from 'node:fs';
import { projectPaths } from '../paths.js';
import { CHROMIUM_DIR } from '../paths.js';
import { dirSize } from '../fsutil.js';

export interface CleanOptions {
  cache?: boolean;
}

export interface CleanResult {
  removed: { path: string; bytes: number }[];
}

/** Remove cached artifacts. By default: Chromium + project .cache; with {cache:true}: only project .cache. */
export async function runClean(
  root: string,
  opts: CleanOptions,
  chromiumDir: string = CHROMIUM_DIR,
): Promise<CleanResult> {
  const paths = projectPaths(root);
  const targets = opts.cache ? [paths.cache] : [chromiumDir, paths.cache];

  const removed: { path: string; bytes: number }[] = [];
  for (const target of targets) {
    if (!existsSync(target)) continue;
    const bytes = await dirSize(target);
    await fs.rm(target, { recursive: true, force: true });
    removed.push({ path: target, bytes });
  }
  return { removed };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/clean.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/clean.ts tests/clean.test.ts
git commit -m "feat: add clean command (chromium + project cache)"
```

---

## Task 5: `doctor` command

**Files:**
- Create: `src/commands/doctor.ts`
- Test: `tests/doctor.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/doctor.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runDoctor } from '../src/commands/doctor.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('runDoctor', () => {
  it('passes the Node check and includes a Chromium check', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-doctor-'));
    const { checks } = await runDoctor(root);
    const node = checks.find((c) => c.name.startsWith('Node'));
    expect(node?.ok).toBe(true);
    expect(checks.some((c) => c.name.toLowerCase().includes('chromium'))).toBe(true);
  });

  it('does not fail when there is no config (informational)', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-doctor-noconfig-'));
    const { checks } = await runDoctor(root);
    const cfg = checks.find((c) => c.name.toLowerCase().includes('config'));
    expect(cfg?.ok).toBe(true);
    expect(cfg?.detail).toMatch(/no config|init/i);
  });

  it('reports an invalid config and is not ok overall', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-doctor-badcfg-'));
    const base = path.join(root, 'play-screenshots');
    await fs.mkdir(base, { recursive: true });
    await fs.copyFile(
      path.join(here, 'fixtures/invalid.config.ts'),
      path.join(base, 'screenshot-composer.config.ts'),
    );
    const { checks, ok } = await runDoctor(root);
    const cfg = checks.find((c) => c.name.toLowerCase().includes('config'));
    expect(cfg?.ok).toBe(false);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/doctor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the command**

`src/commands/doctor.ts`:
```ts
import { promises as fs, existsSync } from 'node:fs';
import { CHROMIUM_DIR, projectPaths } from '../paths.js';
import { loadConfig } from '../config/load.js';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  ok: boolean;
}

export async function runDoctor(root: string): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];

  // Node version
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'Node.js >= 20',
    ok: nodeMajor >= 20,
    detail: `found v${process.versions.node}`,
  });

  // Chromium presence (downloaded by `generate` on first run)
  let chromiumOk = false;
  if (existsSync(CHROMIUM_DIR)) {
    const entries = await fs.readdir(CHROMIUM_DIR);
    chromiumOk = entries.some((e) => e.startsWith('chromium'));
  }
  checks.push({
    name: 'Chromium installed',
    ok: chromiumOk,
    detail: chromiumOk ? CHROMIUM_DIR : 'not downloaded yet — run `screenshot-composer generate`',
  });

  // Config validity (informational when absent — doctor can run outside a project)
  const paths = projectPaths(root);
  if (existsSync(paths.config)) {
    try {
      await loadConfig(paths.config);
      checks.push({ name: 'Config valid', ok: true, detail: paths.config });
    } catch (err) {
      checks.push({ name: 'Config valid', ok: false, detail: (err as Error).message });
    }
  } else {
    checks.push({ name: 'Config present', ok: true, detail: 'no config here (run `init` to create one)' });
  }

  return { checks, ok: checks.every((c) => c.ok) };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/doctor.test.ts`
Expected: PASS (3 tests). (The "passes the Node check" test asserts only the Node check `ok` and that a Chromium check exists — it does NOT require Chromium to be installed, so it's deterministic across machines.)

- [ ] **Step 5: Commit**

```bash
git add src/commands/doctor.ts tests/doctor.test.ts
git commit -m "feat: add doctor command (node, chromium, config checks)"
```

---

## Task 6: `templates list`

**Files:**
- Create: `src/templates/registry.ts`, `src/commands/templatesList.ts`
- Test: `tests/templates-list.test.ts`

This milestone only **enumerates** templates (built-in ids + project-local directory names). The template contract/resolver is Milestone 3.

- [ ] **Step 1: Write the failing test**

`tests/templates-list.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { listTemplates, BUILTIN_TEMPLATES } from '../src/templates/registry.js';
import { projectPaths } from '../src/paths.js';

describe('listTemplates', () => {
  it('lists the built-in templates including bold-headline', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-tpl-'));
    const list = await listTemplates(projectPaths(root));
    expect(BUILTIN_TEMPLATES).toContain('bold-headline');
    expect(list.some((t) => t.id === 'bold-headline' && t.source === 'built-in')).toBe(true);
  });

  it('includes project-local template directories', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-tpl2-'));
    const p = projectPaths(root);
    await fs.mkdir(path.join(p.templates, 'my-custom'), { recursive: true });
    const list = await listTemplates(p);
    expect(list.some((t) => t.id === 'my-custom' && t.source === 'project')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/templates-list.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the registry**

`src/templates/registry.ts`:
```ts
import { promises as fs, existsSync } from 'node:fs';
import type { ProjectPaths } from '../paths.js';

/** Built-in template ids shipped with the package. Expanded by the resolver in Milestone 3. */
export const BUILTIN_TEMPLATES = ['bold-headline'] as const;

export interface TemplateInfo {
  id: string;
  source: 'built-in' | 'project';
}

/** Enumerate built-in templates plus any project-local template directories. */
export async function listTemplates(paths: ProjectPaths): Promise<TemplateInfo[]> {
  const out: TemplateInfo[] = BUILTIN_TEMPLATES.map((id) => ({ id, source: 'built-in' as const }));
  if (existsSync(paths.templates)) {
    const entries = await fs.readdir(paths.templates, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) out.push({ id: entry.name, source: 'project' });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/templates-list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the command wrapper**

`src/commands/templatesList.ts`:
```ts
import { projectPaths } from '../paths.js';
import { listTemplates } from '../templates/registry.js';

/** Print available templates to stdout. */
export async function runTemplatesList(root: string): Promise<void> {
  const templates = await listTemplates(projectPaths(root));
  for (const t of templates) {
    console.log(`${t.id}  (${t.source})`);
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/templates/registry.ts src/commands/templatesList.ts tests/templates-list.test.ts
git commit -m "feat: add templates list (built-in + project-local)"
```

---

## Task 7: `frames list`

**Files:**
- Modify: `src/frames/load.ts` (add `listFrameInfos`)
- Create: `src/commands/framesList.ts`
- Test: `tests/frames-list.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/frames-list.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { listFrameInfos } from '../src/frames/load.js';

describe('listFrameInfos', () => {
  it('lists pixel-9 with its display name and colors', async () => {
    const infos = await listFrameInfos();
    const pixel = infos.find((f) => f.id === 'pixel-9');
    expect(pixel).toBeDefined();
    expect(pixel!.displayName).toBe('Pixel 9');
    expect(pixel!.colors).toEqual(['obsidian']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/frames-list.test.ts`
Expected: FAIL — `listFrameInfos` not exported.

- [ ] **Step 3: Add `listFrameInfos` to `src/frames/load.ts`**

Append this export to the end of `src/frames/load.ts` (it reuses the existing `listFrames` and `loadFrame`):
```ts
export interface FrameInfo {
  id: string;
  displayName: string;
  colors: string[];
}

/** List built-in frames with display name and available colors. */
export async function listFrameInfos(): Promise<FrameInfo[]> {
  const ids = await listFrames();
  const infos: FrameInfo[] = [];
  for (const id of ids) {
    const { manifest } = await loadFrame(id);
    infos.push({ id, displayName: manifest.displayName, colors: manifest.colors });
  }
  return infos;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/frames-list.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write the command wrapper**

`src/commands/framesList.ts`:
```ts
import { listFrameInfos } from '../frames/load.js';

/** Print available device frames to stdout. */
export async function runFramesList(): Promise<void> {
  const frames = await listFrameInfos();
  for (const f of frames) {
    console.log(`${f.id}  ${f.displayName}  [${f.colors.join(', ')}]`);
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/frames/load.ts src/commands/framesList.ts tests/frames-list.test.ts
git commit -m "feat: add frames list with display names and colors"
```

---

## Task 8: Enriched `--version`

**Files:**
- Create: `src/version.ts`
- Test: `tests/version.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/version.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { versionInfo, formatVersion } from '../src/version.js';

describe('version', () => {
  it('reports tool + node + playwright + chromium fields', () => {
    const v = versionInfo();
    expect(v.tool).toMatch(/\d+\.\d+\.\d+/);
    expect(v.node).toBe(process.versions.node);
    expect(typeof v.playwright).toBe('string');
    expect(typeof v.chromium).toBe('string');
  });

  it('formats a multi-line version string containing the tool semver', () => {
    const out = formatVersion({ tool: '1.2.3', node: '26.0.0', playwright: '1.49.1', chromium: 'rev 1148' });
    expect(out).toContain('screenshot-composer 1.2.3');
    expect(out).toContain('node');
    expect(out).toContain('playwright');
    expect(out).toContain('chromium');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/version.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the version module**

`src/version.ts`:
```ts
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface VersionInfo {
  tool: string;
  node: string;
  playwright: string;
  chromium: string;
}

export function versionInfo(): VersionInfo {
  const pkg = require('../package.json') as { version: string };

  let playwright = 'unknown';
  try {
    playwright = (require('playwright/package.json') as { version: string }).version;
  } catch {
    // playwright package.json not resolvable; leave 'unknown'
  }

  let chromium = 'unknown';
  try {
    const browsers = require('playwright-core/browsers.json') as {
      browsers: { name: string; revision: string }[];
    };
    const c = browsers.browsers.find((b) => b.name === 'chromium');
    if (c) chromium = `rev ${c.revision}`;
  } catch {
    // browsers.json not exported by this playwright-core version; leave 'unknown'
  }

  return { tool: pkg.version, node: process.versions.node, playwright, chromium };
}

export function formatVersion(v: VersionInfo = versionInfo()): string {
  return [
    `screenshot-composer ${v.tool}`,
    `  node        ${v.node}`,
    `  playwright  ${v.playwright}`,
    `  chromium    ${v.chromium}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/version.test.ts`
Expected: PASS (2 tests). (`chromium`/`playwright` may be `'unknown'` if not resolvable — the test only checks they're strings.)

- [ ] **Step 5: Commit**

```bash
git add src/version.ts tests/version.test.ts
git commit -m "feat: enriched version info (tool, node, playwright, chromium)"
```

---

## Task 9: Wire the new commands into the CLI

**Files:**
- Modify: `src/cli.ts`
- Test: `tests/cli.m2.smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

`tests/cli.m2.smoke.test.ts`:
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

describe('CLI M2 smoke', () => {
  it('--version prints the enriched multi-line info', async () => {
    const res = await cli(['--version'], repoRoot);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/screenshot-composer \d+\.\d+\.\d+/);
    expect(res.stdout).toContain('playwright');
  });

  it('frames list prints pixel-9', async () => {
    const res = await cli(['frames', 'list'], repoRoot);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('pixel-9');
    expect(res.stdout).toContain('Pixel 9');
  });

  it('templates list prints bold-headline', async () => {
    const res = await cli(['templates', 'list'], repoRoot);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('bold-headline');
  });

  it('doctor runs and prints the Node check', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-m2-doctor-'));
    const res = await cli(['doctor'], root);
    // exit 0 (all ok) or 1 (e.g. chromium not yet downloaded) — must not crash
    expect([0, 1]).toContain(res.exitCode);
    expect(res.stdout).toContain('Node.js');
  });

  it('clean --cache exits 0 in a fresh project', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-m2-clean-'));
    const res = await cli(['clean', '--cache'], root);
    expect(res.exitCode).toBe(0);
  });

  it('generate with no config exits 1 with a friendly message', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-m2-nocfg-'));
    const res = await cli(['generate'], root);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toMatch(/No config found/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/cli.m2.smoke.test.ts`
Expected: FAIL — `frames`/`templates`/`doctor`/`clean` commands don't exist yet; `--version` lacks `playwright`.

- [ ] **Step 3: Rewrite `src/cli.ts` to add the commands and enriched version**

Replace the entire contents of `src/cli.ts` with:
```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runGenerate } from './commands/generate.js';
import { runDoctor } from './commands/doctor.js';
import { runClean } from './commands/clean.js';
import { runTemplatesList } from './commands/templatesList.js';
import { runFramesList } from './commands/framesList.js';
import { formatVersion } from './version.js';
import { exitCodeFor } from './errors.js';
import type { FormFactorT } from './config/schema.js';

const program = new Command();
program
  .name('screenshot-composer')
  .description('Compose Google Play Store screenshots from Android app screenshots')
  .version(formatVersion(), '-V, --version', 'output version info (tool, node, playwright, chromium)');

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

program
  .command('doctor')
  .description('Diagnose setup (Node, Chromium, config)')
  .action(async () => {
    await guard(async () => {
      const { checks, ok } = await runDoctor(process.cwd());
      for (const c of checks) {
        console.log(`${c.ok ? '✓' : '✗'} ${c.name} — ${c.detail}`);
      }
      if (!ok) process.exit(1);
    });
  });

program
  .command('clean')
  .description('Remove cached artifacts (downloaded Chromium and the project .cache)')
  .option('--cache', 'remove only the project .cache, leave Chromium')
  .action(async (opts: { cache?: boolean }) => {
    await guard(async () => {
      const { removed } = await runClean(process.cwd(), { cache: opts.cache });
      if (removed.length === 0) {
        console.log('Nothing to clean.');
        return;
      }
      for (const r of removed) {
        console.log(`Removed ${r.path} (${formatBytes(r.bytes)})`);
      }
    });
  });

const templates = program.command('templates').description('Inspect templates');
templates
  .command('list')
  .description('List available templates (built-in + project-local)')
  .action(async () => {
    await guard(() => runTemplatesList(process.cwd()));
  });

const frames = program.command('frames').description('Inspect device frames');
frames
  .command('list')
  .description('List available device frames')
  .action(async () => {
    await guard(() => runFramesList());
  });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(exitCodeFor(err));
  }
}

program.parseAsync(process.argv).catch((err) => {
  console.error((err as Error).message);
  process.exit(exitCodeFor(err));
});
```

Note: the `createRequire`/`pkg` lines from M1 are gone — the version string now comes from `formatVersion()` (which reads `package.json` itself).

- [ ] **Step 4: Run the smoke test**

Run: `npx vitest run tests/cli.m2.smoke.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the original M1 smoke test for regressions**

Run: `npx vitest run tests/cli.smoke.test.ts`
Expected: PASS — the M1 smoke test asserts `--version` matches `/\d+\.\d+\.\d+/`, which the enriched output still contains; `init`→`generate` and the missing-config exit-1 cases still hold.

- [ ] **Step 6: Full suite + typecheck**

Run: `npx vitest run`
Expected: all pass.
Run: `npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts tests/cli.m2.smoke.test.ts
git commit -m "feat: wire doctor, clean, templates/frames list, enriched version into CLI"
```

---

## Done criteria for Milestone 2

- `screenshot-composer --version` prints tool + node + playwright + chromium versions.
- `screenshot-composer doctor` reports Node/Chromium/config checks; exits 1 if any fails.
- `screenshot-composer clean` frees Chromium + project cache (reporting bytes); `--cache` limits to the project cache.
- `screenshot-composer templates list` and `frames list` enumerate built-in + project-local entries.
- Config validation rejects malformed gradients/solids, invalid CSS colors, and a `defaultLocale` not in `locales`, reporting **all** issues with field paths; a missing config yields a friendly "run `init`" message.
- `npx vitest run` passes; `npx tsc --noEmit` is clean.

These complete the CLI surface and config robustness, setting up Milestone 3 (template contract + resolver + production templates).
