# Track B — Distribution & Packaging (Milestone 7, partial): npm + Homebrew

> Status: **approved design**, ready for an implementation plan. Created 2026-05-29.
> Supersedes the placeholder notes at
> [`2026-05-29-track-b-distribution-notes.md`](2026-05-29-track-b-distribution-notes.md).

## Goal

Make `screenshot-composer` installable as a real binary — via **npm** (canonical) and
**Homebrew** (wrapping the npm tarball) — so users no longer run it from source. Releases
are cut by pushing a git tag, which drives a GitHub Actions workflow that publishes to npm,
creates a GitHub Release, and bumps the Homebrew formula in the existing
`tajchert/homebrew-tap`.

Docker is explicitly **deferred** to a later follow-up (the original spec marks it optional).

## Scope

In scope: a `tsc`-based build pipeline emitting `dist/`, npm publish, Homebrew formula +
auto-bump, tag-driven release automation, install docs, and a packaged smoke test.

Out of scope: Docker/GHCR image, caching of the Chromium download, any change to render
behavior or the config/template/frame surfaces. No new runtime features.

## Context & constraints (from the code)

- **Frame assets load relative to the compiled module.** `src/frames/load.ts` sets
  `FRAMES_DIR = path.dirname(fileURLToPath(import.meta.url))` and reads
  `manifest.json` / `back.webp` / `mask.webp` from there. A JS compile does **not** move
  these binary assets, so the build must copy `src/frames/**/{manifest.json,*.webp}` into
  `dist/frames/` preserving structure. This is the single most important build detail.
- **No bundling.** Compiling with `tsc` (not a bundler) keeps every dependency external and
  therefore sidesteps two documented gotchas in CLAUDE.md: the Playwright **dynamic import**
  (`await import('playwright')` after the browsers-path env var is set) and the esbuild
  `__name` injection in readiness predicates. The `.js`-extension-pointing-at-`.ts` import
  idiom emits correct ESM under `tsc`.
- **Bare-specifier resolution.** User configs `import { defineConfig } from
  'screenshot-composer'`. In dev this is aliased to `src/index.ts` via jiti
  (`SELF_ALIAS` in `src/config/load.ts`); in a published install it must resolve through
  `node_modules` to `dist/index.js`. The `SELF_ALIAS` is documented as an unused fallback in
  published mode — the packaged smoke test verifies real resolution.
- **CLI shebang.** `src/cli.ts` begins with `#!/usr/bin/env node`. `tsc` preserves a leading
  shebang; the build script also `chmod +x dist/cli.js` to be safe.
- **Native deps.** `sharp` and `playwright` stay runtime `dependencies`; their platform
  binaries resolve at install. Chromium continues to download lazily on first `generate`
  into `~/.screenshot-composer/chromium` (unchanged).

## Design

### 1. Build pipeline (`tsc` + asset copy)

- **`tsconfig.build.json`** extends the base config with `noEmit:false`, `outDir:"dist"`,
  `rootDir:"src"`, `declaration:true`, `include:["src"]`, and `exclude` covering `tests` and
  `src/frames/_build` (the AOSP importer is a dev tool, not shipped).
- **`scripts/copy-assets.mjs`** copies each `src/frames/<id>/{manifest.json,back.webp,
  mask.webp}` into `dist/frames/<id>/…`, then sets `dist/cli.js` executable.
- **`package.json` scripts:** `build` = `tsc -p tsconfig.build.json && node
  scripts/copy-assets.mjs`; `prepack` = `npm run typecheck && npm run build` (so `npm pack`
  and `npm publish` always build first). Tests are NOT in `prepack` (they launch Chromium;
  CI runs them).
- **`files`:** `["dist", "NOTICE", "LICENSE-APACHE"]` (npm auto-includes README, LICENSE,
  package.json).

### 2. Version & npm metadata

- Bump `version` `0.0.0` → **`0.1.0`**.
- Add `"publishConfig": { "access": "public" }`.
- `repository` / `homepage` / `bugs` / `keywords` / `author` already present (Track A).
- **Blocking pre-flight:** confirm the unscoped name `screenshot-composer` is available on
  npm (`npm view screenshot-composer`). If taken, switch to the scoped
  `@tajchert/screenshot-composer` (and update the `bin` name decision + docs accordingly).

### 3. Release automation — `.github/workflows/release.yml`

Triggered on `push` of a tag matching `v*`. Permissions include `contents: write` (GitHub
Release) and `id-token: write` (npm provenance). Steps:

1. checkout → `actions/setup-node` (Node 20, `registry-url: https://registry.npmjs.org`,
   `cache: npm`)
2. `npm ci` → `npm run typecheck` → `npm run build`
3. **packaged smoke test** (see §6)
4. `npm publish --provenance --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
5. create a GitHub Release from the matching `CHANGELOG.md` section
   (`softprops/action-gh-release`)
6. **bump the Homebrew formula** in `tajchert/homebrew-tap` (e.g.
   `dawidd6/action-homebrew-bump-formula`, or a scripted `url`+`sha256` update + commit)
   using `${{ secrets.HOMEBREW_TAP_TOKEN }}`

New repository secrets: **`NPM_TOKEN`** (npm automation token) and **`HOMEBREW_TAP_TOKEN`**
(PAT able to push to the tap repo).

### 4. Homebrew formula (in `tajchert/homebrew-tap`)

Add `Formula/screenshot-composer.rb`:

- `url` = npm tarball
  (`https://registry.npmjs.org/screenshot-composer/-/screenshot-composer-<ver>.tgz`),
  with `sha256`.
- `desc`, `homepage`, `license all_of: ["MIT", "Apache-2.0"]`.
- `depends_on "node"`.
- `install`: npm-install into `libexec` (`Language::Node.std_npm_install_args(libexec)`),
  then `bin.install_symlink` the package bin.
- `caveats`: note the first-run ~170 MB Chromium download into `~/.screenshot-composer`.
- `test do`: run `#{bin}/screenshot-composer --version`.

Users install with `brew install tajchert/tap/screenshot-composer`. The release workflow
keeps `url`/`sha256` current on each tag.

### 5. Docs

- **README Install** rewritten to real paths: `npm install -g screenshot-composer` /
  `npx screenshot-composer init` and `brew install tajchert/tap/screenshot-composer`; keep
  "from source" as a dev/Contributing note; call out the first-run Chromium download and
  Node ≥ 20.
- **`RELEASING.md`**: the tag → publish flow, the two required secrets, how to verify a
  release, and a manual fallback (`npm publish` + manual formula bump with a sha256 helper).
- **`CHANGELOG.md`**: add a `0.1.0` entry describing distribution.

### 6. Verification — packaged smoke test

The guard that unit tests cannot provide. As a CI job on PRs and a step in the release
workflow:

1. `npm pack` to produce the tarball.
2. Install the tarball into a fresh temp dir (`npm install <tarball>`), outside the repo.
3. Run, against the installed binary:
   - `screenshot-composer --version` (bin wiring + shebang)
   - `screenshot-composer frames list` (proves the webp/manifest assets shipped in `dist/`
     and resolve relative to the compiled module)
   - `screenshot-composer init` then a config load (proves the bare-specifier
     `import 'screenshot-composer'` resolves from `node_modules`, not the dev `SELF_ALIAS`)
4. The existing full test suite stays green (unchanged).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| npm name `screenshot-composer` already taken | §2 blocking pre-flight; scoped-name fallback |
| Frame `.webp`/`manifest.json` missing from package | copy-assets script + `frames list` in smoke test |
| `tsc` drops the CLI shebang | build script `chmod +x` + `--version` in smoke test |
| Bare specifier resolves wrong in published install | packaged smoke test loads a real config |
| Homebrew formula `url`/`sha256` drift | release workflow auto-bumps on every tag |
| Provenance requires public repo + id-token | repo is public; workflow sets `id-token: write` |

## Acceptance criteria

- `npm pack` produces a tarball that, installed fresh, runs `--version`, `init`,
  `frames list`, and loads a generated config — all green in the smoke test.
- Pushing tag `v0.1.0` publishes `screenshot-composer@0.1.0` to npm with provenance, creates
  a GitHub Release, and updates the formula in `tajchert/homebrew-tap`.
- `brew install tajchert/tap/screenshot-composer` installs a working CLI.
- README documents the real install paths; `RELEASING.md` documents the release flow.
- `npm run typecheck` and the full test suite remain green.

## Implementation phasing (decided 2026-05-29)

The release flow is built in two phases to ship the first version sooner without standing up
CI secrets:

- **Phase 1 — manual (now).** The build pipeline (`tsconfig.build.json`,
  `scripts/build-finalize.mjs`, the `build`/`prepack`/`smoke` scripts, `files`,
  `publishConfig`, `exports`), version `0.1.0`, the packaged smoke test, and the docs land
  now. The first publish is done **by hand** from a maintainer's machine
  (`npm login` → `npm publish`). **No `NPM_TOKEN`, no `release.yml` yet.** The Homebrew
  formula is added to `tajchert/homebrew-tap` and bumped manually using the `sha256` of the
  published tarball.
- **Phase 2 — automation (later).** The tag-driven `release.yml` (§3) and the Homebrew
  auto-bump are added once `NPM_TOKEN` + `HOMEBREW_TAP_TOKEN` are configured. `RELEASING.md`
  documents exactly how to do this so Phase 2 is a mechanical follow-up.

## Known issues & follow-ups

- **Chromium download (no issue — verified 2026-05-29).** An earlier draft of this spec
  claimed a "double download" (install-time + first-run). That was based on older Playwright
  behavior and is **not true** for the pinned `playwright` (1.60): its manifest has no
  install/postinstall browser fetch, so installing the package downloads nothing. Chromium is
  fetched exactly once, lazily, on first `generate` into `~/.screenshot-composer/chromium`.
  No `playwright-core` refactor is needed. (The packaged smoke test sets
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` only to keep verification fast.)
- **`SELF_ALIAS` published-mode bug (fixed in this work).** `src/config/load.ts` aliased the
  bare `screenshot-composer` specifier to `../index.ts`, which does not exist in `dist/`
  (the build emits `index.js`). It now picks `index.ts` in dev and `index.js` in the built
  package. The packaged smoke test guards this.
