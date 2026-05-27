# Templates & Frames — Design (Milestones 3 & 4)

**Date:** 2026-05-28
**Status:** Approved design, ready to decompose into implementation plans
**Scope:** Milestone 3 (template system) and Milestone 4 (device frame catalog)
**Relates to:** `2026-05-27-screenshot-composer-design.md` §8 (templates) and §9 (frames).
This document **refines** that master spec for these two milestones and **overrides it on
one point**: templates are authored as typed HTML-string functions, *not* React + Tailwind +
Vite SSR (see §M3.0).

---

## Why now

The core product premise is "store listings the developer's app, not a template gallery's."
Two things block that today:

1. `compose.ts` hard-codes `bold-headline` and throws on any other `template` value. Neither
   project-local nor additional built-in templates can render. One template means every app's
   store page looks identical.
2. One device frame (`pixel-9`) won't match most developers' target device or brand.

M3 makes templates pluggable and ships three polished built-ins. M4 fills out the frame
catalog. They are executed as **two sequential plans** (M3 fully, checkpoint, then M4).

---

## M3 — Template system

### M3.0 Rendering approach (overrides master spec §3/§8)

The master spec and `CLAUDE.md` envisioned React 18 + Tailwind rendered via Vite SSR behind
the `/render` route. We are **not** doing that. For a tool that emits *static images*, React's
runtime/hydration buys nothing, and Vite SSR adds a real build/bundling step that fights the
project's "no build step, jiti everywhere, dependency-light" ethos — and would force
project-local templates through a compile pipeline instead of jiti.

**Decision:** a template is a plain module exporting a `render(props): string` function plus
`meta`. Built-ins live in `src/templates/<id>/`; project-local templates are loaded by jiti
exactly like the config file. The stable `/render?slot&locale&format` contract is unchanged;
only the thing behind it changes. `CLAUDE.md` will be updated to drop the React/Vite plan.

### M3.1 Contract (`src/templates/types.ts`)

```ts
export interface TemplateProps {
  width: number;
  height: number;                            // resolved canvas px (from resolveDimensions)
  copy: Record<string, string>;              // locale-resolved copy, e.g. { headline, subhead?, eyebrow? }
  screenshotUrl: string;                     // /input/<locale>/<format>/<file>
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

**The one breaking change vs today:** `headline: string` becomes `copy: Record<string,string>`.
`compose.ts` resolves *every* copy key declared on the slot for the requested locale (falling
back to `defaultLocale`), producing the `copy` map. Templates read the keys they declare in
`meta.copyFields`. Because the config schema already stores arbitrary copy keys
(`copy: record<string, record<locale, string>>`), **no config-schema change is required** to
support `eyebrow`/`subhead` — they are just additional keys a slot may provide.

### M3.2 Template module shape

Each built-in is a directory `src/templates/<id>/index.ts` exporting `meta` and `render`
(i.e. satisfying `TemplateModule`). The existing `bold-headline/render.ts` is refactored into
this shape (its `renderHtml` becomes the module's `render`, and it gains `meta`).

### M3.3 Resolver (`src/templates/resolve.ts`)

`resolveTemplate(id, paths): Promise<TemplateModule>`:

- **Built-ins** come from a **static registry map** (`id → TemplateModule`) that statically
  imports all three modules. A static map (not dynamic path globbing) is used so resolution
  still works after bundling to `dist/` in M7.
- **Project-local** templates: if `paths.templates/<id>/index.ts` exists, it is loaded via
  **jiti** (the same loader used for the config) and **shadows** a built-in of the same id.
  This is how "developers author their own layouts."
- **Unknown id** → `ConfigValidationError` (exit code 1) whose message lists the available
  ids (built-in + project-local).

`registry.ts`'s `BUILTIN_TEMPLATES` becomes **derived from the static registry keys** (single
source of truth). `listTemplates()` keeps enumerating project-local dirs as it does today.

`compose.ts` drops the hard-coded `bold-headline` branch: it resolves the template, builds the
`copy` map, and calls `render(props)`.

### M3.4 Pre-render validation

Early in `generate` (before Chromium launches), for each slot: resolve its template and assert
that every `copyField` with `required: true` has a non-empty value (for `defaultLocale` at
minimum). A missing required field throws `ConfigValidationError` naming the slot id and field
key. This gives fast, exit-1 feedback instead of a blank render.

### M3.5 The three built-ins

All three paint `theme.background` as the base layer and use `theme.fontFamily`/`palette`.
Selected from the visual brainstorm (options A, B, D):

| id | copyFields | Look |
|---|---|---|
| `bold-headline` | headline (required) | Centered headline on top, device rising from the bottom. (Refactor of today's template.) |
| `showcase` | eyebrow (optional), headline (required), subhead (optional) | Eyebrow + headline + subhead stacked above a tilted device. Editorial; uses subtext. |
| `overlap` | headline (required), subhead (optional) | Oversized low-opacity headline "watermark" behind a floating, shadowed device; accent blobs derived from `theme.palette.accent`. |

Templates must not load remote resources or depend on `window`/media queries, and must set
`window.__READY__` after fonts+images settle (the renderer also enforces this with a 10s
timeout — unchanged).

### M3.6 Tests (TDD)

- Resolver units: built-in resolves; project-local shadows a built-in; unknown id throws
  `ConfigValidationError`.
- copyField-validation unit: required-missing throws with slot+field; optional-missing passes.
- Per-template `render()` units: output contains the declared copy, sets `__READY__`, contains
  no `http(s)://` resource URLs.
- Extend the Chromium render-matrix integration test to cover all three templates → each
  produces a valid PNG within the 8 MB constraint.
- CLI: `templates list` shows the three built-ins.

---

## M4 — Device frame catalog

The `manifest.json` + clean-room SVG format already works (`pixel-9`). M4 adds assets and
hardens the loader.

### M4.1 Visual style

**Clean & minimal**, clearly clean-room: accurate aspect ratio + corner radius, a punch-hole
camera (a pill on tablets), subtle side buttons, a matte bezel, and a transparent rounded-rect
screen cutout. No raster `<image>` elements and no remote references. `viewBox` matches the
manifest `intrinsic` size; the `screen` rect is in intrinsic coordinates.

### M4.2 Catalog (2 colors per Pixel, 1 per generic)

| Frame id | Manufacturer | Colors | Form factor | Fully rendered in M4? |
|---|---|---|---|---|
| `pixel-9` *(exists)* | Google | obsidian, porcelain | phone | ✅ |
| `pixel-9-pro` | Google | obsidian, hazel | phone | ✅ |
| `pixel-9-pro-xl` | Google | obsidian, porcelain | phone | ✅ |
| `pixel-9a` | Google | obsidian, iris | phone | ✅ |
| `pixel-tablet` | Google | porcelain, hazel | 10" tablet | ⏸ assets only |
| `generic-android` | — (neutral) | graphite | phone | ✅ |
| `generic-tablet-7` | — (neutral) | graphite | 7" tablet | ⏸ assets only |
| `generic-tablet-10` | — (neutral) | graphite | 10" tablet | ⏸ assets only |

`pixel-9` gains a second color (porcelain) to reach 2.

### M4.3 Honest scope split (phone vs tablet)

`resolveDimensions` is **phone-only** today; tablet dimensions and `deviceScaleFactor` scaling
are **Milestone 5**. Therefore:

- The **five phone frames** are fully wired, render-tested, and golden-snapshot-able in M4.
- The **three tablet frames** ship as **validated assets**: their manifests parse, their SVGs
  are well-formed and pass the no-remote/viewBox checks, and `frames list` shows them — but
  full tablet rendering is deferred to M5. We do not pretend a tablet frame renders correctly
  on a phone canvas.

### M4.4 Loader hardening

Add a small **Zod schema** for `manifest.json` (today it is an unchecked `JSON.parse` cast in
`frames/load.ts`). A malformed frame then fails loudly with a field path, and every new frame
is validated by one shared test.

### M4.5 Tests (TDD)

- Manifest-schema unit over **every** frame: `viewBox`/`intrinsic` agreement, `screen` rect
  within intrinsic bounds, `files` keys match `colors`, no `<image>`/remote in the SVG.
- `listFrames()`/`listFrameInfos()` include all eight frames.
- Render integration for **each phone frame** in a `bold-headline` slot → valid in-constraint
  PNG.
- CLI: `frames list` shows all eight.

---

## Out of scope (unchanged from master spec)

Tablet/landscape rendering and `deviceScaleFactor` (M5), theming/tilt presets beyond what
exists (M5), caching/import (M6), distribution (M7), the visual editor, Play upload, and any
iPhone/Samsung frames.
