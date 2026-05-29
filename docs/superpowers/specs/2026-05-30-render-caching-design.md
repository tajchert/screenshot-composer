# Render caching design (Milestone 6, part 1)

**Status:** approved (2026-05-30)
**Scope:** incremental render caching for `generate`, plus a `--force` bypass flag.

## Problem

Every `generate` re-renders every output from scratch — each launches a headless Chromium
page. At realistic locale counts this dominates: 10+ locales × up to 8 slots = 80+ full
renders on every run, even when only one headline changed. The project already exposes a
`play-screenshots/.cache/` path and a `clean --cache` command that wipes it, but nothing
populates the cache yet.

## Goal

Skip re-rendering any output whose inputs haven't changed, so re-runs go from "re-render all
80" to "re-render only what changed." Provide `generate --force` to bypass the cache for a
clean rebuild.

Non-goals (deferred): a content-addressed blob store, cache inspection subcommands, caching
anything other than the final per-output bytes, hashing of files transitively imported by a
project-local template.

## Approach: index-only cache

No separate blob store. The cache is a single index file recording, per output, the cache key
that produced it and the extension that was written. A **cache hit** requires both:

1. the recorded key matches the freshly-computed key, **and**
2. the expected output file is still present on disk.

If the output was deleted, the entry is treated as a miss and the output is re-rendered. This
keeps `.cache/` tiny (just JSON) at the cost of re-rendering when `outputs/` is removed —
an accepted trade-off.

## Cache key (per output)

A SHA-256 over a canonically serialized (recursively sorted-key) record of everything that
affects one rendered output. Computed in a new `src/render/cache.ts`. Inputs:

- `cacheFormatVersion` — a constant in `cache.ts`, bumped when the key algorithm itself
  changes (forces a global rebuild on upgrade).
- `tool` and `chromium` versions from `versionInfo()` — a tool or Chromium upgrade that can
  change rendering output busts every entry.
- `locale`, `format`, and the resolved `{ width, height, scale }` from `resolveDimensions`.
- `slot.id`, `slot.frame.id`, `slot.template`, and `slot.layout`.
- The **resolved copy map** for this locale — the actual strings after `defaultLocale`
  fallback, i.e. exactly what `compose.ts` passes to the template.
- `config.theme`.
- **Screenshot file bytes** → SHA-256 of the input file content.
- **Project-local template source** → SHA-256 of `templates/<id>/index.ts` if that file
  exists; otherwise `null` (built-in template changes ride on the tool version).

Built-in frame assets and built-in template source ship with the package, so the `tool`
version covers their changes — no separate hashing.

**Known limitation (documented):** a project-local template that `import`s sibling files is
fingerprinted only by its `index.ts`. Editing an imported helper will not bust the cache;
`--force` is the escape hatch. Noted in CLAUDE.md.

## Cache index

`play-screenshots/.cache/index.json`:

```json
{
  "version": 1,
  "entries": {
    "en-US/phone/01-hero": { "key": "<sha256-hex>", "ext": "png" }
  }
}
```

- Identity key = `"<locale>/<format>/<slotId>"`.
- `ext` is stored because `enforceConstraints` may emit `png` or `jpg`; the existence check
  in step 2 of a hit needs to know which output file to look for.
- `version` is the index-file schema version (distinct from `cacheFormatVersion`); a mismatch
  causes the whole index to be discarded (treated as empty).
- A missing or unparseable index is treated as empty (never fatal).

## `generate` flow

`runGenerate` gains a `force?: boolean` option. Behaviour:

1. Load the index once at start (empty on missing/corrupt/version-mismatch).
2. For each (slot, locale, format):
   - Compute the cache key.
   - **Hit** — not `force`, an entry exists for the identity, `entry.key === key`, and the
     output file `outputs/<locale>/<format>/<slot>.<entry.ext>` exists → skip; print
     `↳ cached <locale>/<format>/<slot>`.
   - **Miss** — render via `renderSlot`, write the output, then:
     - remove a stale sibling output with the *other* extension if present (handles a slot
       that flipped png↔jpg between runs);
     - update the in-memory entry to `{ key, ext }`;
     - print `✓ <locale>/<format>/<slot>`.
3. Persist the index **incrementally after each successful render** (small JSON, written
   atomically via temp-file + rename) so a mid-run failure still banks completed work.
4. Print a summary line: `Rendered N, cached M`.

`--force` always re-renders but still updates the index, so the next non-forced run is warm.
Filters (`--slot` / `--locale` / `--format`) only process matching identities; index entries
for other identities are loaded and preserved untouched (no pruning).

## Module boundaries

- **`src/render/cache.ts`** (new):
  - `computeCacheKey(params): string` — pure; SHA-256 of the canonical record.
  - `loadCacheIndex(cacheDir): Promise<CacheIndex>` — tolerant of missing/corrupt/version
    mismatch.
  - `saveCacheIndex(cacheDir, index): Promise<void>` — atomic write.
  - `identityKey(locale, format, slotId): string` and
    `outputFilePath(outputsDir, locale, format, slotId, ext): string` helpers.
  - small internal helpers: `hashBytes`, `stableStringify`.
- **`resolveCopy(slot, locale, defaultLocale)`** — extracted from the inline loop in
  `compose.ts` and reused both there and when building the cache key, so the
  `defaultLocale`-fallback logic is defined once.
- **`src/commands/generate.ts`** — orchestrates load / lookup / skip / render / persist;
  gains the `force` option and the summary output.
- **`src/cli.ts`** — adds `--force` to the `generate` command, threaded into `runGenerate`.
- **`clean --cache`** already removes `.cache/` — unchanged; gains a test against a populated
  cache.

## Testing (TDD)

Unit — `tests/cache.test.ts`:

- Key is stable across repeated calls with identical inputs.
- Key changes when any of these change: resolved copy, theme, layout, frame id, template id,
  screenshot bytes, project-local template source, tool version, chromium version, resolved
  dimensions.
- Index round-trips through save/load.
- Corrupt JSON, missing file, and `version` mismatch all load as empty.

Integration — `generate` caching (real Chromium, temp project):

- First run renders all outputs and populates `index.json`.
- Second run with no changes is fully cached (assert via the rendered/cached counts and that
  output file mtimes are unchanged).
- Editing one screenshot (or one copy string) re-renders only the affected output.
- Deleting an output file forces its re-render even though the index entry is valid.
- `--force` re-renders everything and refreshes the index.
- A simulated tool/Chromium version change busts the cache.

`clean`:

- `clean --cache` removes a *populated* `.cache/` (extends the existing test).

## Docs to update on completion

- `README.md` — drop the "re-renders everything" limitation; document `--force`.
- `CLAUDE.md` — note the cache pipeline, the index format, and the project-local-template
  fingerprint limitation; update the "implemented vs planned" status for Milestone 6.
