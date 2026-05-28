# CLAUDE.md — developer & agent guide

Technical orientation for anyone (human or AI) working on `screenshot-composer`. Read this
before changing code. For user-facing usage see [README.md](README.md); for the full design
and per-milestone plans see [`docs/superpowers/`](docs/superpowers/).

## What this is, in one paragraph

A local-first, open-source CLI that renders Google Play Store listing images from a
developer's existing app screenshots. The config file in the user's repo is the source of
truth. Each "slot" is composed as an HTML page (headline + a device frame wrapping the
screenshot on a themed background, with CSS tilt), rendered by **Playwright/Chromium** at a
target resolution, and post-processed by **Sharp** to meet Play's 8 MB limit. Everything runs
in one Node process; there is no server, database, or network call at render time except the
one-time Chromium download.

**Hard scope boundaries** (do not cross without a design change): local-only, no Play upload,
we *consume* screenshots and never *capture* them, frames are clean-room SVG redrawn assets,
MIT-licensed.

## Dev workflow

No build step is needed to develop or test — TypeScript runs directly via `tsx`/Vitest.

```bash
npm install
npm test                       # vitest run (full suite; launches real Chromium for render tests)
npm run typecheck              # tsc --noEmit  (must stay clean)
npm run cli -- <cmd> [opts]    # run the CLI from source, e.g. npm run cli -- doctor
npx vitest run tests/foo.test.ts   # a single test file
```

- ESM throughout (`"type": "module"`). Imports use **`.js` extensions that point at `.ts`
  files** (idiomatic TS-ESM; both tsx and Vitest resolve them). `tsconfig` excludes
  `tests/fixtures` from typecheck (those files import the bare package specifier, resolved at
  runtime by jiti).
- The published `bin`/`main` point at `dist/`, which **does not exist yet** — building and
  packaging is Milestone 7. Run from source until then.

## Architecture & render pipeline

```
config.ts ──jiti+zod──► Config ──► render HTTP server ──Playwright──► page ──Sharp──► PNG/JPEG
                                   (/render, /input)    (Chromium)    screenshot   outputs/
```

`generate` (`src/commands/generate.ts`) orchestrates:

1. **Load + validate** the config (`src/config/load.ts`): `jiti` imports the `.ts` file (no
   build), Zod validates it (`src/config/schema.ts`). The bare specifier `screenshot-composer`
   in user configs is aliased to `src/index.ts` so `defineConfig` resolves from source.
2. **Ensure Chromium** (`src/render/chromium.ts`): downloads to `~/.screenshot-composer/chromium`
   on first run.
3. **Start the render server** (`src/render/server.ts`): a tiny `http` server serving
   - `GET /render?slot=&locale=&format=` → the composed HTML page (`src/render/compose.ts`
     → resolved `TemplateModule` via `src/templates/resolve.ts`)
   - `GET /input/<locale>/<format>/<file>` → the raw screenshot bytes (path-traversal guarded)
4. **Render each slot** (`src/render/renderSlot.ts`): open a Playwright context at the resolved
   `viewport`/`deviceScaleFactor`, navigate to `/render`, wait for readiness
   (`document.fonts.ready` + all `<img>` complete + `window.__READY__`, with a 10s timeout),
   screenshot, then `enforceConstraints` (`src/render/constraints.ts`) downsizes to JPEG only
   if a PNG would exceed 8 MB.
5. **Write** to `outputs/<locale>/<format>/<slotId>.<ext>`.

**The render-route contract (`/render?slot&locale&format`) is intentionally stable.** Templates
are typed HTML-string modules (`TemplateModule` = `{ meta, render(props): string }`). Built-ins
live in `src/templates/<id>/`; project-local templates under
`play-screenshots/templates/<id>/index.ts` are loaded via `jiti` and shadow built-ins of the
same id. The route is unchanged.

## Module map

| Path | Responsibility |
|---|---|
| `src/index.ts` | Public entry — exports `defineConfig` + config types |
| `src/cli.ts` | Commander wiring; `guard()` maps thrown errors → exit codes |
| `src/paths.ts` | `~/.screenshot-composer` (HOME/CHROMIUM/FONTS dirs) + per-project `projectPaths()` |
| `src/errors.ts` | Typed errors + `exitCodeFor()` (1 config / 2 missing input / 3 render / 4 constraint) |
| `src/version.ts` | `versionInfo()`/`formatVersion()` (tool/node/playwright/chromium) |
| `src/fsutil.ts` | `dirSize()` (recursive, never throws) |
| `src/config/schema.ts` | Zod schema, `Config`/`Slot`/`Theme` types, `defineConfig` |
| `src/config/load.ts` | jiti load + Zod validate; friendly missing-config message |
| `src/config/format-error.ts` | `formatZodError()` — multi-issue report with field paths |
| `src/render/server.ts` | `/render` + `/input` HTTP server |
| `src/render/compose.ts` | Build a slot's HTML from config + frame + template; resolves input path |
| `src/render/chromium.ts` | `ensureChromium()`, `isChromiumPresent()` |
| `src/render/browser.ts` | Playwright browser singleton (**dynamic** import — see gotchas) |
| `src/render/renderSlot.ts` | Navigate + readiness wait + screenshot + constraints |
| `src/render/constraints.ts` | `resolveDimensions()` (phone only today), `enforceConstraints()`, `extFor()` |
| `src/templates/types.ts` | `TemplateProps` / `TemplateMeta` / `TemplateModule` contract |
| `src/templates/shared.ts` | `escapeHtml`, `backgroundCss`, device metrics + markup, readiness script |
| `src/templates/<id>/index.ts` | A built-in template (`bold-headline`, `showcase`, `overlap`): default-exports `{ meta, render }` |
| `src/templates/registry.ts` | `BUILTIN_MODULES` map (single source of truth) + derived `BUILTIN_TEMPLATES` + `listTemplates()` |
| `src/templates/resolve.ts` | `resolveTemplate(id, paths)` — project-local (jiti) then built-in |
| `src/templates/validate.ts` | `validateSlotTemplates()` — required-copy preflight before Chromium launches |
| `src/frames/load.ts` | `listFrames()`, `loadManifest()`, `loadFrame()`, `listFrameInfos()` |
| `src/frames/schema.ts` | Zod `FrameManifestSchema` + inferred `FrameManifest` type |
| `src/frames/<id>/` | `manifest.json` + one clean-room `<color>.svg` per colorway (8 built-in frames) |
| `src/frames/_build/svg.ts` | Pure SVG builders (`buildPhoneSvg`, `buildTabletSvg`) — offline tooling |
| `src/frames/_build/generate.ts` | Frame generator: writes every manifest + SVG from a typed spec; run via `npm run frames:build` |
| `src/commands/*.ts` | One thin `runX()` per CLI command (init/generate/doctor/clean/templatesList/framesList) |

## Key decisions & gotchas (read before editing render code)

These are landmines discovered the hard way — code review caught them after they passed
unit tests but would have broken the real CLI:

1. **Never add a top-level `import { chromium } from 'playwright'`.** Playwright resolves
   `PLAYWRIGHT_BROWSERS_PATH` at *import* time. `src/render/browser.ts` sets the env var and
   then does `const { chromium } = await import('playwright')` so the home-dir Chromium is
   found. A static import would silently look in Playwright's default cache.
2. **In `page.evaluate`/readiness code, use string predicates, not function literals.**
   `renderSlot.ts` uses `page.waitForFunction('<expr string>', ...)`. Passing a JS function
   makes tsx/esbuild inject a `__name` helper that is undefined in the browser context and
   crashes only in the real subprocess (not under Vitest). Keep arrow functions *inside the
   string*.
3. **Readiness = fonts + images + `__READY__`, bounded by 10s.** The template sets
   `window.__READY__` after its own font/image waits; `renderSlot` also requires every
   `<img>` `.complete` and times out so a buggy template can't hang the CLI forever.
4. **Resolution independence via `deviceScaleFactor`.** Templates are authored at a logical
   viewport (phone = 1080×1920). Higher-res form factors will raise `deviceScaleFactor`, not
   rewrite layouts. Don't hardcode pixel sizes that assume a single output resolution.
5. **Config validation reports all issues with field paths, not source line numbers.** This
   is a deliberate, approved choice (true line mapping via AST was judged not worth it).
   Add new rules in `schema.ts`; the formatter in `format-error.ts` handles presentation.
6. **`ConfigValidationError` is a message pass-through.** The fully-formatted message is built
   at the throw site (load/doctor). Don't re-wrap it.
7. **Test seams: injectable directories.** `runClean(root, opts, chromiumDir?)` and
   `runDoctor(root, chromiumDir?)` take the Chromium dir as an optional param **only so tests
   never touch the real `~/.screenshot-composer/chromium`.** Any test calling `runClean` MUST
   pass a temp dir — deleting the real Chromium forces a 170 MB re-download.
8. **Path traversal:** `server.ts` validates `/input` paths with `path.relative` containment,
   not a string `startsWith`. Keep it that way.

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

## How to add a template (works today)

A template is a module whose **default export** is a `TemplateModule` (`{ meta, render }`).
`render(props: TemplateProps): string` returns the full HTML page; use the helpers in
`src/templates/shared.ts` (`escapeHtml`, `backgroundCss`, `computeDevice`, `deviceTransform`,
`deviceMarkup`, `readyScript`) instead of duplicating that logic. `meta.copyFields` declares
which copy keys the template uses; required keys are validated before Chromium launches
(`src/templates/validate.ts`).

1. **Built-in:** create `src/templates/<id>/index.ts` (mirror `bold-headline/index.ts`) and
   register it in `BUILTIN_MODULES` in `src/templates/registry.ts`. `BUILTIN_TEMPLATES` and
   `templates list` derive automatically.
2. **Project-local:** drop `play-screenshots/templates/<id>/index.ts` in the user's repo with
   the same default-export shape. It's loaded via `jiti` (no build step) and **shadows** a
   built-in of the same id.

`compose.ts` resolves any template id through `resolveTemplate(id, paths)` — project-local
first, then built-in; unknown ids throw `ConfigValidationError` (exit 1) listing the available
ids.

## Testing conventions

- **TDD.** Write the failing test first, then the minimal code. Unit-test pure logic
  (schema, constraints, formatPath, dirSize, registry, frame manifest). Integration-test the
  render path (server, renderSlot, generate) and the CLI via real subprocess smoke tests
  (`npx tsx src/cli.ts ...`).
- Render/CLI tests launch real Chromium; the Vitest `testTimeout` is 180s to cover the
  first-run download. Use `os.mkdtemp` for isolation; never write into the repo.
- Keep `npm run typecheck` clean — it's the only static gate (ESLint/CI are deferred to M2/M7).

## How this project is developed

Built with the **superpowers** workflow: brainstorm → spec (`docs/superpowers/specs/`) →
plan (`docs/superpowers/plans/`) → execute one milestone at a time with per-task TDD and
two-stage (spec + code-quality) review. When picking up the next milestone, read its plan;
cross-milestone follow-ups raised during review are recorded as **backlog notes** at the
bottom of the relevant plan (e.g. the M1 plan's "Milestone 2 backlog", the M2 plan's
deferred items). Current state: **Milestones 1–4 complete**; next is **Milestone 5 (form factors, theming, tilt)**.

When you finish a feature, follow the same loop: keep the design doc/plan in
`docs/superpowers/` authoritative, update README/CLAUDE if the user-facing surface or
architecture changed, and keep this file honest about what's *implemented* vs *planned*.
