# screenshot-composer — Reconciled Design Spec

**Date:** 2026-05-27
**Status:** Approved design, ready to decompose into implementation plans
**Supersedes:** `screenshot-composer-tech-spec.md` (the v2 "playscreens" tech-spec) where they conflict. That document remains the detailed engineering reference; **this document is the source of truth for naming, scope, and sequencing.**

---

## 0. What this is

An open-source, local-first CLI that lets indie Android developers turn raw app
screenshots into polished, localized Google Play store listings — with device
frames, copy overlays, tilt/perspective effects, and per-locale rendering at all
three Play form factors (phone, 7" tablet, 10" tablet).

**Core principles (unchanged from the tech-spec):**
1. **Local-only.** Runs on the developer's machine (Mac primary; Linux/Windows
   supported). No cloud, no SaaS, no accounts, no network calls during render.
2. **Open source, free, MIT-licensed.** Distributed via npm and Homebrew.
3. **Lives inside the Android repo.** Config, inputs, and outputs are files in the
   developer's git repo. Collaboration happens via git.
4. **Frames are clean-room SVG redraws** committed to the repo (avoid IP issues).
5. **No Play Store upload** in v1. Outputs are PNG/JPEG files the dev uploads manually.
6. **We consume screenshots, we never capture them.** Inputs are PNGs the dev
   already produced — via Compose screenshot tests, Fastlane `screengrab`, or by
   hand. Capturing screenshots is explicitly out of scope.
7. **CLI-first.** A visual editor exists in the tech-spec but is **deferred** — not
   part of this MVP.

---

## 1. Naming (the global rename from the tech-spec)

The tech-spec uses the working name `playscreens` throughout. The product name is
**`screenshot-composer`**. Apply this rename everywhere:

| Thing | Tech-spec | This project |
|---|---|---|
| npm package | `playscreens` | **`screenshot-composer`** (verified available on npm 2026-05-27) |
| CLI command / binary | `playscreens` | **`screenshot-composer`** (full name, no short alias) |
| Config file | `playscreens.config.ts` | **`screenshot-composer.config.ts`** |
| `defineConfig` import | `from 'playscreens'` | **`from 'screenshot-composer'`** |
| Home cache dir | `~/.playscreens/` | **`~/.screenshot-composer/`** |
| In-repo working dir | `play-screenshots/` | **`play-screenshots/`** (kept — names the *content*, Play Store screenshots, not the tool) |
| Homebrew tap | `playscreens/homebrew-tap` | **`screenshot-composer/homebrew-tap`** |
| Docker image | `ghcr.io/<org>/playscreens` | **`ghcr.io/<org>/screenshot-composer`** |

Every command example in the tech-spec (`playscreens init`, `playscreens generate`,
etc.) maps to `screenshot-composer <subcommand>`.

---

## 2. Output requirements (Google Play) — unchanged

All three form factors: PNG or JPEG, ≤8 MB per file, 16:9 or 9:16 aspect ratio,
up to 8 screenshots per form factor.

| Form factor | Min side | Max side | Typical export |
|---|---|---|---|
| Phone | 320 px | 3,840 px | 1080×1920 / 1920×1080 |
| 7" tablet | 320 px | 3,840 px | 1200×1920 / 1920×1200 |
| 10" tablet | 1,080 px | 7,680 px | 2160×3840 / 3840×2160 |

Templates are authored once at a logical resolution and rendered to all three form
factors by raising `deviceScaleFactor` (tech-spec §8.3, §9). This resolution-
independence is the central architectural trick and is unchanged.

---

## 3. Tech stack & defaults (locked)

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 20+ LTS |
| CLI framework | **Commander.js** (lighter than oclif; tech-spec left this open) |
| Headless browser | Playwright (Chromium), auto-installed to `~/.screenshot-composer/chromium/` on first `generate` |
| Image post-processing | Sharp (format conversion + 8 MB enforcement) |
| Templates | React 18 + Tailwind, rendered server-side via Vite SSR |
| Config | TypeScript loaded via `jiti`, validated with Zod |
| Logging | pino |
| Distribution | npm package (canonical) + Homebrew formula (wraps npm) + optional Docker image for CI determinism |
| License | **MIT** |

Pin Playwright/Chromium versions, all font files, and the Node minimum. Expose via
`screenshot-composer --version` for diagnosing render diffs.

**Fonts:** bundle a **Latin set by default** (Inter + 1–2 alternates such as
Manrope/Geist). Non-Latin scripts (CJK, Arabic, Hebrew, Devanagari, Thai) are
**lazy-downloaded on first use** and cached to `~/.screenshot-composer/fonts/`
(tech-spec §18.5 option (a)). Never load fonts from external CDNs at render time.

---

## 4. Project layout inside the user's Android repo

`screenshot-composer init` scaffolds:

```
my-android-app/
├── app/  gradle/  …
└── play-screenshots/
    ├── screenshot-composer.config.ts   # source of truth (committed)
    ├── inputs/                         # raw screenshots (committed)
    │   └── en-US/phone/01-onboarding.png …
    ├── outputs/                        # generated (gitignored)
    ├── templates/                      # optional project-local templates (committed)
    ├── assets/                         # backgrounds, logos (committed)
    └── .cache/                         # render cache (gitignored)
```

`init` also writes a `.gitignore` ignoring `outputs/` and `.cache/`, and seeds a
sample config + at least one sample input screenshot so `generate` works
immediately after `init`.

---

## 5. CLI commands (MVP surface)

| Command | Description |
|---|---|
| `screenshot-composer init` | Scaffold `play-screenshots/`, sample config, sample inputs |
| `screenshot-composer generate` | Render all slots × locales × form factors to `outputs/` |
| `screenshot-composer generate --locale de --format phone --slot 01-onboarding` | Filtered render |
| `screenshot-composer generate --force` | Bypass cache |
| `screenshot-composer generate --concurrency N` | Override concurrency (default 2) |
| `screenshot-composer import <dir>` | Import from Fastlane `screengrab` output |
| `screenshot-composer templates list` | List built-in + project-local templates |
| `screenshot-composer frames list` | List available device frames |
| `screenshot-composer doctor` | Diagnose setup (Node, Chromium, fonts, config) |
| `screenshot-composer clean` | Remove cache and downloaded Chromium |
| `screenshot-composer --version` | Print versions (tool, Playwright, Chromium) |

**Exit codes:** `0` success · `1` config error · `2` missing input · `3` render
failure · `4` constraint violation (output exceeds 8 MB after max compression).

Commands are non-destructive to inputs/source; only `outputs/` and `.cache/` are
written or cleaned.

**Deferred (NOT in this MVP):** `screenshot-composer edit` (the Vite/React visual
editor, tech-spec §11) and `dev-template`. The config file is hand-edited in this MVP.

---

## 6. Configuration file

TypeScript config via a `defineConfig` helper exported from the package; loaded
with `jiti` (no build step) and validated with Zod. Shape and semantics follow
tech-spec §6, with the import path updated:

```typescript
// play-screenshots/screenshot-composer.config.ts
import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US', 'de'],
  defaultLocale: 'en-US',
  formFactors: ['phone', 'tablet10'],
  paths: { inputs: './inputs', outputs: './outputs', templates: './templates', assets: './assets' },
  theme: { fontFamily: 'Inter', palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
           background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] } },
  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'onboarding.png',     // resolved as inputs/{locale}/{format}/onboarding.png
      frame: { id: 'pixel-9', color: 'obsidian' },
      layout: { tilt: { x: 4, y: -18, z: 0 }, translate: { x: 0, y: 40 }, perspective: 2000 },
      copy: { headline: { 'en-US': 'Order in seconds', 'de': 'In Sekunden bestellen' } },
    },
  ],
});
```

Validation errors point to file + line (tech-spec §6.2).

---

## 7. Render pipeline — unchanged from tech-spec §8

Each composition is a React "template" taking `TemplateProps`. The render route
`/_render/[slotId]?locale=…&format=…` returns a fully-styled page sized to the
export viewport. The CLI launches Playwright, navigates, waits for readiness
(`document.fonts.ready`, image load, `window.__READY__`), screenshots, then Sharp
enforces the 8 MB limit (downgrade to progressive mozjpeg at descending quality;
error with exit code 4 if it can't fit). Browser stays alive across slots in one
invocation; default concurrency 2. See tech-spec §8.2 for pseudocode.

---

## 8. Template system — tech-spec §9

- `TemplateProps` contract per tech-spec §9.1.
- Each template is a directory: `Template.tsx` (default export) + `meta.ts` +
  `preview.png`.
- **Built-in templates** ship in the package (3 to start, room for ~6–10).
- **Project-local templates** live under `play-screenshots/templates/<id>/` and are
  committed to the user's repo. Resolver: project-local first, then built-in
  (project-local can override built-in). This is how "users author their own HTML
  layouts."
- Templates must not depend on `window`/media queries or load remote resources, and
  must use CSS logical properties for RTL. Tilt/perspective is pure CSS (§9.6).

---

## 9. Device frames — tech-spec §10, with v1 catalog updated

SVG frames + JSON manifest (screen rect, intrinsic size, colors, shadow). Renderer
clips the screenshot to the screen rect and overlays the transparent-over-screen
frame SVG.

**v1 catalog (clean-room SVG, MIT):**
- Pixel 9
- Pixel 9 Pro
- Pixel 9 Pro XL
- **Pixel 9a** *(added per product requirement; not in the tech-spec catalog)*
- Pixel Tablet (10" form factor)
- Generic "modern Android" frame (manufacturer-neutral)
- Generic 7" tablet frame
- Generic 10" tablet frame

No iPhone frames. Samsung Galaxy frames optional/later pending clean-room verification.

---

## 10. i18n, caching, determinism, testing — tech-spec §12–§15

- **i18n (§12):** BCP 47 locales; one output file per (locale × slot × form-factor);
  per-script font subsetting via `@font-face` `unicode-range`; RTL via `<html dir>`
  and logical properties; text-fit measurement pass before `__READY__`. MVP ships
  **Latin scripts working end-to-end**; non-Latin font auto-download is wired but
  those fonts are fetched on demand.
- **Caching (§13):** content-hash cache key over config slice + screenshot + template
  + frame + fonts + tool version + Chromium version, stored in `.cache/`. `--force`
  bypasses; `clean --cache` clears.
- **Determinism (§14):** byte-identical output is *not* a v1 requirement; visual
  identity is. Docker image is the path for teams needing reproducible bytes. Apply
  the deterministic Chromium flags even outside Docker.
- **Testing (§15):** Zod schema unit tests, fit-text/cache-key units, per-template
  Playwright render matrix, ~10 golden PNG snapshots diffed in Docker, CLI smoke
  tests (`init`→`generate`), weekly locale fuzz.

---

## 11. Distribution — tech-spec §5, renamed

- **npm:** `npm install -g screenshot-composer` / `npx screenshot-composer init`.
- **Homebrew:** tap `screenshot-composer/homebrew-tap`, formula wraps the npm tarball,
  `depends_on "node@20"`. Install: `brew install screenshot-composer/tap/screenshot-composer`.
  Request homebrew-core inclusion once there's traction.
- **Chromium:** not bundled (~170 MB); auto-installed on first `generate` with a clear
  progress message; cached by version.
- **Docker (optional):** `ghcr.io/<org>/screenshot-composer:<ver>` based on the
  Playwright image, for deterministic CI (tech-spec §16).

---

## 12. MVP scope summary

**In scope (CLI-only feature MVP):** everything above — `init`/`generate`/`import`/
`doctor`/`clean`/`templates list`/`frames list`/`--version`; full Zod config; 3
built-in templates + project-local resolver; full v1 frame catalog incl. Pixel 9a;
all three form factors; i18n with Latin fonts bundled (others lazy); theming;
tilt/perspective; caching; Fastlane import; npm + Homebrew + Docker.

**Explicitly out of scope (deferred):** visual editor (`edit`), `dev-template`,
Play Store upload, screenshot capture, a published-template npm ecosystem,
telemetry, non-Latin fonts bundled by default, iPhone/Samsung frames.

---

## 13. Build sequencing — ordered milestones

This MVP is large, so we build it in milestones. **Each milestone gets its own
implementation plan (written when we reach it).** We write the plan for Milestone 1
next; later milestones are placeholders until their turn.

1. **Walking skeleton** — monorepo/package skeleton, TS/lint/CI, Playwright
   auto-install, `init` (scaffold + sample config + one sample input), `generate`
   rendering ONE hardcoded built-in template with ONE Pixel frame to a phone PNG
   that passes Play constraints. Proves config→Vite/Playwright→Sharp→file end-to-end.
2. **Config + CLI surface** — full Zod schema, `defineConfig`, line-accurate error
   reporting, remaining commands (`doctor`, `clean`, `templates list`, `frames list`,
   `--version`), exit-code contract.
3. **Template system** — `TemplateProps` contract, `meta.ts`, 3 production templates,
   built-in + project-local resolver.
4. **Device frames** — SVG format + manifest parser, full v1 catalog incl. Pixel 9a,
   frame picker wiring.
5. **All form factors + i18n (Latin) + theming + tilt** — `deviceScaleFactor` scaling,
   tablet frames, per-locale copy, font strategy, RTL plumbing, text-fit, backgrounds,
   palette, tilt presets/sliders.
6. **Caching + Fastlane import** — cache key/layer, `--force`, `clean --cache`,
   `import` command + tests.
7. **Distribution + hardening** — npm publish, Homebrew formula, Docker image, golden
   snapshot tests, `doctor`, error UX, README + docs.

---

## 14. Open decisions deferred to later milestones

- Editor's config write-back strategy (AST round-trip via `recast`/`ts-morph` vs JSON
  fallback) — only relevant when the editor is un-deferred.
- Published-template ecosystem (`@screenshot-composer-templates/*`) — v2 question.
- Whether to bundle full CJK fonts vs lazy-download — currently lazy-download (§3).
- GitHub org/namespace for the repo, tap, and GHCR image — needed before first publish
  (Milestone 7).
