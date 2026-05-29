# Showcase: "Basket" (sandbox demo)

A demo project for `screenshot-composer`, built around a fictional 10-minute grocery
app called **Basket**. It exercises the main features in one render.

## What it shows

| Slot | Template | Frame | Angle | Screen |
|------|----------|-------|-------|--------|
| 01-onboarding | bold-headline | pixel-9-pro | strong left Y-rotation | onboarding |
| 02-browse | showcase | pixel-8 | gentle right Y-tilt | browse |
| 03-product | overlap | pixel-10-pro | Z-roll + float | product |
| 04-checkout | bold-headline | pixel-7a | flat (no tilt) | checkout |
| 05-track | showcase | pixel-9 | X-tilt (leaning back) | track |
| 06-rewards | overlap | pixel-6-pro | opposite Y-rotation | rewards |
| 07-aisle | bold-headline | pixel-10-pro-xl | dramatic low perspective | browse |
| 08-quality | showcase | pixel-8a | subtle combined X+Y+Z | product |

Plus: all **3 templates**, **7 device frames**, a config-level **gradient theme**,
and **two locales** (`en-US` + `de-DE`) so every slot renders localized copy.

## Run it

```bash
# regenerate the placeholder app screens (1080x2400 PNGs, both locales)
node sandbox/play-screenshots/make-screens.mjs

# render the listing images (run from the sandbox/ dir — the project base is
# <cwd>/play-screenshots/)
cd sandbox
npx tsx ../src/cli.ts generate
```

Outputs land in `outputs/<locale>/phone/<slotId>.png`.

## Files

- `screenshot-composer.config.ts` — the 8-slot showcase config.
- `make-screens.mjs` — reproducible placeholder generator (SVG → PNG via Sharp).
- `inputs/<locale>/phone/*.png` — the six placeholder app screens.
- `outputs/` — rendered listing images (gitignored).

> The placeholder screens use emoji for product art; under headless rasterization
> these appear as black silhouettes, which is fine for a demo placeholder.
