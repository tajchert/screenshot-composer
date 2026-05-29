# Track B — Distribution & Packaging (notes)

> Status: **not started.** This is a placeholder for a future brainstorm → spec → plan
> cycle, not a design. Created 2026-05-29.

This area covers making `screenshot-composer` **installable as a real binary** rather than
run from source. Today `bin`/`main` point at a `dist/` that does not exist, the build is
`noEmit`, and the version is `0.0.0` — so the package cannot be installed from a registry.

The work is roughly: add a build pipeline (a `tsconfig.build.json` emitting `dist/` with
type declarations, plus `build` / `prepublishOnly` scripts), a `files` allowlist that ships
`dist/` and the AOSP frame assets under `src/frames/`, bump the version, then publish to
**npm** (canonical) and wrap it in a **Homebrew tap**; an optional Docker image based on the
Playwright image gives deterministic CI. The original vision is in
[`docs/screenshot-composer-tech-spec.md`](../../screenshot-composer-tech-spec.md) §5 and the
[design spec](2026-05-27-screenshot-composer-design.md) §11, and it maps to **Milestone 7**.

Open questions to resolve when this is picked up: whether to ship type declarations, how
`sharp`/`playwright` native deps behave across install targets, and whether the Chromium
download stays first-run (current behavior) or is documented as a separate `install` step.
