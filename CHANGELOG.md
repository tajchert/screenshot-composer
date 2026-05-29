# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open-source governance files for the public GitHub release: `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, this changelog, and `.github/` issue/PR templates
  plus a CI workflow (typecheck + tests).
- `repository`, `homepage`, `bugs`, `keywords`, and `author` metadata in `package.json`.

### Changed
- README status/roadmap updated to reflect Milestones 1–4 complete (3 built-in templates,
  19 device frames).

## [0.0.0]

Pre-release. Milestones 1–4 complete:

- **M1 — Walking skeleton:** `init` + `generate` pipeline rendering one template in one
  frame to a phone PNG.
- **M2 — Config + CLI surface:** hardened Zod schema, friendly multi-issue errors, and the
  `doctor` / `clean` / `templates list` / `frames list` / `--version` commands.
- **M3 — Template system:** the `TemplateModule` contract (typed HTML-string modules),
  shared render helpers, and a project-local template resolver. Built-ins: `bold-headline`,
  `showcase`, `overlap`.
- **M4 — Device frames:** 19 real AOSP emulator device frames (Pixel 4a/5, the Pixel 6–10
  families, and Pixel Tablet), redistributed under Apache-2.0.

[Unreleased]: https://github.com/tajchert/screenshot-composer/compare/v0.0.0...HEAD
[0.0.0]: https://github.com/tajchert/screenshot-composer/releases/tag/v0.0.0
