# Security Policy

## Supported versions

`screenshot-composer` is pre-release (`0.x`). Only the latest version on the default branch
is supported; please update before reporting.

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:
**[Report a vulnerability](https://github.com/tajchert/screenshot-composer/security/advisories/new)**
("Security" tab → "Report a vulnerability").

We'll acknowledge your report as soon as possible and keep you informed about the fix and
disclosure timeline.

## Scope notes

This is a **local-first CLI** with no server, database, or network calls at render time
except a one-time Chromium download. The most relevant areas for security review are:

- The local HTTP render server (`src/render/server.ts`) — note the `/input` route is
  path-traversal guarded via `path.relative` containment.
- Config loading, which executes the user's own `screenshot-composer.config.ts` (a
  TypeScript file in their repo) via `jiti`. Treat configs from untrusted sources as you
  would any executable code.
