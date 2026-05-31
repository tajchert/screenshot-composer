# Showcase: "Basket" on tablets (sandbox demo)

A companion to the [phone showcase](../../play-screenshots/README.md) that demonstrates the
**tablet form factors** added in v0.2.0. Same fictional **Basket** grocery app and listing
theme, rendered on the landscape-native **`pixel-tablet`** frame at both tablet sizes.

## What it shows

| Slot | Template | Angle | Screen |
|------|----------|-------|--------|
| 01-catalog | showcase | gentle tilt | home (catalog grid) |
| 02-product | overlap | subtle Z-roll | product detail |
| 03-track | bold-headline | slight back-lean | live tracking |
| 04-catalog-flat | showcase | flat | home (catalog grid) |

Plus, the v0.2.0 features specifically:

- **Tablet form factors** — every slot renders at **`tablet7` (1920×1200)** and
  **`tablet10` (3840×2160, 2× device scale)** from `formFactors: ['tablet7', 'tablet10']`.
- **Per-slot `orientation`** — slot `01-catalog` sets `orientation: { tablet7: 'landscape',
  tablet10: 'landscape' }`. Tablets already default to landscape (the `pixel-tablet` frame is
  landscape-native), so this just documents the syntax — set e.g. `{ tablet10: 'portrait' }`
  to export a portrait canvas instead.
- **Render caching** — see "Caching" below.

## Run it

```bash
# 1. regenerate the placeholder app screens — landscape 2560×1600 PNGs (the exact
#    pixel-tablet screen size), written into both tablet7/ and tablet10/ input dirs
node sandbox/tablet/play-screenshots/make-screens.mjs

# 2. render the listing images (run from this sandbox dir — the project base is
#    <cwd>/play-screenshots/)
cd sandbox/tablet
npx tsx ../../src/cli.ts generate
```

Outputs land in `outputs/<locale>/<tablet7|tablet10>/<slotId>.png` — 16 images
(4 slots × 2 locales × 2 tablet sizes). The run prints a `Rendered N, cached M` summary.

### Caching

`generate` caches each output and only re-renders what changed. Run it a second time and
every slot is skipped:

```bash
npx tsx ../../src/cli.ts generate          # → Rendered 0, cached 16  (↳ cached <id> per slot)
npx tsx ../../src/cli.ts generate --force  # bypass the cache and re-render everything
```

Edit a headline (or swap a screenshot) and only the affected outputs re-render. The cache
index lives at `play-screenshots/.cache/index.json` (gitignored).

## Files

- `screenshot-composer.config.ts` — the 4-slot tablet showcase config.
- `make-screens.mjs` — reproducible landscape placeholder generator (SVG → PNG via Sharp).
- `inputs/<locale>/<tablet7|tablet10>/*.png` — the three placeholder landscape screens.
- `outputs/` — rendered listing images (gitignored).

> Tablet screenshots must be **landscape** to match the landscape-native `pixel-tablet`
> frame. The placeholder screens use emoji for product art; under headless rasterization
> these render as black silhouettes, which is fine for a demo placeholder.
