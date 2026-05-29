# Contributing to screenshot-composer

Thanks for your interest! Contributions of **device frames** and **templates** are the
whole point of this project being open source — those are the easiest and most valuable
PRs to send.

New contributors (human or AI agent) should start with **[CLAUDE.md](CLAUDE.md)** — it is
the technical orientation: the render pipeline, the module map, the key decisions and
gotchas, and step-by-step guides for adding frames and templates. The design specs and
per-milestone plans live in [`docs/superpowers/`](docs/superpowers/).

## Development setup

Requires **Node.js ≥ 20**. No build step is needed to develop or test — TypeScript runs
directly via `tsx`/Vitest.

```bash
npm install
npm test            # full suite (launches real Chromium for render tests)
npm run typecheck   # tsc --noEmit — must stay clean
npm run cli -- <command> [options]   # run the CLI from source, e.g. npm run cli -- doctor
```

The first test run / first `generate` downloads Chromium once (~170 MB) into
`~/.screenshot-composer/chromium`.

## How to contribute

### Add a device frame

Frames are imported from AOSP emulator skins. See **[CLAUDE.md → "How to add a device
frame"](CLAUDE.md)** for the full process. The committed `back.webp`, `mask.webp`, and
`manifest.json` are the source of truth; `tests/frames-structural.test.ts` and
`tests/frames-geometry.test.ts` validate every frame on disk, so no per-frame test code is
needed.

### Add a template

A template is a module whose default export is a `TemplateModule` (`{ meta, render }`). You
can add a **built-in** (under `src/templates/<id>/`) or a **project-local** one (in a user's
`play-screenshots/templates/<id>/`). See **[CLAUDE.md → "How to add a template"](CLAUDE.md)**.

## Pull request checklist

Before opening a PR, please make sure:

- [ ] `npm run typecheck` is clean.
- [ ] `npm test` passes.
- [ ] New behavior is covered by a test (this project follows TDD — write the failing test
      first, then the minimal code).
- [ ] Docs are updated when the user-facing surface or architecture changed
      (`README.md` for users, `CLAUDE.md` for the architecture, the relevant doc under
      `docs/superpowers/` for design).
- [ ] An entry is added to `CHANGELOG.md` under "Unreleased".
- [ ] Any redistributed assets carry their license/attribution (this project is MIT and
      redistributes AOSP frames under Apache-2.0 — see `NOTICE`).

## Scope boundaries

Please keep PRs within the project's hard scope (see CLAUDE.md): local-only, no Play
upload, we *consume* screenshots and never *capture* them, and frames are AOSP emulator
device images redistributed under Apache-2.0. Changes that cross these boundaries need a
design discussion first — open an issue.

## Reporting bugs / requesting features

Use the GitHub issue templates. For security issues, see [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you
agree to uphold it.
