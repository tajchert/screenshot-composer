# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0]

### Added
- **Form factors (Milestone 5a):** `generate` renders all three form factors — phone
  (1080×1920), 7" tablet (1920×1200), and 10" tablet (3840×2160, via `deviceScaleFactor`).
  Slots gain a per-form-factor `orientation` map (`{ phone?, tablet7?, tablet10? }`);
  tablets default to landscape. `resolveDimensions(format, orientation)` drives the export
  size.
- **Render caching (Milestone 6, partial):** `generate` skips any slot whose inputs are all
  unchanged — config, copy, screenshot bytes, template, frame, theme, and tool/Chromium
  versions — and whose output file still exists, printing `↳ cached <id>` and a
  `Rendered N, cached M` summary. Cache index at `play-screenshots/.cache/index.json`.
- **`generate --force`** to bypass the cache and re-render everything.

### Changed
- `clean --cache` now also clears a populated cache index.

## [0.1.0]

First published release. Installable from npm and Homebrew.

### Added
- **Distribution (Milestone 7, partial):** a `tsc`-based build pipeline
  (`tsconfig.build.json` + `scripts/build-finalize.mjs`) that emits `dist/` with type
  declarations and copies the frame assets; `build` / `prepack` / `smoke` npm scripts; a
  `files` allowlist, `publishConfig`, and `exports`/`types`. Published to npm as
  `screenshot-composer` and installable via `brew install tajchert/tap/screenshot-composer`.
- A packaged smoke test (`npm run smoke`) that installs the tarball into a temp project and
  exercises the binary (`--version`, `frames list`, `init`, config load).
- `RELEASING.md` documenting the manual release flow and the future CI automation.
- Open-source governance files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, this
  changelog, and `.github/` issue/PR templates plus a CI workflow (typecheck + tests).
- `repository`, `homepage`, `bugs`, `keywords`, and `author` metadata in `package.json`.

### Fixed
- `src/config/load.ts` aliased the bare `screenshot-composer` specifier to a `.ts` path that
  does not exist in the built package; it now resolves the compiled `.js` entry in published
  installs (and `.ts` in dev). This is what makes user configs load from an installed copy.

### Changed
- README install instructions rewritten for npm/Homebrew; status/roadmap updated.

### Included (Milestones 1–4)
- **M1 — Walking skeleton:** `init` + `generate` pipeline rendering one template in one
  frame to a phone PNG.
- **M2 — Config + CLI surface:** hardened Zod schema, friendly multi-issue errors, and the
  `doctor` / `clean` / `templates list` / `frames list` / `--version` commands.
- **M3 — Template system:** the `TemplateModule` contract (typed HTML-string modules),
  shared render helpers, and a project-local template resolver. Built-ins: `bold-headline`,
  `showcase`, `overlap`.
- **M4 — Device frames:** 19 real AOSP emulator device frames (Pixel 4a/5, the Pixel 6–10
  families, and Pixel Tablet), redistributed under Apache-2.0.

[Unreleased]: https://github.com/tajchert/screenshot-composer/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/tajchert/screenshot-composer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/tajchert/screenshot-composer/releases/tag/v0.1.0
