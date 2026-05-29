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

> **Status: early / pre-release (`v0.0.0`).** Milestones 1–2 are done: a working
> `init` → `generate` pipeline plus the config + CLI surface. Today it renders the
> **phone** form factor using the built-in **`bold-headline`** template and the **Pixel 9**
> frame. Tablets, more templates/frames, full i18n fonts, caching, a visual editor, and
> npm/Homebrew packaging are on the [roadmap](#roadmap). Until packaging lands, run it
> from source (below).

---

## Requirements

- **Node.js ≥ 20** (developed on Node 26)
- macOS, Linux, or Windows (macOS is the primary target)
- ~300 MB free disk for a one-time Chromium download (fetched automatically on first
  `generate`, cached in `~/.screenshot-composer/chromium`)

## Install (from source)

Packaging to npm and Homebrew is planned (Milestone 7). For now:

```bash
git clone <this-repo>
cd screenshot-composer
npm install
```

Run the CLI via the `cli` script (everything after `--` is forwarded):

```bash
npm run cli -- <command> [options]
# e.g.
npm run cli -- --version
```

The examples below use `screenshot-composer <command>` for readability — that's the
published binary name that will work once packaging lands. Until then, substitute
`npm run cli -- <command>` (or `npx tsx src/cli.ts <command>`).

## Quickstart

```bash
# 1. Scaffold a workspace inside your Android project (creates play-screenshots/)
npm run cli -- init

# 2. Drop your screenshots into the inputs folder (init also creates a sample one):
#    play-screenshots/inputs/en-US/phone/onboarding.png

# 3. Edit play-screenshots/screenshot-composer.config.ts to taste

# 4. Render
npm run cli -- generate
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
  formFactors: ['phone'],        // only 'phone' is renderable today

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
      template: 'bold-headline',          // only built-in template today
      screenshot: 'onboarding.png',       // → inputs/{locale}/{format}/onboarding.png
      frame: { id: 'pixel-9', color: 'obsidian' },
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
The current phone export is **1080×1920**. You upload the files to Play yourself.

## Current limitations (see roadmap)

- **Phone only.** The config schema accepts `tablet7`/`tablet10`, but rendering them is not
  implemented yet — `generate` will error. Use `['phone']`.
- **One template** (`bold-headline`) and **one frame** (`pixel-9`, color `obsidian`).
  `templates list` / `frames list` will show project-local entries, but rendering a
  non-built-in template isn't wired yet.
- **Fonts:** only the system font stack; bundled/custom and non-Latin scripts are planned.
- **No caching yet** — every `generate` re-renders.
- **No visual editor and no Fastlane import yet.**

## Roadmap

Built milestone-by-milestone; each has a spec and a plan under
[`docs/superpowers/`](docs/superpowers/).

1. ✅ **Walking skeleton** — `init` + `generate`, one template, one frame, phone PNG.
2. ✅ **Config + CLI surface** — hardened schema, friendly errors, `doctor`/`clean`/`templates list`/`frames list`/`--version`.
3. ⏳ **Template system** — `TemplateProps` contract, React/Tailwind templates via Vite SSR, project-local template resolver.
4. ⏳ **Device frames** — Pixel 4a/5 + Pixel 6–10 families + Pixel Tablet (19 frames), real device images from AOSP emulator skins (Apache-2.0).
5. ⏳ **All form factors + i18n + theming + tilt** — tablets, bundled fonts, RTL, text-fit.
6. ⏳ **Caching + Fastlane `import`.**
7. ⏳ **Distribution** — npm + Homebrew + Docker, golden tests, docs.

## Contributing

Contributions of templates and frames are the whole point of going open source.
New developers (and AI agents) should start with **[CLAUDE.md](CLAUDE.md)** — it covers the
architecture, the render pipeline, key decisions/gotchas, and how to add a frame or
template. The design spec and milestone plans live in
[`docs/superpowers/`](docs/superpowers/).

## License

This project is licensed under the MIT License. However, it incorporates assets and code from the Android Open Source Project (AOSP), which are licensed under the Apache License, Version 2.0. See the LICENSE-APACHE file for details.

The full MIT text is in [LICENSE](LICENSE); attribution for AOSP-derived material is in [NOTICE](NOTICE).
