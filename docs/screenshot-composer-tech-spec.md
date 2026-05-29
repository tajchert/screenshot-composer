# Google Play Screenshot Composer — Technical Specification

**Audience:** mid/senior engineers implementing the system
**Status:** v2 design (local-first, open source), ready for build
**Working name:** `playscreens` (final name TBD — see §19)

**Goal:** ship an open-source CLI + local editor that lets indie Android developers turn raw app screenshots into polished, localized Google Play store listings — with device frames, copy overlays, tilt/perspective effects, and per-locale rendering at all three Play form factors (phone, 7" tablet, 10" tablet).

**Key constraints from product decisions:**
1. **Local-only.** Runs on the developer's Mac (and Linux/Windows; Mac is primary target). No cloud, no SaaS, no accounts.
2. **Open source, free.** Distributed via Homebrew and npm. Anyone can install, fork, contribute.
3. **Lives inside the Android project.** Configuration, inputs, and outputs are files in the developer's git repo. Collaboration happens via git, not via a server.
4. **Frames are clean-room redraws** (avoid IP issues; SVG assets in the repo).
5. **No Play Store upload integration** in v1; outputs are PNG/JPEG files the developer uploads manually.
6. **CLI-first.** Visual editor is optional and launched on demand (`playscreens edit`).

---

## 1. Output requirements (Google Play)

All three form factors share format constraints: PNG or JPEG, ≤8 MB per file, 16:9 or 9:16 aspect ratio. Up to 8 screenshots per form factor.

| Form factor | Min side | Max side | Typical export |
|---|---|---|---|
| Phone | 320 px | 3,840 px | 1080×1920 / 1920×1080 |
| 7" tablet | 320 px | 3,840 px | 1200×1920 / 1920×1200 |
| 10" tablet | 1,080 px | 7,680 px | 2160×3840 / 3840×2160 |

Templates must be authored once and rendered to all three form factors. This drives the resolution-independent design choices in §9.

---

## 2. Architecture overview

```
       ┌──────────────────────────────────────────────────────────┐
       │           Developer's Mac (or Linux/Windows)             │
       │                                                          │
       │   Android project repo                                   │
       │   ┌────────────────────────────────────────────────┐    │
       │   │  app/  gradle/  …                              │    │
       │   │  play-screenshots/                             │    │
       │   │    playscreens.config.ts   ← source of truth   │    │
       │   │    inputs/                                     │    │
       │   │    outputs/                                    │    │
       │   │    templates/  (optional, project-local)       │    │
       │   │    .cache/      (gitignored)                   │    │
       │   └────────────────────────────────────────────────┘    │
       │                          ▲                               │
       │                          │ reads/writes                  │
       │   ┌──────────────────────┴──────────────────────────┐   │
       │   │  playscreens CLI (Node.js)                      │   │
       │   │   ┌──────────────────────────────────────────┐  │   │
       │   │   │  Commands: init / generate / edit / …    │  │   │
       │   │   ├──────────────────────────────────────────┤  │   │
       │   │   │  Render engine                           │  │   │
       │   │   │   ├─ Playwright (bundled Chromium)       │  │   │
       │   │   │   ├─ Sharp (post-process)                │  │   │
       │   │   │   └─ In-process job runner               │  │   │
       │   │   ├──────────────────────────────────────────┤  │   │
       │   │   │  Local editor server (only when `edit`)  │  │   │
       │   │   │   ├─ Vite dev server (preview HMR)       │  │   │
       │   │   │   └─ HTTP API to read/write config files │  │   │
       │   │   └──────────────────────────────────────────┘  │   │
       │   └─────────────────────────────────────────────────┘   │
       │                                                          │
       │   ~/.playscreens/                                        │
       │     chromium/   (downloaded on first run)                │
       │     fonts/      (cached self-hosted fonts)               │
       └──────────────────────────────────────────────────────────┘
```

Everything runs in-process in a single Node.js CLI. No database, no queue, no auth, no network calls during render. The config file on disk is the source of truth; the editor is just a UI that reads and writes that file.

### 2.1 Why local-first changes the design

Compared to a SaaS version:
- **No database.** Config files in the project repo are the entire data model.
- **No queue.** Renders run in-process with worker threads or just sequentially; one user, one machine.
- **No auth, no multi-tenancy.** Filesystem permissions are the security model.
- **No deployment.** "Deployment" is publishing to Homebrew and npm.
- **Editor is a tool, not a product.** It's a local dev server launched on demand, similar to Storybook or `vite`.

Almost all the complexity in a SaaS version is infrastructure. Removing it makes this a much smaller project — the genuinely hard parts (render pipeline, templates, frames, i18n) are unchanged.

---

## 3. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Same language across CLI, templates, editor |
| Runtime | Node.js 20+ LTS | Universal, stable, Playwright first-class |
| CLI framework | Commander.js or oclif | Both fine; Commander is lighter |
| Headless browser | Playwright (Chromium) | Best 3D-transform fidelity, `deviceScaleFactor` for resolution scaling |
| Image post-processing | Sharp | Fast, well-maintained, format conversion + size enforcement |
| Templates | React 18 + Tailwind, rendered server-side via Vite's SSR | Same components power editor preview AND export |
| Editor server | Vite | HMR for templates, dev server for preview |
| Editor UI | React + Zustand | Lightweight |
| Config file | TypeScript (loaded via `jiti`) | Autocomplete, type-checking, familiar to Android devs who know Gradle Kotlin DSL |
| Config validation | Zod | Runtime validation with good errors |
| Logging | pino (pretty in dev) | Structured logs |
| Distribution | npm package + Homebrew formula | See §5 |

**No Postgres, no Redis, no S3, no Docker required for end users.** Docker is offered as an optional execution mode for deterministic CI builds (§16).

**Versions to pin:** Playwright (and its bundled Chromium), all font files, Node.js minimum version. Pinned in `package.json` and exposed via `playscreens --version` so contributors can diagnose render diffs.

---

## 4. Project layout (inside the user's Android repo)

`playscreens init` scaffolds the following under the user's Android project root:

```
my-android-app/
├── app/
├── gradle/
├── ...
└── play-screenshots/
    ├── playscreens.config.ts         # ← source of truth (committed)
    ├── inputs/                       # raw screenshots (committed)
    │   ├── en-US/
    │   │   ├── phone/
    │   │   │   ├── 01-onboarding.png
    │   │   │   └── 02-search.png
    │   │   └── tablet10/
    │   └── de/
    │       └── phone/
    ├── outputs/                      # generated (gitignored by default)
    │   ├── en-US/
    │   │   └── phone/
    │   │       ├── 01-onboarding.png
    │   │       └── 02-search.png
    │   └── de/
    ├── templates/                    # optional project-local templates (committed)
    │   └── my-custom-template/
    │       ├── Template.tsx
    │       └── meta.ts
    ├── assets/                       # backgrounds, custom logos (committed)
    │   └── logo.svg
    └── .cache/                       # render cache (gitignored)
```

A `.gitignore` is added:
```
play-screenshots/outputs/
play-screenshots/.cache/
```

**Collaboration:** the config file, inputs, project-local templates, and assets are committed. Team members pull the repo, run `playscreens generate`, and get identical (or near-identical — see §17) outputs. The git repo *is* the collaboration mechanism.

---

## 5. Distribution & installation

### 5.1 npm

```bash
npm install -g playscreens
# or
npx playscreens init
```

The npm package is the canonical artifact. The Homebrew formula wraps it.

### 5.2 Homebrew

A separate tap repo (`playscreens/homebrew-tap`) with a formula:

```ruby
class Playscreens < Formula
  desc "Compose Google Play Store screenshots from Android app screenshots"
  homepage "https://github.com/<org>/playscreens"
  url "https://registry.npmjs.org/playscreens/-/playscreens-1.0.0.tgz"
  sha256 "..."
  license "MIT"

  depends_on "node@20"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/playscreens", "--version"
  end
end
```

Install: `brew install playscreens/tap/playscreens`.

Once the project has traction, request inclusion in homebrew-core to drop the tap requirement.

### 5.3 Chromium

Playwright's bundled Chromium is ~170 MB; bundling it in the npm package is too heavy. Instead, on first `playscreens generate`:

1. Check `~/.playscreens/chromium/` for the pinned version.
2. If missing, run `npx playwright install chromium` (downloads from Playwright's CDN).
3. Cache by version; older versions are kept until `playscreens clean` is run.

Show a clear progress message on first run so users understand the one-time download.

### 5.4 Docker (optional)

Publish an image to GHCR for CI use:

```
ghcr.io/<org>/playscreens:1.0.0
```

Based on `mcr.microsoft.com/playwright:v1.x-jammy`. Used by Android teams who want deterministic byte-identical outputs across machines (see §16).

---

## 6. Configuration file

The config file is TypeScript. It uses a `defineConfig` helper that ships with the package — this gives full IDE autocomplete and type-checking without requiring users to set up their own TS toolchain.

### 6.1 Example

```typescript
// play-screenshots/playscreens.config.ts
import { defineConfig } from 'playscreens';

export default defineConfig({
  locales: ['en-US', 'de', 'ja', 'pt-BR'],
  defaultLocale: 'en-US',
  formFactors: ['phone', 'tablet10'],

  paths: {
    inputs: './inputs',
    outputs: './outputs',
    templates: './templates',
    assets: './assets',
  },

  theme: {
    fontFamily: 'Inter',
    palette: {
      fg: '#0F172A',
      accent: '#6366F1',
      muted: '#94A3B8',
    },
    background: {
      type: 'gradient',
      direction: 135,
      stops: ['#6366F1', '#8B5CF6'],
    },
  },

  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',          // built-in or project-local template
      screenshot: 'onboarding.png',       // resolved as inputs/{locale}/{format}/onboarding.png
      frame: { id: 'pixel-9', color: 'obsidian' },
      layout: {
        tilt: { x: 4, y: -18, z: 0 },
        translate: { x: 0, y: 40 },
        perspective: 2000,
      },
      copy: {
        headline: {
          'en-US': 'Order in seconds',
          'de':    'In Sekunden bestellen',
          'ja':    '数秒で注文完了',
        },
        subhead: {
          'en-US': 'Fresh groceries, delivered fast',
        },
      },
    },
    // up to 8 slots per form factor
  ],
});
```

### 6.2 Loading and validation

The CLI loads the config via [`jiti`](https://github.com/unjs/jiti) (no build step required) and validates it through a Zod schema. Errors point to the file and line:

```
✗ playscreens.config.ts:14
  slots[0].layout.tilt.y must be between -45 and 45 (got -75)
```

### 6.3 Why TypeScript over YAML

- Autocomplete and inline docs via the `defineConfig` types
- Allows computed values (`...sharedTheme`, environment-driven locale lists)
- Familiar to Android devs who use Gradle Kotlin DSL
- Easier refactor when adding new fields (compile errors point to every call site)

YAML support could be added later if there's demand; it's a thin loader on top of the same Zod schema.

---

## 7. CLI commands

| Command | Description |
|---|---|
| `playscreens init` | Scaffold `play-screenshots/` directory, sample config, sample inputs |
| `playscreens generate` | Render all slots × locales × form factors to `outputs/` |
| `playscreens generate --locale de --format phone --slot 01-onboarding` | Filtered render |
| `playscreens generate --force` | Bypass cache |
| `playscreens edit` | Launch local editor at `http://localhost:5173` |
| `playscreens import <dir>` | Import screenshots from Fastlane `screengrab` output |
| `playscreens templates list` | List available templates (built-in + project-local) |
| `playscreens frames list` | List available device frames |
| `playscreens doctor` | Diagnose setup (Node version, Chromium, fonts, config validity) |
| `playscreens clean` | Remove cache and downloaded Chromium |
| `playscreens --version` | Print version, Playwright version, Chromium version |

All commands are non-destructive to inputs and source files. Only `outputs/` and `.cache/` are written to (or cleaned).

### 7.1 Exit codes

- `0` success
- `1` config validation error
- `2` missing input asset
- `3` render failure
- `4` constraint violation (e.g., output exceeds 8 MB after max compression)

Documented so users can wire into CI scripts.

### 7.2 `screengrab` import

Fastlane's `screengrab` outputs to a directory like `fastlane/metadata/android/<locale>/images/phoneScreenshots/`. The `import` command maps that structure into `play-screenshots/inputs/<locale>/<form-factor>/`:

```bash
playscreens import ./fastlane/metadata/android
```

This is the recommended integration path for teams that automate screenshot capture via instrumented tests.

---

## 8. Render pipeline (the critical path)

### 8.1 How HTML becomes a PNG

Each composition is a React component (a "template") that takes `props: TemplateProps`. The same component is used in two contexts:

- **Editor preview:** rendered client-side at a reduced "design resolution" (e.g., 540×960 for phone) inside the Vite dev server.
- **Export:** rendered server-side at the target export resolution via Playwright navigating to a local URL served by the same Vite instance (or a static build for non-edit runs).

The render route is `/_render/[slotId]?locale=de&format=phone`. It returns a fully-styled HTML page sized exactly to the export viewport. The CLI navigates to this URL with a freshly-launched Playwright page, waits for readiness signals, and screenshots.

### 8.2 Render pseudocode

```typescript
// src/render/renderSlot.ts
import { chromium } from 'playwright';
import sharp from 'sharp';

const browser = await chromium.launch({
  executablePath: getChromiumPath(),  // ~/.playscreens/chromium/...
  args: [
    '--disable-dev-shm-usage',
    '--font-render-hinting=none',     // deterministic glyph metrics
    '--force-color-profile=srgb',
  ],
});

export async function renderSlot(input: RenderInput): Promise<Buffer> {
  const { slotId, locale, format } = input;
  const { width, height, scale } = resolveDimensions(format);

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: 'light',
    locale,
  });

  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/_render/${slotId}?locale=${locale}&format=${format}`, {
    waitUntil: 'networkidle',
  });

  // Readiness: fonts + images + custom signal from template
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter(img => !img.complete)
        .map(img => new Promise(r => { img.onload = img.onerror = r; }))
    );
    await new Promise<void>(resolve => {
      const check = () => (window as any).__READY__ ? resolve() : setTimeout(check, 16);
      check();
    });
  });

  const png = await page.screenshot({ type: 'png', omitBackground: false, fullPage: false });
  await context.close();
  return enforceConstraints(png, format);
}

async function enforceConstraints(png: Buffer, format: Format): Promise<Buffer> {
  const MAX_BYTES = 8 * 1024 * 1024;
  if (png.byteLength <= MAX_BYTES) return png;
  for (const quality of [95, 90, 85, 80, 75]) {
    const jpeg = await sharp(png).jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
    if (jpeg.byteLength <= MAX_BYTES) return jpeg;
  }
  throw new Error(`Cannot fit output under 8 MB for slot ${input.slotId}`);
}
```

For `playscreens generate`, the CLI starts a temporary Vite production-mode server, runs all renders sequentially or with bounded concurrency (default 2), then shuts down. For `playscreens edit`, the dev server stays up and the same render route is used for both live preview and on-demand export.

### 8.3 Resolution strategy

Templates are authored at a **logical resolution** matching the smallest target per orientation (e.g., 1080×1920 phone portrait). All CSS uses `px` against this logical viewport. For higher-res form factors (tablet 10" at 2160×3840 or 3840×7680), the CLI increases `deviceScaleFactor` rather than rewriting the layout. Single most important architectural trick: templates stay resolution-independent.

A frame around the device, a 48 px title, a 24 px subtitle — they all scale together because Chromium scales the entire raster output by `deviceScaleFactor`. Vector assets (SVG frames, text) stay crisp.

### 8.4 Performance budgets

| Step | Target | Notes |
|---|---|---|
| Cold start (browser launch) | <2 s | Keep browser alive across slots in one invocation |
| Single phone render (1080×1920) | <1.5 s | After cold start |
| Single 10" tablet render (3840×7680) | <8 s | Memory-bound; ~130 MB raw bitmap |
| Concurrent renders on M1/M2 Mac (8+ GB RAM) | 2–3 | Defaults to 2; configurable via `--concurrency` |

Budget for a typical export: 5 locales × 2 form factors × 6 slots = **60 renders**. With concurrency 2 on an M1 MacBook Air, ~2–3 minutes. With caching (§13), subsequent runs are near-instant.

---

## 9. Template system

### 9.1 Template contract

```typescript
type TemplateProps = {
  screenshot: { src: string; width: number; height: number };
  copy: Record<string, string>;            // resolved per locale
  frame?: { id: string; color?: string };
  layout: {
    tilt: { x: number; y: number; z: number };
    translate: { x: number; y: number };
    perspective: number;
  };
  theme: {
    background: BackgroundDef;
    fontFamily: string;
    palette: { fg: string; accent: string; muted: string };
  };
  locale: string;
  format: 'phone' | 'tablet7' | 'tablet10';
  orientation: 'portrait' | 'landscape';
};
```

### 9.2 Template structure

Each template is a directory:

```
templates/
  bold-headline/
    Template.tsx        # default export, takes TemplateProps
    meta.ts             # name, supported orientations, copy slots
    preview.png         # 1:1 thumbnail for editor library
```

`meta.ts`:

```typescript
export const meta: TemplateMeta = {
  id: 'bold-headline',
  name: 'Bold Headline',
  orientations: ['portrait', 'landscape'],
  slots: [
    { key: 'headline', maxLength: 60, required: true },
    { key: 'subhead',  maxLength: 120, required: false },
  ],
  supportsTilt: true,
  recommendedFrames: ['pixel-9', 'pixel-9-pro'],
};
```

### 9.3 Built-in vs. project-local templates

The CLI ships with ~6–10 built-in templates as part of the npm package. Users can also add project-local templates under `play-screenshots/templates/<id>/`, committed to their repo. The resolver looks in project-local first, then built-in, allowing overrides.

### 9.4 Community contributions

This is one of the bigger upsides of going open source. Contributors add templates and frames by sending PRs to the main repo. Acceptance criteria:

- Renders without errors across all supported (locale × form-factor × orientation) combinations
- Passes accessibility audit on text contrast
- Includes preview image at 1:1
- No remote resource loading
- No `window`/media-query dependencies

A `playscreens dev-template ./templates/my-template` command helps contributors test locally before submitting.

### 9.5 Editor/renderer parity

The editor and renderer load the same `Template.tsx` from the same Vite instance. There is **no separate "preview" implementation** — drift is impossible by construction. Two pitfalls to enforce in PR review:
- Templates must not depend on `window` size or media queries — only on props.
- Templates must not load remote resources.

### 9.6 Tilt and partial-view

Implemented purely in CSS:

```tsx
<div
  style={{
    transform: `perspective(${perspective}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(${tilt.z}deg) translate(${translate.x}px, ${translate.y}px)`,
    transformOrigin: 'center center',
  }}
>
  <DeviceFrame id={frame.id} color={frame.color}>
    <img src={screenshot.src} />
  </DeviceFrame>
</div>
```

To show only part of the phone, the wrapper extends past the export viewport via negative position or large `translateY`. Playwright clips at the viewport; overflow is discarded.

The editor exposes:
- **Presets:** "centered", "tilt left", "tilt right", "peek bottom", "peek top"
- **Advanced sliders:** rotation X/Y/Z (-45 to +45), translate X/Y (-50% to +50% of viewport)

---

## 10. Device frame system

### 10.1 Format

Frames are **SVG**, not PNG — scale to 7680 px without resampling artifacts. Each frame ships with a JSON manifest:

```json
{
  "id": "pixel-9",
  "displayName": "Pixel 9",
  "manufacturer": "Google",
  "colors": ["obsidian", "porcelain", "wintergreen"],
  "intrinsic": { "width": 800, "height": 1700 },
  "screen": { "x": 24, "y": 96, "width": 752, "height": 1508, "radius": 36 },
  "shadow": { "x": 0, "y": 24, "blur": 64, "color": "rgba(0,0,0,0.18)" },
  "files": {
    "obsidian":  "frames/pixel-9/obsidian.svg",
    "porcelain": "frames/pixel-9/porcelain.svg"
  }
}
```

The renderer places the screenshot into a `<div>` clipped to the screen rect, then overlays the frame SVG on top. The frame SVG has transparency over the screen area.

### 10.2 v1 frame catalog

Clean-room SVG redraws, all MIT-licensed in the repo:

- Pixel 9, Pixel 9 Pro, Pixel 9 Pro XL
- Pixel Tablet (for 10" form factor)
- Generic "modern Android" frame (manufacturer-neutral)
- Generic 7" tablet frame
- Generic 10" tablet frame
- Optional: Samsung Galaxy S24, S24 Ultra (verify clean-room status)

**No iPhone frames in v1** — irrelevant for Play Store and reduces IP risk.

### 10.3 Authoring guidance

Frames should be authored as a single `<svg>` with:
- Outer body shape with realistic corner radius
- Inner screen cutout as transparent rect with rounded corners
- Camera bumps, buttons, speaker grilles as separate paths
- No raster `<image>` elements
- `viewBox` matching the manifest's `intrinsic` dimensions

---

## 11. Local editor architecture

### 11.1 Lifecycle

`playscreens edit` starts a Vite dev server bound to `localhost`, opens the user's browser to it, and watches the config file for changes.

```
playscreens edit
  ↓
Start Vite dev server on http://localhost:5173
  ↓
Mount HTTP API on same server:
  GET    /api/config         → returns parsed config
  PATCH  /api/config         → writes config back to disk (preserves comments via AST)
  GET    /api/templates      → list available templates
  GET    /api/frames         → list available frames
  POST   /api/export         → run renders, stream progress over SSE
  ↓
Open browser to /editor
```

### 11.2 UI

```
┌───────────────┬──────────────────────────┬───────────────┐
│  Templates    │                          │  Properties   │
│  Frames       │       Live preview       │  - Copy       │
│  Assets       │         (iframe)         │  - Theme      │
│               │                          │  - Tilt       │
│               │                          │  - Frame      │
├───────────────┴──────────────────────────┴───────────────┤
│              Slot strip (1..8 screenshots)               │
└──────────────────────────────────────────────────────────┘
```

State lives in a Zustand store. On change, the store is serialized and PATCHed to the API, which writes the config file. The file remains the source of truth; the editor is a view on it.

### 11.3 Writing back to TypeScript config

Naively overwriting the config file would destroy user comments and formatting. Use `recast` or `ts-morph` to mutate the AST and re-serialize, preserving everything else. This matters because users will hand-edit the file too.

If preserving formatting is too fragile, fall back to:
- Editor writes to a JSON file (`playscreens.config.json`)
- Users with TS configs use the editor in read-only mode + manual edits

Recommend trying the AST approach first; it's the better UX.

### 11.4 Preview

The preview iframe loads `/_render/[slotId]?locale=...&format=phone` — the same route used for export, with Vite's HMR enabled. Changing template code, switching locale, or editing copy triggers a hot reload.

---

## 12. Internationalization

### 12.1 Locale model

Locales are BCP 47 (`en-US`, `de`, `ja`, `ar`, `zh-Hans`, etc.). The config declares supported locales; export emits one file per (locale × slot × form-factor).

### 12.2 Font strategy

Bundle a curated font catalog with the npm package. Cache to `~/.playscreens/fonts/` on first use. Never load fonts from external CDNs at render time.

| Script | Recommended font(s) | Notes |
|---|---|---|
| Latin / Cyrillic / Greek | Inter, Manrope, Geist | ~200 KB each |
| Arabic | Noto Sans Arabic, Cairo | RTL |
| Hebrew | Noto Sans Hebrew | RTL |
| CJK (zh, ja, ko) | Noto Sans CJK (subset per language) | Full file is ~20 MB; subset per language |
| Devanagari (hi, mr) | Noto Sans Devanagari | |
| Thai | Noto Sans Thai | |

The render route declares fonts via `@font-face` with `unicode-range` restricted to the locale's script. Only relevant subsets load per render.

Users can register their own fonts in the config:

```typescript
fonts: [
  { family: 'MyBrand Sans', file: './assets/MyBrandSans.woff2' },
]
```

### 12.3 RTL

Templates must use CSS logical properties from day one: `margin-inline-start`, `padding-inline-end`, `text-align: start`. The render route sets `<html dir="rtl">` for Arabic/Hebrew. Enforce in template review.

### 12.4 Text fit

Templates declare `minFontSize` and `maxFontSize` per slot. The render route runs a measurement pass:

```typescript
function fitText(el: HTMLElement, min: number, max: number) {
  let size = max;
  el.style.fontSize = `${size}px`;
  while (size > min && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
}
```

Set `window.__READY__ = true` only after fit is done.

---

## 13. Caching

Local-first means we can be aggressive about caching to keep `playscreens generate` fast on incremental runs.

Cache key for each output file:

```
sha256(
  configHash(slot, locale, format) ||
  contentHash(screenshot file) ||
  contentHash(template files) ||
  contentHash(frame file) ||
  contentHash(referenced fonts) ||
  playscreensVersion ||
  chromiumVersion
)
```

Cache stored at `play-screenshots/.cache/<hash>.png`. On generate:

1. Compute key for each output.
2. If `.cache/<key>.png` exists, copy to `outputs/<locale>/<format>/<slot>.png`. Skip render.
3. Otherwise render, write to cache and outputs.

`--force` bypasses the cache. `playscreens clean --cache` clears it.

Typical hit rate after small config edits: 80–95%. A copy change in one locale should only re-render that locale.

---

## 14. Determinism (cross-machine)

Byte-identical output across different developer machines is **not a hard requirement** for v1 — visual identity is enough. Local dev on different OS/CPUs will produce slightly different anti-aliasing.

For teams that need byte-identical output (e.g., to catch design regressions via PR diffs of committed outputs), the recommended approach is the **Docker image** (§5.4): runs Chromium in the same Linux container as CI, output is reproducible.

Determinism levers, applied even in non-Docker mode:
- Pin Chromium version via Playwright pin
- Bundle fonts; never load from external CDNs
- `--font-render-hinting=none` (deterministic glyph metrics)
- `--force-color-profile=srgb`
- No `Date`/`Math.random` usage in templates (enforced by lint rule)

---

## 15. Testing strategy

1. **Unit tests** — config Zod schema, fit-text logic, cache key derivation, frame manifest parser.
2. **Template component tests (Playwright Component Testing)** — each template renders without errors for a matrix of (locale, form factor, frame).
3. **Golden snapshot tests** — for ~10 representative (template, locale, format) combinations, commit the expected PNG and diff in CI with pixelmatch at 0.1% tolerance. Run inside the Docker image to guarantee determinism.
4. **CLI smoke tests** — `init` → `generate` against a fixture Android project, assert outputs exist and meet Play constraints.
5. **Locale fuzz** — render every built-in template against every supported locale weekly in CI; flag any that exceed `maxFontSize` clamp or overflow.

---

## 16. CI integration (for users)

Recommended pattern: Android teams run `playscreens generate` in CI to verify the config is valid and to produce a release artifact.

```yaml
# .github/workflows/play-screenshots.yml
name: Play screenshots
on: [pull_request]

jobs:
  generate:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/<org>/playscreens:1.0.0
    steps:
      - uses: actions/checkout@v4
      - run: playscreens generate --concurrency 4
      - uses: actions/upload-artifact@v4
        with:
          name: play-screenshots
          path: play-screenshots/outputs/
```

Document this pattern in the README. The Docker image is the supported CI path because it gives stable, reproducible output regardless of the runner.

---

## 17. Phasing & rough effort

Estimates assume 2 engineers (one senior + one mid). Significantly shorter than a SaaS build because there is no auth, no multi-tenant API, no database, no infrastructure to deploy.

| Phase | Scope | Effort |
|---|---|---|
| **0. Foundations** | Monorepo setup, TS config, lint, CI, package skeleton | 0.5 week |
| **1. Render engine** | Playwright launcher, Chromium auto-install, single hardcoded template renders phone PNG | 1.5 weeks |
| **2. Config + CLI** | Zod schema, `defineConfig`, `init` + `generate` commands, error reporting | 1.5 weeks |
| **3. Template system** | Template contract, 3 production templates, template resolver (built-in + project-local) | 2 weeks |
| **4. Device frames** | SVG frame format, manifest, 5 clean-room frames, frame picker integration | 1.5 weeks |
| **5. All form factors** | 7" + 10" tablet rendering, deviceScaleFactor scaling, tablet frames | 0.5 week |
| **6. i18n** | Locale management, per-locale copy, font subsetting, RTL, text fit | 2 weeks |
| **7. Theming** | Backgrounds (solid/gradient/mesh/image), font picker, palette | 1 week |
| **8. Tilt/perspective** | Layout controls, presets, advanced sliders | 0.5 week |
| **9. Local editor** | Vite dev server, editor UI, config AST round-trip, live preview | 2.5 weeks |
| **10. Caching** | Cache key, cache layer, `--force`, `clean` | 0.5 week |
| **11. Fastlane import** | `playscreens import` command + tests | 0.5 week |
| **12. Distribution** | npm publish, Homebrew formula, Docker image, GitHub release automation | 1 week |
| **13. Hardening** | Golden tests, doctor command, error UX, README, docs site | 1.5 weeks |

**Total: ~16.5 weeks** with two engineers, of which a useful CLI-only MVP (phases 0–8 + 10–12) is ~12 weeks. The editor (phase 9) is the largest single chunk and could be deferred if early users are happy editing the config file directly.

---

## 18. Open questions / decisions needed

1. **Final name.** `playscreens` is a working title. Check npm and Homebrew availability before committing.
2. **License.** MIT is the obvious default for indie-friendly OSS. Apache 2.0 if patent grant matters. Decide before first publish.
3. **Governance.** Single maintainer at launch is fine. Document a contribution process (CONTRIBUTING.md, code of conduct, template/frame acceptance criteria) before the project gets significant external PRs.
4. **User-authored templates as v1?** Currently planned as "project-local templates supported, contribution process for built-in templates." If we want a published-template ecosystem (npm packages like `@playscreens-templates/foo`), that's a v2 design question.
5. **Bundled font footprint.** Bundling full CJK fonts inflates the npm package significantly. Options: (a) bundle minimal Latin set, lazy-download other scripts on first use, (b) bundle all and accept ~50 MB package, (c) make users opt in per locale. Recommend (a).
6. **Editor as a separate binary?** Could ship `playscreens-edit` as a separate optional package to keep the core CLI small. Probably overkill — Vite + React are not that heavy. Decide based on final package size.
7. **Telemetry.** Anonymous usage telemetry helps prioritize, but conflicts with the "no cloud" stance and is bad form in OSS. Recommend none in v1; revisit only if there's a clear need.

---

## 19. Glossary

- **Slot** — one of up to 8 screenshot positions per form factor in the config.
- **Template** — a React component defining the visual composition; takes `TemplateProps`.
- **Form factor** — phone / 7" tablet / 10" tablet.
- **Frame** — the SVG device shell wrapping a screenshot.
- **Logical resolution** — the design-time viewport (e.g., 1080×1920); scaled at render time via `deviceScaleFactor`.
- **Built-in template/frame** — ships with the npm package, available everywhere.
- **Project-local template/frame** — lives in the user's `play-screenshots/templates/` or `play-screenshots/frames/`, only available in that project.
