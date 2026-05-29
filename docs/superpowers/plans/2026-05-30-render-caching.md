# Render Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `generate` skip re-rendering any output whose inputs are unchanged, with a `--force` flag to bypass the cache.

**Architecture:** An index-only cache. `src/render/cache.ts` computes a per-output SHA-256 key over all rendering inputs (config slice, screenshot bytes, project-local template source, theme, resolved copy, dimensions, and tool/Chromium versions) and reads/writes `play-screenshots/.cache/index.json`. `runGenerate` treats an output as a hit only when the recorded key matches **and** the output file still exists; otherwise it renders, writes, and updates the index incrementally.

**Tech Stack:** TypeScript (ESM, `.js`-extension imports), Node `crypto`/`fs`, Vitest, Playwright (existing render path), Sharp (existing constraints).

Full design: `docs/superpowers/specs/2026-05-30-render-caching-design.md`.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/render/compose.ts` | Slot→HTML; gains an exported `resolveCopy` helper reused by the cache | Modify |
| `src/render/cache.ts` | Cache key, index load/save, identity/output-path helpers | Create |
| `src/commands/generate.ts` | Orchestrates lookup/skip/render/persist; new `force` option + summary | Modify |
| `src/cli.ts` | `--force` flag on the `generate` command | Modify |
| `tests/compose.test.ts` | Add a `resolveCopy` unit test | Modify |
| `tests/cache.test.ts` | Unit tests for key, index, `cacheKeyForSlot` | Create |
| `tests/generate.test.ts` | Integration tests for cache hit/miss/force | Modify |
| `tests/cli.m2.smoke.test.ts` | `generate --force` smoke (or `cli.smoke.test.ts`) | Modify |
| `tests/clean.test.ts` | Assert `clean --cache` clears a populated cache index | Modify |
| `README.md`, `CLAUDE.md` | Document caching + `--force`; drop the "re-renders everything" note | Modify |

---

## Task 1: Extract `resolveCopy` from `compose.ts`

The cache key and the renderer must resolve copy (with `defaultLocale` fallback) identically. Extract the inline loop into one exported function.

**Files:**
- Modify: `src/render/compose.ts`
- Test: `tests/compose.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/compose.test.ts` (keep existing imports; add `resolveCopy` to the import from `../src/render/compose.js`):

```ts
import { resolveCopy } from '../src/render/compose.js';

describe('resolveCopy', () => {
  const slot = {
    copy: {
      headline: { 'en-US': 'Hello', 'de-DE': 'Hallo' },
      sub: { 'en-US': 'Only English' },
    },
  } as unknown as import('../src/config/schema.js').Slot;

  it('uses the requested locale when present', () => {
    expect(resolveCopy(slot, 'de-DE', 'en-US')).toEqual({ headline: 'Hallo', sub: 'Only English' });
  });

  it('falls back to defaultLocale then empty string', () => {
    expect(resolveCopy(slot, 'fr-FR', 'en-US')).toEqual({ headline: 'Hello', sub: 'Only English' });
    expect(resolveCopy(slot, 'fr-FR', 'ja-JP')).toEqual({ headline: '', sub: '' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compose.test.ts -t resolveCopy`
Expected: FAIL — `resolveCopy` is not exported.

- [ ] **Step 3: Add the helper and use it in `composeSlotHtml`**

In `src/render/compose.ts`, add the import for `Slot` to the existing schema type import:

```ts
import type { Config, FormFactorT, Slot } from '../config/schema.js';
```

Add this exported function (place it above `composeSlotHtml`):

```ts
/** Resolve every declared copy key for a locale, falling back to defaultLocale then ''. */
export function resolveCopy(slot: Slot, locale: string, defaultLocale: string): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const key of Object.keys(slot.copy)) {
    copy[key] = slot.copy[key]?.[locale] ?? slot.copy[key]?.[defaultLocale] ?? '';
  }
  return copy;
}
```

Replace the inline loop inside `composeSlotHtml`:

```ts
  // Resolve every declared copy key for this locale, falling back to defaultLocale.
  const copy: Record<string, string> = {};
  for (const key of Object.keys(slot.copy)) {
    copy[key] = slot.copy[key]?.[ref.locale] ?? slot.copy[key]?.[config.defaultLocale] ?? '';
  }
```

with:

```ts
  const copy = resolveCopy(slot, ref.locale, config.defaultLocale);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/compose.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/render/compose.ts tests/compose.test.ts
git commit -m "refactor(compose): extract resolveCopy for reuse by the cache"
```

---

## Task 2: Cache index — types, load, save

**Files:**
- Create: `src/render/cache.ts`
- Test: `tests/cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import {
  loadCacheIndex,
  saveCacheIndex,
  CACHE_INDEX_VERSION,
  type CacheIndex,
} from '../src/render/cache.js';

async function tmpCacheDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sc-cache-'));
}

describe('cache index', () => {
  it('returns an empty index when the file is missing', async () => {
    const dir = await tmpCacheDir();
    expect(await loadCacheIndex(dir)).toEqual({ version: CACHE_INDEX_VERSION, entries: {} });
  });

  it('round-trips through save/load', async () => {
    const dir = await tmpCacheDir();
    const index: CacheIndex = {
      version: CACHE_INDEX_VERSION,
      entries: { 'en-US/phone/01': { key: 'abc', ext: 'png' } },
    };
    await saveCacheIndex(dir, index);
    expect(await loadCacheIndex(dir)).toEqual(index);
  });

  it('treats corrupt JSON as empty', async () => {
    const dir = await tmpCacheDir();
    await fs.writeFile(path.join(dir, 'index.json'), '{ not json');
    expect(await loadCacheIndex(dir)).toEqual({ version: CACHE_INDEX_VERSION, entries: {} });
  });

  it('treats a version mismatch as empty', async () => {
    const dir = await tmpCacheDir();
    await fs.writeFile(
      path.join(dir, 'index.json'),
      JSON.stringify({ version: CACHE_INDEX_VERSION + 1, entries: { x: { key: 'k', ext: 'png' } } }),
    );
    expect(await loadCacheIndex(dir)).toEqual({ version: CACHE_INDEX_VERSION, entries: {} });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cache.test.ts`
Expected: FAIL — cannot find module `../src/render/cache.js`.

- [ ] **Step 3: Create `src/render/cache.ts` with the index half**

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Bump to invalidate every cache key (key-algorithm change). */
export const CACHE_FORMAT_VERSION = 1;
/** Schema version of index.json; a mismatch discards the whole index. */
export const CACHE_INDEX_VERSION = 1;

export interface CacheEntry {
  key: string;
  ext: 'png' | 'jpg';
}

export interface CacheIndex {
  version: number;
  entries: Record<string, CacheEntry>;
}

function emptyIndex(): CacheIndex {
  return { version: CACHE_INDEX_VERSION, entries: {} };
}

export async function loadCacheIndex(cacheDir: string): Promise<CacheIndex> {
  try {
    const raw = await fs.readFile(path.join(cacheDir, 'index.json'), 'utf8');
    const parsed = JSON.parse(raw) as CacheIndex;
    if (
      !parsed ||
      parsed.version !== CACHE_INDEX_VERSION ||
      typeof parsed.entries !== 'object' ||
      parsed.entries === null
    ) {
      return emptyIndex();
    }
    return parsed;
  } catch {
    return emptyIndex();
  }
}

export async function saveCacheIndex(cacheDir: string, index: CacheIndex): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  const indexPath = path.join(cacheDir, 'index.json');
  const tmp = path.join(cacheDir, `index.json.tmp-${process.pid}`);
  await fs.writeFile(tmp, JSON.stringify(index, null, 2));
  await fs.rename(tmp, indexPath);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cache.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/render/cache.ts tests/cache.test.ts
git commit -m "feat(cache): cache index load/save with tolerant parsing"
```

---

## Task 3: Cache key computation + path helpers

**Files:**
- Modify: `src/render/cache.ts`
- Test: `tests/cache.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/cache.test.ts` (add the new symbols to the existing import from `../src/render/cache.js`: `computeCacheKey`, `identityKey`, `outputFilePath`, `CACHE_FORMAT_VERSION`, and `type CacheKeyInput`):

```ts
import {
  computeCacheKey,
  identityKey,
  outputFilePath,
  CACHE_FORMAT_VERSION,
  type CacheKeyInput,
} from '../src/render/cache.js';

const baseInput: CacheKeyInput = {
  cacheFormatVersion: CACHE_FORMAT_VERSION,
  tool: '0.1.0',
  chromium: '120',
  locale: 'en-US',
  format: 'phone',
  dimensions: { width: 1080, height: 1920, scale: 1 },
  slotId: '01',
  frameId: 'pixel-9',
  templateId: 'bold-headline',
  layout: {},
  copy: { headline: 'Hi' },
  theme: { palette: { fg: '#000' } },
  screenshotHash: 'aaa',
  templateSourceHash: null,
};

describe('computeCacheKey', () => {
  it('is stable for identical input', () => {
    expect(computeCacheKey(baseInput)).toBe(computeCacheKey({ ...baseInput }));
  });

  it('is independent of key ordering in nested objects', () => {
    const reordered = { ...baseInput, theme: { palette: { fg: '#000' } }, copy: { headline: 'Hi' } };
    expect(computeCacheKey(reordered)).toBe(computeCacheKey(baseInput));
  });

  it('changes when any rendering input changes', () => {
    const base = computeCacheKey(baseInput);
    const variants: CacheKeyInput[] = [
      { ...baseInput, tool: '0.2.0' },
      { ...baseInput, chromium: '121' },
      { ...baseInput, cacheFormatVersion: CACHE_FORMAT_VERSION + 1 },
      { ...baseInput, locale: 'de-DE' },
      { ...baseInput, dimensions: { width: 1440, height: 1920, scale: 1 } },
      { ...baseInput, frameId: 'pixel-7' },
      { ...baseInput, templateId: 'showcase' },
      { ...baseInput, layout: { tilt: 5 } },
      { ...baseInput, copy: { headline: 'Bye' } },
      { ...baseInput, theme: { palette: { fg: '#fff' } } },
      { ...baseInput, screenshotHash: 'bbb' },
      { ...baseInput, templateSourceHash: 'ccc' },
    ];
    for (const v of variants) expect(computeCacheKey(v)).not.toBe(base);
  });
});

describe('path helpers', () => {
  it('builds the identity key', () => {
    expect(identityKey('en-US', 'phone', '01')).toBe('en-US/phone/01');
  });
  it('builds the output file path', () => {
    expect(outputFilePath('/out', 'en-US', 'phone', '01', 'png')).toBe(
      path.join('/out', 'en-US', 'phone', '01.png'),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cache.test.ts -t computeCacheKey`
Expected: FAIL — `computeCacheKey` not exported.

- [ ] **Step 3: Implement the key + helpers**

Add to the top of `src/render/cache.ts`:

```ts
import { createHash } from 'node:crypto';
import type { FormFactorT } from '../config/schema.js';
import type { Dimensions } from './constraints.js';
```

Add these exports:

```ts
export interface CacheKeyInput {
  cacheFormatVersion: number;
  tool: string;
  chromium: string;
  locale: string;
  format: FormFactorT;
  dimensions: Dimensions;
  slotId: string;
  frameId: string;
  templateId: string;
  layout: unknown;
  copy: Record<string, string>;
  theme: unknown;
  screenshotHash: string;
  templateSourceHash: string | null;
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortValue(obj[k])]));
  }
  return v;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function computeCacheKey(input: CacheKeyInput): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

export function identityKey(locale: string, format: string, slotId: string): string {
  return `${locale}/${format}/${slotId}`;
}

export function outputFilePath(
  outputsDir: string,
  locale: string,
  format: string,
  slotId: string,
  ext: string,
): string {
  return path.join(outputsDir, locale, format, `${slotId}.${ext}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cache.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/render/cache.ts tests/cache.test.ts
git commit -m "feat(cache): per-output SHA-256 cache key and path helpers"
```

---

## Task 4: `cacheKeyForSlot` — gather inputs from disk + config

**Files:**
- Modify: `src/render/cache.ts`
- Test: `tests/cache.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/cache.test.ts` (add `cacheKeyForSlot` to the cache import; add these imports at the top of the file):

```ts
import { projectPaths } from '../src/paths.js';
import type { Config } from '../src/config/schema.js';
import { cacheKeyForSlot } from '../src/render/cache.js';
import { MissingInputError } from '../src/errors.js';

function fixtureConfig(): Config {
  return {
    locales: ['en-US'],
    defaultLocale: 'en-US',
    formFactors: ['phone'],
    theme: { palette: { fg: '#000', accent: '#111', muted: '#222' } },
    slots: [
      {
        id: '01',
        template: 'bold-headline',
        screenshot: 'shot.png',
        frame: { id: 'pixel-9' },
        layout: {},
        copy: { headline: { 'en-US': 'Hi' } },
      },
    ],
  } as unknown as Config;
}

async function slotFixture(): Promise<{ root: string; config: Config }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-keyslot-'));
  const p = projectPaths(root);
  await fs.mkdir(path.join(p.inputs, 'en-US', 'phone'), { recursive: true });
  await fs.writeFile(path.join(p.inputs, 'en-US', 'phone', 'shot.png'), 'PNGBYTES-1');
  return { root, config: fixtureConfig() };
}

describe('cacheKeyForSlot', () => {
  const version = { tool: '0.1.0', chromium: '120' };

  it('is stable across calls and changes when the screenshot bytes change', async () => {
    const { root, config } = await slotFixture();
    const p = projectPaths(root);
    const slot = config.slots[0];
    const k1 = await cacheKeyForSlot(config, p, slot, 'en-US', 'phone', version);
    expect(await cacheKeyForSlot(config, p, slot, 'en-US', 'phone', version)).toBe(k1);
    await fs.writeFile(path.join(p.inputs, 'en-US', 'phone', 'shot.png'), 'PNGBYTES-2');
    expect(await cacheKeyForSlot(config, p, slot, 'en-US', 'phone', version)).not.toBe(k1);
  });

  it('changes when a project-local template source appears or changes', async () => {
    const { root, config } = await slotFixture();
    const p = projectPaths(root);
    const slot = config.slots[0];
    const base = await cacheKeyForSlot(config, p, slot, 'en-US', 'phone', version);
    const tplDir = path.join(p.templates, 'bold-headline');
    await fs.mkdir(tplDir, { recursive: true });
    await fs.writeFile(path.join(tplDir, 'index.ts'), 'export default {}; // v1');
    const withTpl = await cacheKeyForSlot(config, p, slot, 'en-US', 'phone', version);
    expect(withTpl).not.toBe(base);
    await fs.writeFile(path.join(tplDir, 'index.ts'), 'export default {}; // v2');
    expect(await cacheKeyForSlot(config, p, slot, 'en-US', 'phone', version)).not.toBe(withTpl);
  });

  it('changes when the version changes', async () => {
    const { root, config } = await slotFixture();
    const p = projectPaths(root);
    const slot = config.slots[0];
    const k1 = await cacheKeyForSlot(config, p, slot, 'en-US', 'phone', version);
    const k2 = await cacheKeyForSlot(config, p, slot, 'en-US', 'phone', { tool: '0.2.0', chromium: '120' });
    expect(k2).not.toBe(k1);
  });

  it('throws MissingInputError when the screenshot is absent', async () => {
    const { root, config } = await slotFixture();
    const p = projectPaths(root);
    const slot = { ...config.slots[0], screenshot: 'nope.png' };
    await expect(cacheKeyForSlot(config, p, slot, 'en-US', 'phone', version)).rejects.toBeInstanceOf(
      MissingInputError,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cache.test.ts -t cacheKeyForSlot`
Expected: FAIL — `cacheKeyForSlot` not exported.

- [ ] **Step 3: Implement `cacheKeyForSlot`**

Add imports to `src/render/cache.ts`:

```ts
import { existsSync } from 'node:fs';
import type { Config, Slot } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { resolveDimensions } from './constraints.js';
import { resolveCopy } from './compose.js';
import { versionInfo } from '../version.js';
import { MissingInputError } from '../errors.js';
```

Add the function:

```ts
async function hashFile(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

export async function cacheKeyForSlot(
  config: Config,
  paths: ProjectPaths,
  slot: Slot,
  locale: string,
  format: FormFactorT,
  version: { tool: string; chromium: string } = versionInfo(),
): Promise<string> {
  const dimensions = resolveDimensions(format);

  const screenshotPath = path.join(paths.inputs, locale, format, slot.screenshot);
  if (!existsSync(screenshotPath)) throw new MissingInputError(screenshotPath);
  const screenshotHash = await hashFile(screenshotPath);

  const localTemplate = path.join(paths.templates, slot.template, 'index.ts');
  const templateSourceHash = existsSync(localTemplate) ? await hashFile(localTemplate) : null;

  return computeCacheKey({
    cacheFormatVersion: CACHE_FORMAT_VERSION,
    tool: version.tool,
    chromium: version.chromium,
    locale,
    format,
    dimensions,
    slotId: slot.id,
    frameId: slot.frame.id,
    templateId: slot.template,
    layout: slot.layout,
    copy: resolveCopy(slot, locale, config.defaultLocale),
    theme: config.theme,
    screenshotHash,
    templateSourceHash,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cache.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/render/cache.ts tests/cache.test.ts
git commit -m "feat(cache): cacheKeyForSlot gathers screenshot/template/version inputs"
```

---

## Task 5: Wire caching into `runGenerate`

**Files:**
- Modify: `src/commands/generate.ts`
- Test: `tests/generate.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/generate.test.ts` (add `existsSync` to the `node:fs` import: `import { promises as fs, existsSync } from 'node:fs';`). These reuse the suite's `beforeAll` fixture (`root`, config `01-onboarding`, screenshot `onboarding.png`):

```ts
import { loadCacheIndex, identityKey } from '../src/render/cache.js';

describe('runGenerate caching', () => {
  it('populates the cache on first run and skips on the second', async () => {
    const p = projectPaths(root);
    await runGenerate(root, {});
    const index = await loadCacheIndex(p.cache);
    const id = identityKey('en-US', 'phone', '01-onboarding');
    expect(index.entries[id]).toBeDefined();

    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const before = (await fs.stat(out)).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    await runGenerate(root, {}); // cached: must not rewrite the file
    expect((await fs.stat(out)).mtimeMs).toBe(before);
  });

  it('re-renders when the screenshot changes', async () => {
    const p = projectPaths(root);
    await runGenerate(root, {});
    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const before = (await fs.stat(out)).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    await sharp({ create: { width: 1080, height: 2280, channels: 3, background: '#aa2255' } })
      .png().toFile(path.join(p.inputs, 'en-US', 'phone', 'onboarding.png'));
    await runGenerate(root, {});
    expect((await fs.stat(out)).mtimeMs).toBeGreaterThan(before);
  });

  it('re-renders when the output file was deleted even if the index is valid', async () => {
    const p = projectPaths(root);
    await runGenerate(root, {});
    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    await fs.rm(out);
    await runGenerate(root, {});
    expect(existsSync(out)).toBe(true);
  });

  it('--force re-renders even when cached', async () => {
    const p = projectPaths(root);
    await runGenerate(root, {});
    const out = path.join(p.outputs, 'en-US', 'phone', '01-onboarding.png');
    const before = (await fs.stat(out)).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    await runGenerate(root, { force: true });
    expect((await fs.stat(out)).mtimeMs).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/generate.test.ts -t caching`
Expected: FAIL — second run rewrites the file (no cache yet) / `force` not accepted.

- [ ] **Step 3: Rewrite `runGenerate`**

Replace the contents of `src/commands/generate.ts` with:

```ts
import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import { projectPaths } from '../paths.js';
import { loadConfig } from '../config/load.js';
import { ensureChromium } from '../render/chromium.js';
import { startRenderServer } from '../render/server.js';
import { renderSlot } from '../render/renderSlot.js';
import { closeBrowser } from '../render/browser.js';
import { extFor } from '../render/constraints.js';
import type { FormFactorT } from '../config/schema.js';
import { validateSlotTemplates } from '../templates/validate.js';
import { versionInfo } from '../version.js';
import {
  loadCacheIndex,
  saveCacheIndex,
  cacheKeyForSlot,
  identityKey,
  outputFilePath,
} from '../render/cache.js';

export interface GenerateOptions {
  locale?: string;
  format?: FormFactorT;
  slot?: string;
  force?: boolean;
}

export async function runGenerate(root: string, opts: GenerateOptions): Promise<void> {
  const paths = projectPaths(root);
  const config = await loadConfig(paths.config);
  await validateSlotTemplates(config, paths);

  const locales = opts.locale ? [opts.locale] : config.locales;
  const formats = opts.format ? [opts.format] : config.formFactors;
  const slots = opts.slot ? config.slots.filter((s) => s.id === opts.slot) : config.slots;

  await ensureChromium();
  const server = await startRenderServer({ config, paths });

  const index = await loadCacheIndex(paths.cache);
  const version = versionInfo();
  let rendered = 0;
  let cached = 0;

  try {
    for (const slot of slots) {
      for (const locale of locales) {
        for (const format of formats) {
          const id = identityKey(locale, format, slot.id);
          const key = await cacheKeyForSlot(config, paths, slot, locale, format, version);
          const entry = index.entries[id];

          if (
            !opts.force &&
            entry &&
            entry.key === key &&
            existsSync(outputFilePath(paths.outputs, locale, format, slot.id, entry.ext))
          ) {
            cached++;
            console.error(`↳ cached ${id}`);
            continue;
          }

          const buf = await renderSlot(server, slot.id, locale, format);
          const ext = extFor(buf);
          const outDir = path.join(paths.outputs, locale, format);
          await fs.mkdir(outDir, { recursive: true });
          await fs.writeFile(path.join(outDir, `${slot.id}.${ext}`), buf);

          // Drop a stale sibling if the format flipped between png and jpg.
          const otherExt = ext === 'png' ? 'jpg' : 'png';
          const stale = path.join(outDir, `${slot.id}.${otherExt}`);
          if (existsSync(stale)) await fs.rm(stale, { force: true });

          index.entries[id] = { key, ext };
          await saveCacheIndex(paths.cache, index);
          rendered++;
          console.error(`✓ ${id}`);
        }
      }
    }
  } finally {
    await server.close();
    await closeBrowser();
  }

  console.error(`Rendered ${rendered}, cached ${cached}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/generate.test.ts && npm run typecheck`
Expected: PASS (original "writes a valid phone PNG" plus the 4 caching tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/commands/generate.ts tests/generate.test.ts
git commit -m "feat(generate): skip unchanged slots via the render cache (+ --force)"
```

---

## Task 6: Add `--force` to the CLI

**Files:**
- Modify: `src/cli.ts`
- Test: `tests/cli.smoke.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/cli.smoke.test.ts` (inside the `describe('CLI smoke', ...)` block). It reuses the file's existing `cli(args, cwd)` helper and the `init`-scaffolded project pattern from the "init then generate produces an output PNG" test:

```ts
it('caches on re-run and accepts --force', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-cli-cache-'));
  expect((await cli(['init'], root)).exitCode).toBe(0);

  const first = await cli(['generate'], root);
  expect(first.exitCode).toBe(0);
  expect(first.stderr).toContain('Rendered');

  const second = await cli(['generate'], root);
  expect(second.exitCode).toBe(0);
  expect(second.stderr).toContain('cached');

  const forced = await cli(['generate', '--force'], root);
  expect(forced.exitCode).toBe(0);
}, 120_000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli.smoke.test.ts -t force`
Expected: FAIL — `--force` is an unknown option (Commander errors, non-zero exit) and/or the second run shows no `cached` line.

- [ ] **Step 3: Add the flag**

In `src/cli.ts`, in the `generate` command definition, add the option and thread it through. After the existing `--slot` option line add:

```ts
  .option('--force', 'ignore the cache and re-render every slot')
```

Update the action signature and call:

```ts
  .action(async (opts: { locale?: string; format?: string; slot?: string; force?: boolean }) => {
    await guard(() =>
      runGenerate(process.cwd(), {
        locale: opts.locale,
        format: opts.format as FormFactorT | undefined,
        slot: opts.slot,
        force: opts.force,
      }),
    );
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cli.smoke.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/cli.smoke.test.ts
git commit -m "feat(cli): add generate --force to bypass the cache"
```

---

## Task 7: `clean --cache` clears a populated cache

**Files:**
- Test: `tests/clean.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/clean.test.ts` (uses `saveCacheIndex` to populate a real index):

```ts
import { saveCacheIndex, loadCacheIndex, CACHE_INDEX_VERSION } from '../src/render/cache.js';

it('clears a populated cache index with --cache', async () => {
  const { root, p, chromiumDir } = await makeFixture();
  await saveCacheIndex(p.cache, {
    version: CACHE_INDEX_VERSION,
    entries: { 'en-US/phone/01': { key: 'k', ext: 'png' } },
  });
  await runClean(root, { cache: true }, chromiumDir);
  expect(existsSync(p.cache)).toBe(false);
  expect(await loadCacheIndex(p.cache)).toEqual({ version: CACHE_INDEX_VERSION, entries: {} });
});
```

- [ ] **Step 2: Run test to verify it fails OR passes**

Run: `npx vitest run tests/clean.test.ts`
Expected: PASS — `clean --cache` already removes `.cache/`; this test documents/guards that it clears a *populated* index. (If it fails, fix `runClean`; per current code it should pass.)

- [ ] **Step 3: No implementation change expected**

`runClean` already removes `paths.cache`. If the test passes, proceed. Only edit `src/commands/clean.ts` if it fails.

- [ ] **Step 4: Re-run to confirm**

Run: `npx vitest run tests/clean.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add tests/clean.test.ts
git commit -m "test(clean): guard that --cache clears a populated cache index"
```

---

## Task 8: Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update README**

In `README.md`: remove the limitation stating every `generate` re-renders everything. Add caching behavior near the `generate` docs, e.g.:

```markdown
### Caching

`generate` caches each rendered output and re-renders only what changed. A re-run skips any
slot whose config, copy, screenshot, template, frame, theme, and tool/Chromium versions are
unchanged and whose output file is still present. The cache index lives at
`play-screenshots/.cache/index.json`.

- `screenshot-composer generate --force` ignores the cache and re-renders everything.
- `screenshot-composer clean --cache` clears the cache.
```

Grep first to find and remove the stale limitation:

Run: `grep -rni "re-render\|every run\|from scratch\|caching" README.md`

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`:
- Add `src/render/cache.ts` to the module map: *"Cache key (per output) + index load/save; `cacheKeyForSlot` gathers screenshot/template/version inputs."*
- In the render-pipeline section, note that `generate` consults `play-screenshots/.cache/index.json` and renders a slot only on a key miss or missing output; `--force` bypasses it.
- Add a gotcha: *"Project-local templates are fingerprinted by `templates/<id>/index.ts` only — editing a file it imports won't bust the cache; use `--force`."*
- Update the status line: Milestone 6 caching is now implemented (Fastlane import still pending).

- [ ] **Step 3: Verify the docs reference reality**

Run: `grep -n "cache" README.md CLAUDE.md`
Expected: caching documented in both; no remaining "re-renders everything" claim.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document render caching and the --force flag"
```

---

## Final verification

- [ ] **Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass (including the new cache/generate/clean tests), typecheck clean.

- [ ] **Manual smoke (optional)**

Run `npm run cli -- generate` twice in a scratch project; the second run should print `↳ cached …` lines and `Rendered 0, cached N`. `npm run cli -- generate --force` should re-render and print `Rendered N, cached 0`.

---

## Notes / backlog

- The version-busts-the-cache behavior is proven at the unit level (`cacheKeyForSlot` with a
  differing `version` arg) rather than via a full re-render, since `runGenerate` reads
  `versionInfo()` internally.
- Project-local template imports beyond `index.ts` are not fingerprinted (documented
  limitation; `--force` is the escape hatch).
- Tablet/other form factors remain phone-only (`resolveDimensions`); caching keys already
  include `format` + dimensions, so they extend cleanly when Milestone 5 lands.
