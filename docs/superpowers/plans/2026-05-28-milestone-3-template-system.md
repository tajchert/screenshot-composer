# Milestone 3 — Template System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make templates pluggable — a stable `TemplateProps`/`TemplateMeta` contract, a project-local-first resolver, generalized copy, and three polished built-in templates (`bold-headline`, `showcase`, `overlap`).

**Architecture:** A template is a plain module whose **default export** is a `TemplateModule` (`{ meta, render }`). Built-ins are statically registered in `src/templates/registry.ts`; project-local templates under `play-screenshots/templates/<id>/index.ts` are loaded via jiti (same loader as the config) and shadow built-ins of the same id. `compose.ts` resolves the template, builds a locale-resolved `copy` map, and calls `render(props)`. No React, no Vite — typed HTML-string functions (see `docs/superpowers/specs/2026-05-28-templates-and-frames-design.md` §M3.0).

**Tech Stack:** TypeScript (ESM, `.js`-pointing-at-`.ts` imports), jiti, Zod (unchanged), Vitest, Playwright/Chromium (existing render-matrix test).

---

## File structure

| Path | Responsibility | Action |
|---|---|---|
| `src/templates/types.ts` | `TemplateProps`, `TemplateMeta`, `TemplateModule` interfaces | Create |
| `src/templates/shared.ts` | `escapeHtml`, `backgroundCss`, `computeDevice`, `deviceTransform`, `deviceMarkup`, `readyScript` | Create |
| `src/templates/bold-headline/index.ts` | Refactor of the existing template into module shape | Create (replaces `render.ts`) |
| `src/templates/bold-headline/render.ts` | Old HTML-string template | Delete |
| `src/templates/showcase/index.ts` | New built-in: eyebrow + headline + subhead over a tilted device | Create |
| `src/templates/overlap/index.ts` | New built-in: oversized headline watermark behind a floating device | Create |
| `src/templates/registry.ts` | Add `BUILTIN_MODULES` map; derive `BUILTIN_TEMPLATES` from it | Modify |
| `src/templates/resolve.ts` | `resolveTemplate(id, paths)` — project-local (jiti) then built-in | Create |
| `src/templates/validate.ts` | `validateSlotTemplates(config, paths)` — required-copy check | Create |
| `src/render/compose.ts` | Use resolver + build `copy` map; drop hard-coded branch | Modify |
| `src/commands/generate.ts` | Call `validateSlotTemplates` before Chromium launch | Modify |
| `tests/shared.test.ts` | Unit tests for `shared.ts` pure helpers | Create |
| `tests/template.test.ts` | Update to new module shape | Modify |
| `tests/resolve.test.ts` | Resolver units | Create |
| `tests/validate.test.ts` | Required-copy validation units | Create |
| `tests/templates/builtins.test.ts` | `render()` units for all three built-ins | Create |
| `tests/compose.test.ts` | Keep passing under new compose wiring | Modify (if needed) |

---

### Task 1: Shared types and HTML helpers

**Files:**
- Create: `src/templates/types.ts`
- Create: `src/templates/shared.ts`
- Test: `tests/shared.test.ts`

- [ ] **Step 1: Create the types file**

`src/templates/types.ts`:

```ts
export interface TemplateProps {
  width: number;
  height: number;
  copy: Record<string, string>;
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

export interface TemplateMeta {
  id: string;
  displayName: string;
  description: string;
  copyFields: { key: string; label: string; required: boolean }[];
}

export interface TemplateModule {
  meta: TemplateMeta;
  render: (props: TemplateProps) => string;
}
```

- [ ] **Step 2: Write the failing test for shared helpers**

`tests/shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  backgroundCss,
  computeDevice,
  deviceTransform,
  deviceMarkup,
  readyScript,
} from '../src/templates/shared.js';
import type { TemplateProps } from '../src/templates/types.js';

const frame: TemplateProps['frame'] = {
  intrinsic: { width: 800, height: 1700 },
  screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
  svg: '<svg viewBox="0 0 800 1700"></svg>',
};

describe('shared template helpers', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<b> & "x"')).toBe('&lt;b&gt; &amp; &quot;x&quot;');
  });

  it('builds gradient and solid backgrounds', () => {
    expect(backgroundCss({ type: 'gradient', direction: 135, stops: ['#000', '#fff'] }))
      .toBe('linear-gradient(135deg, #000, #fff)');
    expect(backgroundCss({ type: 'solid', color: '#123456' })).toBe('#123456');
  });

  it('computes device metrics from intrinsic size + screen rect', () => {
    const m = computeDevice(frame, 1000);
    expect(m.deviceHeight).toBe(1000);
    expect(m.deviceWidth).toBe(Math.round((1000 * 800) / 1700));
    expect(m.screenLeft).toBeCloseTo((28 / 800) * 100);
    expect(m.screenW).toBeCloseTo((744 / 800) * 100);
  });

  it('builds the CSS transform from layout', () => {
    const t = deviceTransform({ tilt: { x: 4, y: -18, z: 0 }, translate: { x: 0, y: 40 }, perspective: 2000 });
    expect(t).toContain('perspective(2000px)');
    expect(t).toContain('rotateX(4deg)');
    expect(t).toContain('rotateY(-18deg)');
    expect(t).toContain('translate(0px, 40px)');
  });

  it('emits device markup containing the screenshot and frame svg', () => {
    const m = computeDevice(frame, 1000);
    const html = deviceMarkup('/input/en-US/phone/a.png', frame, m, 'none');
    expect(html).toContain('/input/en-US/phone/a.png');
    expect(html).toContain('viewBox="0 0 800 1700"');
  });

  it('emits a readiness script setting __READY__', () => {
    expect(readyScript()).toContain('__READY__');
    expect(readyScript()).toContain('document.fonts.ready');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/shared.test.ts`
Expected: FAIL — `src/templates/shared.js` does not exist.

- [ ] **Step 4: Implement `shared.ts`**

`src/templates/shared.ts`:

```ts
import type { TemplateProps } from './types.js';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export function backgroundCss(bg: TemplateProps['theme']['background']): string {
  if (bg.type === 'gradient' && bg.stops && bg.stops.length >= 2) {
    return `linear-gradient(${bg.direction ?? 135}deg, ${bg.stops.join(', ')})`;
  }
  return bg.color ?? '#111827';
}

export interface DeviceMetrics {
  deviceWidth: number;
  deviceHeight: number;
  screenLeft: number;
  screenTop: number;
  screenW: number;
  screenH: number;
  screenRadius: number;
}

export function computeDevice(frame: TemplateProps['frame'], deviceHeight: number): DeviceMetrics {
  const { intrinsic, screen } = frame;
  const deviceWidth = Math.round((deviceHeight * intrinsic.width) / intrinsic.height);
  return {
    deviceWidth,
    deviceHeight,
    screenLeft: (screen.x / intrinsic.width) * 100,
    screenTop: (screen.y / intrinsic.height) * 100,
    screenW: (screen.width / intrinsic.width) * 100,
    screenH: (screen.height / intrinsic.height) * 100,
    screenRadius: (screen.radius / intrinsic.width) * deviceWidth,
  };
}

export function deviceTransform(layout: TemplateProps['layout']): string {
  const { tilt, translate, perspective } = layout;
  return `perspective(${perspective}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(${tilt.z}deg) translate(${translate.x}px, ${translate.y}px)`;
}

export function deviceMarkup(
  screenshotUrl: string,
  frame: TemplateProps['frame'],
  m: DeviceMetrics,
  transform: string,
): string {
  return `<div style="position:relative;width:${m.deviceWidth}px;height:${m.deviceHeight}px;transform:${transform};transform-origin:center center;">
      <img style="position:absolute;left:${m.screenLeft}%;top:${m.screenTop}%;width:${m.screenW}%;height:${m.screenH}%;object-fit:cover;border-radius:${m.screenRadius}px;" src="${escapeHtml(screenshotUrl)}" alt="">
      <div style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">${frame.svg}</div>
    </div>`;
}

export function readyScript(): string {
  return `<script>(async()=>{await document.fonts.ready;const imgs=Array.from(document.images).filter((i)=>!i.complete);await Promise.all(imgs.map((i)=>new Promise((r)=>{i.onload=i.onerror=r;})));window.__READY__=true;})();</script>`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/shared.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/templates/types.ts src/templates/shared.ts tests/shared.test.ts
git commit -m "feat: template contract types + shared HTML helpers"
```

---

### Task 2: Refactor `bold-headline` into module shape

**Files:**
- Create: `src/templates/bold-headline/index.ts`
- Delete: `src/templates/bold-headline/render.ts`
- Modify: `tests/template.test.ts`

- [ ] **Step 1: Rewrite the test for the new shape**

Replace the entire contents of `tests/template.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import boldHeadline, { meta, render } from '../src/templates/bold-headline/index.js';
import type { TemplateProps } from '../src/templates/types.js';

const props: TemplateProps = {
  width: 1080,
  height: 1920,
  copy: { headline: 'Order in seconds' },
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

describe('bold-headline template', () => {
  it('declares meta with a required headline field', () => {
    expect(meta.id).toBe('bold-headline');
    expect(boldHeadline.meta.id).toBe('bold-headline');
    expect(meta.copyFields.find((f) => f.key === 'headline')?.required).toBe(true);
  });

  it('embeds the headline, screenshot, frame svg and readiness signal', () => {
    const html = render(props);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Order in seconds');
    expect(html).toContain('/input/en-US/phone/onboarding.png');
    expect(html).toContain('viewBox="0 0 800 1700"');
    expect(html).toContain('__READY__');
    expect(html).toContain('width: 1080px');
    expect(html).toContain('height: 1920px');
  });

  it('applies the tilt transform from layout', () => {
    const html = render(props);
    expect(html).toContain('rotateX(4deg)');
    expect(html).toContain('rotateY(-18deg)');
    expect(html).toContain('perspective(2000px)');
  });

  it('escapes special characters in the headline', () => {
    const html = render({ ...props, copy: { headline: '<b>Fast</b> & "cheap"' } });
    expect(html).toContain('&lt;b&gt;Fast&lt;/b&gt; &amp; &quot;cheap&quot;');
    expect(html).not.toContain('<b>Fast</b>');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/template.test.ts`
Expected: FAIL — `src/templates/bold-headline/index.js` does not exist.

- [ ] **Step 3: Create `bold-headline/index.ts`**

`src/templates/bold-headline/index.ts`:

```ts
import type { TemplateProps, TemplateMeta, TemplateModule } from '../types.js';
import { escapeHtml, backgroundCss, computeDevice, deviceTransform, deviceMarkup, readyScript } from '../shared.js';

export const meta: TemplateMeta = {
  id: 'bold-headline',
  displayName: 'Bold Headline',
  description: 'A large centered headline up top with the device frame rising from the bottom.',
  copyFields: [{ key: 'headline', label: 'Headline', required: true }],
};

export function render(props: TemplateProps): string {
  const { width, height, copy, screenshotUrl, frame, layout, theme } = props;
  const headline = copy.headline ?? '';
  const m = computeDevice(frame, Math.round(height * 0.72));
  const transform = deviceTransform(layout);

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
    overflow: hidden; position: relative;
  }
  .headline {
    position: absolute; top: 0; left: 0; right: 0;
    padding: 96px 80px 0; text-align: center;
    font-size: 76px; font-weight: 800; line-height: 1.05; color: #ffffff;
  }
  .stage {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: ${Math.round(height * 0.74)}px;
    display: flex; align-items: flex-end; justify-content: center;
  }
</style>
</head>
<body>
  <div class="headline">${escapeHtml(headline)}</div>
  <div class="stage">${deviceMarkup(screenshotUrl, frame, m, transform)}</div>
  ${readyScript()}
</body>
</html>`;
}

const template: TemplateModule = { meta, render };
export default template;
```

- [ ] **Step 4: Delete the old template file**

```bash
git rm src/templates/bold-headline/render.ts
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/template.test.ts`
Expected: PASS (4 tests).
(`compose.ts` still imports the old path and will fail typecheck — Task 4 fixes that. Do not run the full suite yet.)

- [ ] **Step 6: Commit**

```bash
git add src/templates/bold-headline/index.ts tests/template.test.ts
git commit -m "refactor: bold-headline as a TemplateModule using shared helpers"
```

---

### Task 3: Built-in registry + resolver

**Files:**
- Modify: `src/templates/registry.ts`
- Create: `src/templates/resolve.ts`
- Test: `tests/resolve.test.ts`

- [ ] **Step 1: Add the module map to `registry.ts`**

Replace the top of `src/templates/registry.ts` (the `BUILTIN_TEMPLATES` declaration) so the file becomes:

```ts
import { promises as fs, existsSync } from 'node:fs';
import type { ProjectPaths } from '../paths.js';
import type { TemplateModule } from './types.js';
import boldHeadline from './bold-headline/index.js';

/** Static map of built-in template id → module. Single source of truth for built-ins.
 *  Static (not dynamic globbing) so it still resolves after bundling to dist/ in M7. */
export const BUILTIN_MODULES: Record<string, TemplateModule> = {
  'bold-headline': boldHeadline,
};

/** Built-in template ids shipped with the package, derived from BUILTIN_MODULES. */
export const BUILTIN_TEMPLATES = Object.keys(BUILTIN_MODULES);

export interface TemplateInfo {
  id: string;
  source: 'built-in' | 'project';
}

/** Enumerate built-in templates plus any project-local template directories.
 *  Project-local templates shadow built-ins with the same id (listed once, as 'project'). */
export async function listTemplates(paths: ProjectPaths): Promise<TemplateInfo[]> {
  const projectEntries: TemplateInfo[] = [];
  if (existsSync(paths.templates)) {
    const entries = await fs.readdir(paths.templates, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) projectEntries.push({ id: entry.name, source: 'project' });
    }
  }
  const projectIds = new Set(projectEntries.map((e) => e.id));
  const builtins: TemplateInfo[] = BUILTIN_TEMPLATES.filter((id) => !projectIds.has(id)).map((id) => ({
    id,
    source: 'built-in' as const,
  }));
  return [...builtins, ...projectEntries];
}
```

- [ ] **Step 2: Write the failing resolver test**

`tests/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { resolveTemplate } from '../src/templates/resolve.js';
import { projectPaths } from '../src/paths.js';
import { ConfigValidationError } from '../src/errors.js';

describe('resolveTemplate', () => {
  it('resolves a built-in template by id', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-res-'));
    const tpl = await resolveTemplate('bold-headline', projectPaths(root));
    expect(tpl.meta.id).toBe('bold-headline');
    expect(typeof tpl.render).toBe('function');
  });

  it('throws ConfigValidationError on an unknown id, listing available ids', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-res2-'));
    await expect(resolveTemplate('nope', projectPaths(root))).rejects.toMatchObject({
      name: 'ConfigValidationError',
    });
    await expect(resolveTemplate('nope', projectPaths(root))).rejects.toThrow(/bold-headline/);
  });

  it('loads a project-local template that shadows a built-in id', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-res3-'));
    const p = projectPaths(root);
    const dir = path.join(p.templates, 'bold-headline');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'index.ts'),
      `export const meta = { id: 'bold-headline', displayName: 'Local', description: 'x', copyFields: [] };
export function render() { return '<!DOCTYPE html><html><body>LOCAL-OVERRIDE</body></html>'; }
export default { meta, render };
`,
    );
    const tpl = await resolveTemplate('bold-headline', p);
    expect(tpl.meta.displayName).toBe('Local');
    expect(tpl.render({} as never)).toContain('LOCAL-OVERRIDE');
  });

  it('throws ConfigValidationError when a project template lacks meta/render', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-res4-'));
    const p = projectPaths(root);
    const dir = path.join(p.templates, 'broken');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.ts'), `export default { nope: true };\n`);
    await expect(resolveTemplate('broken', p)).rejects.toBeInstanceOf(ConfigValidationError);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/resolve.test.ts`
Expected: FAIL — `src/templates/resolve.js` does not exist.

- [ ] **Step 4: Implement `resolve.ts`**

`src/templates/resolve.ts`:

```ts
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import type { ProjectPaths } from '../paths.js';
import type { TemplateModule } from './types.js';
import { BUILTIN_MODULES } from './registry.js';
import { ConfigValidationError } from '../errors.js';

// Mirror the config loader: alias the package specifier to the source entry so a
// project template that imports type-only symbols from 'screenshot-composer' resolves.
const SELF_ALIAS = fileURLToPath(new URL('../index.ts', import.meta.url));

export async function resolveTemplate(id: string, paths: ProjectPaths): Promise<TemplateModule> {
  const localEntry = path.join(paths.templates, id, 'index.ts');
  if (existsSync(localEntry)) {
    const jiti = createJiti(import.meta.url, {
      interopDefault: true,
      alias: { 'screenshot-composer': SELF_ALIAS },
    });
    let mod: unknown;
    try {
      mod = await jiti.import(localEntry, { default: true });
    } catch (err) {
      throw new ConfigValidationError(localEntry, `Could not load project template '${id}'\n  ${(err as Error).message}`);
    }
    const candidate = mod as Partial<TemplateModule>;
    if (!candidate || typeof candidate.render !== 'function' || !candidate.meta) {
      throw new ConfigValidationError(localEntry, `Project template '${id}' must default-export { meta, render }.`);
    }
    return candidate as TemplateModule;
  }

  const builtin = BUILTIN_MODULES[id];
  if (builtin) return builtin;

  const available = Object.keys(BUILTIN_MODULES).sort().join(', ');
  throw new ConfigValidationError(
    paths.config,
    `Unknown template '${id}'. Available built-ins: ${available}. Project templates live in ${paths.templates}/<id>/index.ts.`,
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/resolve.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the templates-list test for regressions**

Run: `npx vitest run tests/templates-list.test.ts`
Expected: PASS — `BUILTIN_TEMPLATES` still contains `bold-headline`.

- [ ] **Step 7: Commit**

```bash
git add src/templates/registry.ts src/templates/resolve.ts tests/resolve.test.ts
git commit -m "feat: built-in template registry + project-local-first resolver"
```

---

### Task 4: Wire `compose.ts` to the resolver

**Files:**
- Modify: `src/render/compose.ts`
- Test: `tests/compose.test.ts` (should already pass; verify)

- [ ] **Step 1: Rewrite `composeSlotHtml`**

Replace `src/render/compose.ts` entirely:

```ts
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Config, FormFactorT } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { loadFrame } from '../frames/load.js';
import { resolveTemplate } from '../templates/resolve.js';
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

  const filePath = inputFilePath(paths, ref.locale, ref.format, slot.screenshot);
  if (!existsSync(filePath)) throw new MissingInputError(filePath);

  const { width, height } = resolveDimensions(ref.format);
  const { manifest, svg } = await loadFrame(slot.frame.id, slot.frame.color);
  const template = await resolveTemplate(slot.template, paths);

  // Resolve every declared copy key for this locale, falling back to defaultLocale.
  const copy: Record<string, string> = {};
  for (const key of Object.keys(slot.copy)) {
    copy[key] = slot.copy[key]?.[ref.locale] ?? slot.copy[key]?.[config.defaultLocale] ?? '';
  }

  return template.render({
    width,
    height,
    copy,
    screenshotUrl: inputUrl(ref.locale, ref.format, slot.screenshot),
    frame: { intrinsic: manifest.intrinsic, screen: manifest.screen, svg },
    layout: slot.layout,
    theme: config.theme,
  });
}
```

- [ ] **Step 2: Run the compose test**

Run: `npx vitest run tests/compose.test.ts`
Expected: PASS — the fixture config uses `bold-headline`; the headline `Order in seconds` still renders. If the test imported `TemplateProps` from the old `render.js`, remove that import (it does not in the current file).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (exit 0) — no remaining references to `bold-headline/render.js`.

- [ ] **Step 4: Commit**

```bash
git add src/render/compose.ts
git commit -m "feat: compose resolves templates via resolver + builds locale copy map"
```

---

### Task 5: Pre-render required-copy validation

**Files:**
- Create: `src/templates/validate.ts`
- Modify: `src/commands/generate.ts`
- Test: `tests/validate.test.ts`

- [ ] **Step 1: Write the failing validation test**

`tests/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { validateSlotTemplates } from '../src/templates/validate.js';
import { projectPaths } from '../src/paths.js';
import { ConfigValidationError } from '../src/errors.js';
import type { Config } from '../src/config/schema.js';

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    locales: ['en-US'],
    defaultLocale: 'en-US',
    formFactors: ['phone'],
    paths: { inputs: './inputs', outputs: './outputs', templates: './templates', assets: './assets' },
    theme: {
      fontFamily: 'system-ui',
      palette: { fg: '#000', accent: '#111', muted: '#222' },
      background: { type: 'solid', color: '#fff' },
    },
    slots: [
      {
        id: '01',
        template: 'bold-headline',
        screenshot: 'a.png',
        frame: { id: 'pixel-9' },
        layout: { tilt: { x: 0, y: 0, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 },
        copy: { headline: { 'en-US': 'Hi' } },
      },
    ],
    ...overrides,
  } as Config;
}

describe('validateSlotTemplates', () => {
  it('passes when all required copy fields are present', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-val-'));
    await expect(validateSlotTemplates(baseConfig(), projectPaths(root))).resolves.toBeUndefined();
  });

  it('throws ConfigValidationError when a required copy field is missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-val2-'));
    const config = baseConfig();
    config.slots[0].copy = {}; // no headline
    await expect(validateSlotTemplates(config, projectPaths(root))).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(validateSlotTemplates(config, projectPaths(root))).rejects.toThrow(/headline/);
  });

  it('throws ConfigValidationError on an unknown template id', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-val3-'));
    const config = baseConfig();
    config.slots[0].template = 'ghost';
    await expect(validateSlotTemplates(config, projectPaths(root))).rejects.toBeInstanceOf(ConfigValidationError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/validate.test.ts`
Expected: FAIL — `src/templates/validate.js` does not exist.

- [ ] **Step 3: Implement `validate.ts`**

`src/templates/validate.ts`:

```ts
import type { Config } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { resolveTemplate } from './resolve.js';
import { ConfigValidationError } from '../errors.js';

/** Resolve each slot's template (throws on unknown id) and assert that every
 *  required copy field has a non-empty value for the default locale. */
export async function validateSlotTemplates(config: Config, paths: ProjectPaths): Promise<void> {
  for (const slot of config.slots) {
    const template = await resolveTemplate(slot.template, paths);
    for (const field of template.meta.copyFields) {
      if (!field.required) continue;
      const value = slot.copy[field.key]?.[config.defaultLocale];
      if (!value || value.trim() === '') {
        throw new ConfigValidationError(
          paths.config,
          `Slot '${slot.id}' (template '${slot.template}') is missing required copy '${field.key}' for default locale '${config.defaultLocale}'.`,
        );
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/validate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Call it from `generate.ts`**

In `src/commands/generate.ts`, add the import near the other imports:

```ts
import { validateSlotTemplates } from '../templates/validate.js';
```

Then, immediately after `const config = await loadConfig(paths.config);`, add:

```ts
  await validateSlotTemplates(config, paths);
```

- [ ] **Step 6: Run the generate test for regressions**

Run: `npx vitest run tests/generate.test.ts`
Expected: PASS — the fixture config has a valid headline, so validation is a no-op there.

- [ ] **Step 7: Commit**

```bash
git add src/templates/validate.ts src/commands/generate.ts tests/validate.test.ts
git commit -m "feat: validate required template copy before rendering"
```

---

### Task 6: `showcase` template

**Files:**
- Create: `src/templates/showcase/index.ts`
- Modify: `src/templates/registry.ts`
- Test: `tests/templates/builtins.test.ts` (created here; extended in Task 7)

- [ ] **Step 1: Write the failing built-ins test (showcase portion)**

`tests/templates/builtins.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import showcase from '../../src/templates/showcase/index.js';
import type { TemplateProps } from '../../src/templates/types.js';

const baseProps: Omit<TemplateProps, 'copy'> = {
  width: 1080,
  height: 1920,
  screenshotUrl: '/input/en-US/phone/onboarding.png',
  frame: {
    intrinsic: { width: 800, height: 1700 },
    screen: { x: 28, y: 30, width: 744, height: 1640, radius: 44 },
    svg: '<svg viewBox="0 0 800 1700"></svg>',
  },
  layout: { tilt: { x: 0, y: -8, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 },
  theme: {
    fontFamily: 'Inter',
    palette: { fg: '#FFFFFF', accent: '#818CF8', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 160, stops: ['#0F172A', '#1E293B'] },
  },
};

describe('showcase template', () => {
  const props: TemplateProps = { ...baseProps, copy: { eyebrow: 'Fast & simple', headline: 'Everything in one tap', subhead: 'Reorder favourites instantly.' } };

  it('declares meta: headline required, eyebrow + subhead optional', () => {
    expect(showcase.meta.id).toBe('showcase');
    const f = (k: string) => showcase.meta.copyFields.find((x) => x.key === k);
    expect(f('headline')?.required).toBe(true);
    expect(f('eyebrow')?.required).toBe(false);
    expect(f('subhead')?.required).toBe(false);
  });

  it('renders all copy fields, the screenshot, frame and readiness signal', () => {
    const html = showcase.render(props);
    expect(html).toContain('Fast &amp; simple');
    expect(html).toContain('Everything in one tap');
    expect(html).toContain('Reorder favourites instantly.');
    expect(html).toContain('/input/en-US/phone/onboarding.png');
    expect(html).toContain('viewBox="0 0 800 1700"');
    expect(html).toContain('__READY__');
    expect(html).toContain('width: 1080px');
  });

  it('omits optional copy markup when absent and never emits remote URLs', () => {
    const html = showcase.render({ ...baseProps, copy: { headline: 'Only headline' } });
    expect(html).toContain('Only headline');
    expect(html).not.toMatch(/https?:\/\//);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/templates/builtins.test.ts`
Expected: FAIL — `src/templates/showcase/index.js` does not exist.

- [ ] **Step 3: Implement `showcase/index.ts`**

`src/templates/showcase/index.ts`:

```ts
import type { TemplateProps, TemplateMeta, TemplateModule } from '../types.js';
import { escapeHtml, backgroundCss, computeDevice, deviceTransform, deviceMarkup, readyScript } from '../shared.js';

export const meta: TemplateMeta = {
  id: 'showcase',
  displayName: 'Showcase',
  description: 'Eyebrow, headline and subhead stacked above a tilted device. Editorial; uses subtext.',
  copyFields: [
    { key: 'eyebrow', label: 'Eyebrow', required: false },
    { key: 'headline', label: 'Headline', required: true },
    { key: 'subhead', label: 'Subhead', required: false },
  ],
};

export function render(props: TemplateProps): string {
  const { width, height, copy, screenshotUrl, frame, layout, theme } = props;
  const m = computeDevice(frame, Math.round(height * 0.6));
  const transform = deviceTransform(layout);

  const eyebrow = copy.eyebrow
    ? `<div class="eyebrow">${escapeHtml(copy.eyebrow)}</div>`
    : '';
  const subhead = copy.subhead
    ? `<div class="subhead">${escapeHtml(copy.subhead)}</div>`
    : '';

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
    overflow: hidden; position: relative;
  }
  .copy { position: absolute; top: 110px; left: 96px; right: 96px; }
  .eyebrow {
    font-size: 30px; letter-spacing: 0.12em; text-transform: uppercase;
    font-weight: 700; color: ${theme.palette.accent}; margin-bottom: 18px;
  }
  .headline { font-size: 84px; font-weight: 800; line-height: 1.04; }
  .subhead { font-size: 38px; font-weight: 500; line-height: 1.3; margin-top: 24px; color: ${theme.palette.muted}; }
  .stage {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: ${Math.round(height * 0.6)}px;
    display: flex; align-items: flex-end; justify-content: center;
  }
</style>
</head>
<body>
  <div class="copy">
    ${eyebrow}
    <div class="headline">${escapeHtml(copy.headline ?? '')}</div>
    ${subhead}
  </div>
  <div class="stage">${deviceMarkup(screenshotUrl, frame, m, transform)}</div>
  ${readyScript()}
</body>
</html>`;
}

const template: TemplateModule = { meta, render };
export default template;
```

- [ ] **Step 4: Register it in `registry.ts`**

In `src/templates/registry.ts`, add the import below the `boldHeadline` import:

```ts
import showcase from './showcase/index.js';
```

and add it to the map:

```ts
export const BUILTIN_MODULES: Record<string, TemplateModule> = {
  'bold-headline': boldHeadline,
  showcase,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/templates/builtins.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/templates/showcase/index.ts src/templates/registry.ts tests/templates/builtins.test.ts
git commit -m "feat: add 'showcase' built-in template"
```

---

### Task 7: `overlap` template

**Files:**
- Create: `src/templates/overlap/index.ts`
- Modify: `src/templates/registry.ts`
- Modify: `tests/templates/builtins.test.ts`

- [ ] **Step 1: Append the failing overlap test**

Add to `tests/templates/builtins.test.ts` (after the `showcase` describe block), and add the import at the top alongside the existing `showcase` import:

```ts
import overlap from '../../src/templates/overlap/index.js';
```

```ts
describe('overlap template', () => {
  const props: TemplateProps = { ...baseProps, copy: { headline: 'SHOP', subhead: 'Now in your pocket' } };

  it('declares meta: headline required, subhead optional', () => {
    expect(overlap.meta.id).toBe('overlap');
    const f = (k: string) => overlap.meta.copyFields.find((x) => x.key === k);
    expect(f('headline')?.required).toBe(true);
    expect(f('subhead')?.required).toBe(false);
  });

  it('renders the headline (watermark + accessible copy), screenshot, frame and readiness', () => {
    const html = overlap.render(props);
    expect(html).toContain('SHOP');
    expect(html).toContain('Now in your pocket');
    expect(html).toContain('/input/en-US/phone/onboarding.png');
    expect(html).toContain('viewBox="0 0 800 1700"');
    expect(html).toContain('__READY__');
    expect(html).not.toMatch(/https?:\/\//);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/templates/builtins.test.ts`
Expected: FAIL — `src/templates/overlap/index.js` does not exist.

- [ ] **Step 3: Implement `overlap/index.ts`**

`src/templates/overlap/index.ts`:

```ts
import type { TemplateProps, TemplateMeta, TemplateModule } from '../types.js';
import { escapeHtml, backgroundCss, computeDevice, deviceTransform, deviceMarkup, readyScript } from '../shared.js';

export const meta: TemplateMeta = {
  id: 'overlap',
  displayName: 'Floating Overlap',
  description: 'An oversized headline watermark behind a floating, shadowed device with accent blobs.',
  copyFields: [
    { key: 'headline', label: 'Headline', required: true },
    { key: 'subhead', label: 'Subhead', required: false },
  ],
};

export function render(props: TemplateProps): string {
  const { width, height, copy, screenshotUrl, frame, layout, theme } = props;
  const headline = copy.headline ?? '';
  const m = computeDevice(frame, Math.round(height * 0.66));
  const transform = deviceTransform(layout);

  const subhead = copy.subhead
    ? `<div class="subhead">${escapeHtml(copy.subhead)}</div>`
    : '';

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
    overflow: hidden; position: relative;
  }
  .blob { position: absolute; border-radius: 50%; filter: blur(8px); opacity: 0.5; background: ${theme.palette.accent}; }
  .blob.a { width: 620px; height: 360px; top: 60px; left: -120px; }
  .blob.b { width: 480px; height: 480px; bottom: -120px; right: -100px; }
  .watermark {
    position: absolute; top: 12%; left: 0; right: 0; text-align: center;
    font-size: 280px; font-weight: 900; line-height: 1; letter-spacing: -0.02em;
    color: ${theme.palette.fg}; opacity: 0.12; white-space: nowrap; overflow: hidden;
  }
  .stage {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .device-wrap { filter: drop-shadow(0 40px 80px rgba(0,0,0,0.45)); }
  .subhead {
    position: absolute; bottom: 90px; left: 96px; right: 96px; text-align: center;
    font-size: 40px; font-weight: 600; color: ${theme.palette.fg};
  }
</style>
</head>
<body>
  <div class="blob a"></div>
  <div class="blob b"></div>
  <div class="watermark">${escapeHtml(headline)}</div>
  <div class="stage"><div class="device-wrap">${deviceMarkup(screenshotUrl, frame, m, transform)}</div></div>
  ${subhead}
  ${readyScript()}
</body>
</html>`;
}

const template: TemplateModule = { meta, render };
export default template;
```

- [ ] **Step 4: Register it in `registry.ts`**

Add the import and map entry in `src/templates/registry.ts`:

```ts
import overlap from './overlap/index.js';
```

```ts
export const BUILTIN_MODULES: Record<string, TemplateModule> = {
  'bold-headline': boldHeadline,
  showcase,
  overlap,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/templates/builtins.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 6: Commit**

```bash
git add src/templates/overlap/index.ts src/templates/registry.ts tests/templates/builtins.test.ts
git commit -m "feat: add 'overlap' built-in template"
```

---

### Task 8: Render-matrix integration, CLI list, docs, and full verification

**Files:**
- Modify: `tests/renderSlot.test.ts` (extend across templates)
- Modify: `CLAUDE.md` (drop the React/Vite plan; record the typed-function decision)
- Test: full suite + typecheck

- [ ] **Step 1: Inspect the existing render integration test**

Run: `sed -n '1,80p' tests/renderSlot.test.ts`
Expected: shows how a slot is rendered through real Chromium and asserted to be a valid PNG. Note the helper that builds a temp project + config so you can parameterize the template id.

- [ ] **Step 2: Add a parameterized render test across the three built-ins**

Add this block to `tests/renderSlot.test.ts` (adapt the temp-project/config setup to match the file's existing helpers — reuse its `beforeAll` fixtures; only the slot's `template` value changes per case):

```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

describe('renderSlot across built-in templates', () => {
  for (const template of ['bold-headline', 'showcase', 'overlap'] as const) {
    it(`renders a valid in-constraint PNG with '${template}'`, async () => {
      // Build a temp project whose single slot uses `template`, start the render
      // server, renderSlot('01', 'en-US', 'phone'), then assert the buffer is a
      // PNG of the expected phone dimensions and under 8 MB.
      // (Reuse the file's existing project-setup + server-start helpers.)
      const buf = await renderTemplateToBuffer(template); // helper defined alongside existing setup
      const meta = await sharp(buf).metadata();
      expect(meta.format).toBe('png');
      expect(buf.byteLength).toBeLessThan(8 * 1024 * 1024);
    }, 180_000);
  }
});
```

If `renderSlot.test.ts` does not already expose a reusable `renderTemplateToBuffer`-style helper, add one next to its existing setup: it copies the fixture inputs, writes a config whose slot's `template` is the parameter (with `copy: { eyebrow, headline, subhead }` so every template has its fields), starts the server via the same call the file already uses, and returns the `renderSlot(...)` buffer. Keep the existing single-template test intact.

- [ ] **Step 3: Run the render-matrix test (real Chromium)**

Run: `npx vitest run tests/renderSlot.test.ts`
Expected: PASS — all three templates produce valid PNGs. First run may download Chromium (timeout is 180s).

- [ ] **Step 4: Update `CLAUDE.md`**

In `CLAUDE.md`, make these edits so the doc matches reality:

1. In the architecture diagram / "render pipeline" prose, replace the note that "Milestone 3 will swap the HTML-string template for React + Tailwind via Vite SSR" with:

   > Templates are typed HTML-string modules (`TemplateModule` = `{ meta, render(props): string }`). Built-ins live in `src/templates/<id>/`; project-local templates under `play-screenshots/templates/<id>/index.ts` are loaded via jiti and shadow built-ins. The `/render?slot&locale&format` route is unchanged.

2. In the module map table, replace the `src/templates/bold-headline/render.ts` row and add rows:

   | `src/templates/types.ts` | `TemplateProps`/`TemplateMeta`/`TemplateModule` contract |
   | `src/templates/shared.ts` | `escapeHtml`, `backgroundCss`, device-metrics + markup, readiness script |
   | `src/templates/<id>/index.ts` | A built-in template (`bold-headline`, `showcase`, `overlap`): default-exports `{ meta, render }` |
   | `src/templates/resolve.ts` | `resolveTemplate(id, paths)` — project-local (jiti) then built-in |
   | `src/templates/validate.ts` | `validateSlotTemplates()` — required-copy preflight |

3. In the "How to add a template" section, replace the "partly future work" framing with the real contract: create `src/templates/<id>/index.ts` default-exporting `{ meta, render }` (use `shared.ts` helpers), register it in `BUILTIN_MODULES` in `registry.ts`; or drop a project-local one in `play-screenshots/templates/<id>/index.ts` to shadow a built-in. Note `compose.ts` now resolves any template id.

4. Update the "Current state" line to: **Milestones 1–3 complete**; next is **Milestone 4 (device frames)**.

- [ ] **Step 5: Full suite**

Run: `npx vitest run`
Expected: all pass (including `cli.m2.smoke` `templates list` showing the three built-ins; if that smoke test asserts an exact template count or set, update its expectation to include `showcase` and `overlap`).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 7: Commit**

```bash
git add tests/renderSlot.test.ts CLAUDE.md
git commit -m "test: render matrix across built-in templates; docs: M3 template system"
```

---

## Done criteria for Milestone 3

- `compose.ts` renders any resolvable template id; unknown ids fail with exit-1 `ConfigValidationError` listing available ids.
- Project-local `play-screenshots/templates/<id>/index.ts` shadows a built-in of the same id (loaded via jiti).
- Three polished built-ins ship: `bold-headline`, `showcase`, `overlap`; `templates list` shows all three.
- Copy is generalized to a locale-resolved `Record<string,string>`; `showcase`/`overlap` use `eyebrow`/`subhead` with **no config-schema change**.
- Missing required copy is caught before Chromium launches.
- `npx vitest run` passes (incl. the three-template render matrix); `npx tsc --noEmit` is clean.
- `CLAUDE.md` reflects the typed-function template system (no React/Vite plan).

## Self-review notes

- **Spec coverage:** §M3.1 contract → Task 1; §M3.2 module shape → Task 2; §M3.3 resolver/registry → Task 3 + Task 4; §M3.4 validation → Task 5; §M3.5 three built-ins → Tasks 2/6/7; §M3.6 tests → Tasks 1–8 (units throughout + render matrix in Task 8). No gaps.
- **Type consistency:** `TemplateModule` = `{ meta, render }` default-exported everywhere; `resolveTemplate(id, paths)` and `validateSlotTemplates(config, paths)` signatures are used identically in compose/generate/tests; `computeDevice(frame, deviceHeight)` and `deviceMarkup(screenshotUrl, frame, metrics, transform)` match between `shared.ts` and all three templates.
- **Carry-over to M4:** the M4 plan adds the frame catalog; this plan leaves `loadFrame`/manifest handling untouched.
