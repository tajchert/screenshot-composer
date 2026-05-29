# Releasing screenshot-composer

How to cut a release. Today releases are **manual** (Phase 1). The tag-driven GitHub Actions
automation (Phase 2) is documented at the bottom for when it's worth setting up.

The full design is in
[`docs/superpowers/specs/2026-05-29-track-b-distribution-design.md`](docs/superpowers/specs/2026-05-29-track-b-distribution-design.md).

---

## What ships

`npm publish` packs only what `package.json` `files` allows: the built `dist/` (compiled JS,
type declarations, and the copied frame `.webp`/`manifest.json` assets), plus `NOTICE` and
`CHANGELOG.md`. `README.md`, `LICENSE`, and `LICENSE-APACHE` are included automatically by
npm. Source (`src/`), tests, and `docs/` are **not** published.

The build is `tsc -p tsconfig.build.json` followed by `scripts/build-finalize.mjs`, which
copies the frame assets next to the compiled loader and makes `dist/cli.js` executable. It
runs automatically via the `prepack` hook on `npm publish` / `npm pack`.

---

## Phase 1 — manual release (current)

### One-time setup

1. Create an npm account at <https://www.npmjs.com/signup> and enable 2FA
   ("Authorization and Publishing").
2. Log in on your machine:
   ```bash
   npm login        # opens a browser / prompts for an OTP
   npm whoami       # should print your username
   ```

### Cut a release

1. **Pick the version** and update it everywhere:
   - bump `version` in `package.json` (semver),
   - move the `CHANGELOG.md` "Unreleased" entries under a new `## [x.y.z]` heading.
2. **Verify** the artifact before publishing:
   ```bash
   npm run typecheck
   npm test            # full suite (launches Chromium; ~minutes)
   npm run smoke       # packs + installs into a temp project + exercises the binary
   ```
   `npm run smoke` is the important one — it proves the *packaged* tool installs and runs
   (bin wiring, shipped frame assets, and `import 'screenshot-composer'` resolving from
   `node_modules`).
3. **Publish:**
   ```bash
   npm publish --access public
   # add --provenance only from CI (it needs a GitHub OIDC token); skip it for a local publish
   ```
   For the very first publish the package name is claimed at this step.
4. **Tag and push the git release:**
   ```bash
   git tag vX.Y.Z
   git push origin master        # or your default branch
   git push origin vX.Y.Z
   ```
   Optionally create a GitHub Release from the tag with the changelog notes.
5. **Verify it's live:**
   ```bash
   npm view screenshot-composer version
   ```

### Update the Homebrew formula (manual)

The tap lives at <https://github.com/tajchert/homebrew-tap>. After the npm publish:

1. Get the tarball URL and its sha256:
   ```bash
   VER=$(npm view screenshot-composer version)
   URL="https://registry.npmjs.org/screenshot-composer/-/screenshot-composer-$VER.tgz"
   curl -sL "$URL" | shasum -a 256        # copy the hash
   ```
2. Edit `Formula/screenshot-composer.rb` in the tap repo with the new `url` + `sha256`
   (template below), commit, and push.
3. Test locally:
   ```bash
   brew install --build-from-source tajchert/tap/screenshot-composer
   screenshot-composer --version
   ```

#### Formula template (`Formula/screenshot-composer.rb`)

```ruby
require "language/node"

class ScreenshotComposer < Formula
  desc "Compose Google Play Store screenshots from Android app screenshots"
  homepage "https://github.com/tajchert/screenshot-composer"
  url "https://registry.npmjs.org/screenshot-composer/-/screenshot-composer-X.Y.Z.tgz"
  sha256 "REPLACE_WITH_SHA256"
  license all_of: ["MIT", "Apache-2.0"]

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      On first `screenshot-composer generate`, Chromium (~170 MB) is downloaded once into
      ~/.screenshot-composer/chromium. No download happens until you render.
    EOS
  end

  test do
    assert_match "screenshot-composer", shell_output("#{bin}/screenshot-composer --version")
  end
end
```

---

## Phase 2 — automated release (future)

When manual steps get tedious, add tag-driven CI. This is a mechanical follow-up.

### Secrets to configure (GitHub → Settings → Secrets and variables → Actions)

- **`NPM_TOKEN`** — an npm **Granular Access Token** (read/write, scoped to the
  `screenshot-composer` package) or a classic **Automation** token. Automation/granular
  tokens bypass the interactive OTP, which CI cannot answer.
- **`HOMEBREW_TAP_TOKEN`** — a GitHub PAT that can push to `tajchert/homebrew-tap`.

### Workflow (`.github/workflows/release.yml`)

Trigger on `push` of tags matching `v*`, with permissions `contents: write` (GitHub Release)
and `id-token: write` (npm provenance). Steps:

1. checkout → `actions/setup-node` (Node 20, `registry-url: https://registry.npmjs.org`,
   `cache: npm`)
2. `npm ci` → `npm run typecheck` → `npm run build`
3. `npm run smoke`
4. `npm publish --provenance --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
5. create a GitHub Release from the matching `CHANGELOG.md` section
   (e.g. `softprops/action-gh-release`)
6. bump the Homebrew formula in `tajchert/homebrew-tap`
   (e.g. `dawidd6/action-homebrew-bump-formula`) using `${{ secrets.HOMEBREW_TAP_TOKEN }}`

Once this is in place, cutting a release is just: bump `version` + `CHANGELOG.md`, commit,
`git tag vX.Y.Z && git push --tags`.

---

## Chromium download

Chromium (~170 MB) is downloaded **once, lazily, on first `screenshot-composer generate`**,
into `~/.screenshot-composer/chromium` (`src/render/chromium.ts` shells out to the bundled
Playwright CLI). Installing the package itself downloads nothing: the pinned `playwright`
version has no install/postinstall browser fetch (verified on 1.60). The `npm run smoke`
test sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` only to keep verification fast — that flag is
not needed in normal use.
