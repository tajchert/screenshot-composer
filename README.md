# screenshot-composer

Turn raw Android app screenshots into polished, localized **Google Play Store** listing
images — device frames, headline copy, tilt/perspective, gradients — defined as code in
your repo and rendered locally with one command.

- **Local-first.** Runs on your machine. No cloud, no account, no upload. Your config,
  inputs, and outputs are files in your git repo.
- **Open source, MIT.** Fork it, add templates and frames, send PRs.
- **You bring the screenshots.** Capture them however you like (Compose screenshot tests,
  Fastlane `screengrab`, or by hand) — this tool composes the store images, it does not
  take the screenshots, and it does not upload them to Play.

> **Status: early / pre-release (`v0.1.0`).** Milestones 1–4 are done and the tool is
> published to **npm + Homebrew** (Milestone 7, partial — see [Install](#install)): a working
> `init` → `generate` pipeline, the config + CLI surface, the template system, and real
> AOSP device frames. Today it renders **all three form factors** (phone, 7" and 10" tablet)
> with **3 built-in templates** (`bold-headline`, `showcase`, `overlap`) and **19 device
> frames** (Pixel 4a/5, the Pixel 6–10 families, and Pixel Tablet). Full i18n fonts, caching, a visual
> editor, and a Docker image are on the [roadmap](#roadmap).

---

## Requirements

- **Node.js ≥ 20** (developed on Node 26)
- macOS, Linux, or Windows (macOS is the primary target)
- ~300 MB free disk for a one-time Chromium download (fetched automatically on first
  `generate`, cached in `~/.screenshot-composer/chromium`)

## Install

**npm** (any platform, needs Node ≥ 20):

```bash
npm install -g screenshot-composer
# or run without installing:
npx screenshot-composer <command>
```

**Homebrew** (macOS/Linux):

```bash
brew install tajchert/tap/screenshot-composer
```

> Both channels install the same thing. npm is the canonical package; the Homebrew formula
> is just a convenience wrapper that installs that npm package (and pulls in Node for you).
> Use whichever you prefer.

The first `generate` downloads Chromium once (~170 MB) into
`~/.screenshot-composer/chromium`; nothing is downloaded until you actually render.

> **Developing on the tool itself?** Clone the repo and run from source — see
> [CONTRIBUTING.md](CONTRIBUTING.md). In that mode every command is `npm run cli -- <command>`.

## Quickstart

```bash
# 1. Scaffold a workspace inside your Android project (creates play-screenshots/)
screenshot-composer init

# 2. Drop your screenshots into the inputs folder (init also creates a sample one):
#    play-screenshots/inputs/en-US/phone/onboarding.png

# 3. Edit play-screenshots/screenshot-composer.config.ts to taste

# 4. Render
screenshot-composer generate
#    → play-screenshots/outputs/en-US/phone/01-onboarding.png  (1080×1920 PNG)
```

The first `generate` downloads Chromium once (~170 MB) and prints progress.

## The workspace

`init` scaffolds this inside your project (the working directory is named
`play-screenshots/` because it holds Play Store screenshots, not the tool):

```
play-screenshots/
├── screenshot-composer.config.ts   # source of truth (commit this)
├── inputs/                          # your raw screenshots (commit these)
│   └── en-US/
│       └── phone/
│           └── onboarding.png
├── outputs/                         # generated images (gitignored)
├── templates/                       # project-local templates (commit; see roadmap)
├── assets/                          # logos, backgrounds (commit)
└── .cache/                          # gitignored
```

`init` also adds a `.gitignore` for `outputs/` and `.cache/`. Collaboration happens through
git: teammates pull, run `generate`, and get the same images.

## Configuration

The config is a typed TypeScript file. `defineConfig` gives you autocomplete and validation.

```typescript
// play-screenshots/screenshot-composer.config.ts
import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],            // BCP-47 locales to render
  defaultLocale: 'en-US',        // must be one of `locales`
  formFactors: ['phone', 'tablet10'],  // 'phone' | 'tablet7' | 'tablet10'

  theme: {
    fontFamily: 'system-ui',     // custom/bundled fonts: roadmap (M5)
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: {                 // 'gradient' (≥2 stops) or 'solid' (color)
      type: 'gradient',
      direction: 135,
      stops: ['#6366F1', '#8B5CF6'],
    },
  },

  slots: [                       // up to 8 per form factor
    {
      id: '01-onboarding',
      template: 'bold-headline',          // built-in: bold-headline, showcase, overlap
      screenshot: 'onboarding.png',       // → inputs/{locale}/{format}/onboarding.png
      frame: { id: 'pixel-9' },           // 19 built-in frames — see `frames list`
      layout: {
        tilt: { x: 4, y: -18, z: 0 },     // each axis -45..45 degrees
        translate: { x: 0, y: 40 },
        perspective: 2000,
      },
      copy: {
        headline: { 'en-US': 'Order in seconds' },   // per-locale strings
      },
    },
  ],
});
```

Validation reports **every** problem at once, by field path:

```
Invalid config: .../screenshot-composer.config.ts
  • slots[0].layout.tilt.y: Number must be less than or equal to 45
  • theme.background: a gradient needs at least 2 color stops
  • defaultLocale: 'en' is not one of locales [en-US, de]
```

## Commands

| Command | What it does |
|---|---|
| `init` | Scaffold `play-screenshots/` with a sample config + sample screenshot |
| `generate` | Render every slot × locale × form-factor to `outputs/` |
| `generate --locale <l> --format <f> --slot <id>` | Render a filtered subset |
| `doctor` | Check Node version, Chromium install, and config validity |
| `clean` | Remove the downloaded Chromium and the project `.cache` |
| `clean --cache` | Remove only the project `.cache` (keep Chromium) |
| `templates list` | List available templates (built-in + project-local) |
| `frames list` | List available device frames |
| `--version` | Print tool / Node / Playwright / Chromium versions |

**Exit codes:** `0` ok · `1` config error · `2` missing input · `3` render failure ·
`4` output exceeds Play's 8 MB limit. Handy for CI scripts.

## Output & Google Play constraints

Outputs are PNG (auto-converted to progressive JPEG only if a PNG would exceed 8 MB).
Google Play accepts PNG/JPEG ≤ 8 MB, 16:9 or 9:16, up to 8 screenshots per form factor.
Exports: phone 1080×1920, 7" tablet 1920×1200, 10" tablet 3840×2160 (defaults; tablets
default to landscape). Set a slot's `orientation` map to override per form factor, e.g.
`orientation: { tablet10: 'portrait' }`. You upload the files to Play yourself.

## Current limitations (see roadmap)

- **Tablet screenshots must be landscape.** The `pixel-tablet` frame is landscape-native, so
  provide landscape-shaped screenshots under `inputs/{locale}/{tablet7,tablet10}/`. A
  portrait-native tablet frame is a future asset.
- **Frames are single-color.** Each device has one real AOSP colorway (no obsidian/porcelain
  variants); a slot's `frame.color` is accepted for back-compat but ignored.
- **Fonts:** only the system font stack; bundled/custom and non-Latin scripts are planned.
- **No caching yet** — every `generate` re-renders.
- **No visual editor and no Fastlane import yet.**

## Roadmap

Built milestone-by-milestone; each has a spec and a plan under
[`docs/superpowers/`](docs/superpowers/).

1. ✅ **Walking skeleton** — `init` + `generate`, one template, one frame, phone PNG.
2. ✅ **Config + CLI surface** — hardened schema, friendly errors, `doctor`/`clean`/`templates list`/`frames list`/`--version`.
3. ✅ **Template system** — `TemplateModule` contract (typed HTML-string modules), shared render helpers, project-local template resolver.
4. ✅ **Device frames** — Pixel 4a/5 + Pixel 6–10 families + Pixel Tablet (19 frames), real device images from AOSP emulator skins (Apache-2.0).
5. 🚧 **Form factors + i18n + theming + tilt** — ✅ 5a: tablets + per-slot orientation; ⏳ 5b: bundled fonts, RTL, text-fit.
6. ⏳ **Caching + Fastlane `import`.**
7. 🟡 **Distribution** — npm + Homebrew shipped (manual release; see [RELEASING.md](RELEASING.md)). Docker, CI-automated releases, and golden tests still to come.

## Contributing

Contributions of templates and frames are the whole point of going open source.
New developers (and AI agents) should start with **[CLAUDE.md](CLAUDE.md)** — it covers the
architecture, the render pipeline, key decisions/gotchas, and how to add a frame or
template. The design spec and milestone plans live in
[`docs/superpowers/`](docs/superpowers/).

## License

This project is licensed under the MIT License. However, it incorporates assets and code from the Android Open Source Project (AOSP), which are licensed under the Apache License, Version 2.0. See the LICENSE-APACHE file for details.

The full MIT text is in [LICENSE](LICENSE); attribution for AOSP-derived material is in [NOTICE](NOTICE).
