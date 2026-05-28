# Design — AOSP-derived frame geometry + layered metal/bezel rendering

Date: 2026-05-28
Status: Approved-pending-review
Scope: device frames (`src/frames/`), licensing files, README

## Problem

The built-in device frames use hand-estimated proportions (e.g. `pixel-9` intrinsic
`800×1700`, screen `{28,30,744,1640,r44}`) and a flat single-gradient body with a thin
inner stroke. They look generic and don't match real device aspect ratios, so user
screenshots don't sit quite right and the frames read as "stylized rectangle".

We have the Android Open Source Project (AOSP) emulator device skins on disk
(`~/Library/Android/sdk/skins/`). Their `layout` text files contain **exact screen
geometry** (display size, corner radius, frame size, bezel offsets). AOSP is licensed
Apache-2.0, which is compatible with this MIT project under a documented mixed license.

## Goals

1. Re-tune the shipped Pixel frames to exact AOSP geometry and add more Pixel devices.
2. Redraw the frame SVGs with a realistic **three-layer** look: metal rim → black bezel
   margin → screen (per reference photo of a real phone corner).
3. Establish the mixed MIT + Apache-2.0 licensing cleanly and attributably.

## Non-goals / boundaries

- **Geometry only.** We read the `layout` *text* files (measurements). We do **not**
  trace, embed, or pixel-analyze the `back.webp`/`mask.webp` rasters.
- SVGs remain **clean-room** redraws. No AOSP raster assets are copied into the repo.
- Button and camera placement stay **stylized & proportional** (not in the layout files).
- No new render-pipeline behavior; `resolveDimensions` stays phone-only (Milestone 5
  unaffected). Tablets remain catalogued assets.

## Decisions (from brainstorming)

- Fidelity: **geometry-only** (layout text), no raster analysis.
- Scope: re-tune Pixel 9 family + tablet; **add** Pixel 6/6-pro, 7/7-pro, 8/8-pro;
  keep `generic-*` frames as MIT clean-room (new look, unchanged geometry).
- Default bezel split: **35% metal rim / 65% black bezel** (per-colorway tunable).
- **2 colorways** per newly-added device (black + one signature color).

## Licensing & attribution

- Add `LICENSE` (MIT — repo currently has no license *file*, only `package.json`/README).
- Add `LICENSE-APACHE` (full Apache License 2.0 text).
- Add `NOTICE` attributing AOSP: states the device-frame **geometry** is derived from the
  Android emulator device skins (Apache-2.0) and that the SVGs are clean-room redraws.
- README "License" section updated to:
  > This project is licensed under the MIT License. However, it incorporates assets and
  > code from the Android Open Source Project (AOSP), which are licensed under the Apache
  > License, Version 2.0. See the LICENSE-APACHE file for details.
- Frame **manifest** schema gains optional `source` and `license` fields. AOSP-derived
  frames record `license: "Apache-2.0"`, `source: "AOSP emulator skin <name>"`; generics
  record `license: "MIT"`. Validated by `FrameManifestSchema`.

## Geometry extraction

- New **offline** dev tool `src/frames/_build/extract-aosp.ts`, run manually
  (`npm run frames:extract`, reads `$ANDROID_HOME/skins`). It parses each `layout` file
  and prints a `PhoneSpec`/`TabletSpec` snippet. **Not** run in CI — its output is
  committed into the `FRAMES` array in `generate.ts` with a per-frame provenance comment,
  so `frames:build` stays self-contained (no SDK needed).
- Per frame, derived purely from `layout`:
  - `intrinsic` = layout `layouts.portrait` (or transposed `landscape`) width/height.
  - `screen` = `{ x: offsetX, y: offsetY, width: display.width, height: display.height,
    radius }`.
  - `radius` = layout `display.corner_radius` when present; otherwise the documented
    fallback `round(0.08 × display.width)` (matches the measured Pixel 9 family ratio
    87/1080 ≈ 0.081). The 6/7/8 layouts omit `corner_radius`.
  - bezel thickness per side = `offset` (L/T) and `frame − offset − display` (R/B); used
    to derive the outer body radius.

### Extracted geometry (committed into `generate.ts`)

Re-tuned (Pixel 9 family — radius from layout):

| id | intrinsic | screen `{x,y,w,h,r}` | source skin |
|---|---|---|---|
| pixel-9 | 1198×2531 | 55,58,1080,2424,87 | pixel_9 |
| pixel-9-pro | 1408×2974 | 60,61,1280,2856,109 | pixel_9_pro |
| pixel-9-pro-xl | 1466×3101 | 57,56,1344,2992,108 | pixel_9_pro_xl |
| pixel-9a | 1224×2570 | 69,73,1080,2424,87 | pixel_9a |
| pixel-tablet | 1837×2798 (portrait transpose) | 117,119,1600,2560,48 | pixel_tablet (landscape, r = 0.03×w fallback) |

New (radius via 0.08×w fallback):

| id | intrinsic | screen `{x,y,w,h,r}` | source skin |
|---|---|---|---|
| pixel-8 | 1187×2513 | 49,55,1080,2400,86 | pixel_8 |
| pixel-8-pro | 1469×3104 | 58,58,1344,2992,108 | pixel_8_pro |
| pixel-7 | 1200×2541 | 59,58,1080,2400,86 | pixel_7 |
| pixel-7-pro | 1547×3272 | 48,66,1440,3120,115 | pixel_7_pro |
| pixel-6 | 1209×2553 | 60,69,1080,2400,86 | pixel_6 |
| pixel-6-pro | 1527×3289 | 41,72,1440,3120,115 | pixel_6_pro |

Generics: geometry **unchanged**; only the rendering model updates.

## Layered SVG rendering model

Replace the current "body gradient + thin inner stroke" in `buildPhoneSvg` /
`buildTabletSvg` with three concentric rounded layers (outer→inner):

1. **Metal frame** — rounded rect over the full intrinsic box, vertical metallic gradient
   (`metal.top → metal.bottom`). Outer corner radius `Rout = screen.radius + minBezel`
   (concentric). A thin **rim highlight** stroke (`rim` color) on the outer edge suggests
   the specular metal edge in the reference photo.
2. **Black bezel margin** — filled rounded rect (`bezel` color) inset from the metal edge
   by `rimWidth = round(0.35 × bezel)`, extending to the screen. Its outer corner radius
   is concentric with the metal; its inner corner equals the screen radius.
3. **Screen** — cut out of layers 1–2 via the existing `mask` so the screenshot shows
   through; same masked-`<rect>` technique as today (`viewBox` = intrinsic, no rasters).

Buttons (two on the right rail) and the front camera punch-hole are drawn as today, with
positions computed proportionally from intrinsic dimensions.

### Colorway schema change

`PhoneColorway` / `TabletColorway` change from
`{ body:{top,bottom}, bezelInner, button, camera }` to:

```ts
interface PhoneColorway {
  metal: { top: string; bottom: string }; // metallic frame gradient (was `body`)
  rim: string;                             // outer specular highlight stroke
  bezel: string;                           // black margin around the screen (was `bezelInner`)
  button: string;
  camera: string;
}
// TabletColorway: same minus `button`.
```

Existing constants (OBSIDIAN, PORCELAIN, HAZEL, IRIS, GRAPHITE, TABLET_*) are rewritten to
the new shape (metal gradients + a light `rim`). New-device signature colorways are added
as needed (e.g. SNOW, BAY, CORAL), each clean-room invented (not sampled from rasters).
Default `rimWidth` ratio = 0.35, defined once in the builder.

These are **generator-time** values — the on-disk manifests store only `colors`/`files`,
so the visual change is fully regenerated by `npm run frames:build`.

## Testing (TDD)

1. `frames-svg-builder.test.ts` — builder output contains: a metal gradient def, a black
   bezel rect (`fill` = bezel color), the screen mask, and a rim-highlight stroke; assert
   the concentric radii (`Rout = r + minBezel`, bezel-inner radius = screen radius).
2. `frames-schema.test.ts` — manifest accepts `source`/`license`; rejects nothing it
   accepted before (back-compat); a generic frame validates with `license: "MIT"`.
3. New `frames-geometry.test.ts` — asserts `pixel-9` (and one new device) spec equals the
   committed AOSP-derived numbers, so future edits can't silently drift from the source.
4. `frames-structural.test.ts` (existing) auto-validates every new frame dir on disk.
5. Full `npm test` + `npm run typecheck` clean; render spot-check of a couple of frames
   via the `frame-only` catalog.

## Rollout

Single milestone-sized change, executed test-first per task:
license files → schema `source/license` → extractor tool → SVG builder model + colorways →
`FRAMES` spec (re-tune + new) → `npm run frames:build` → tests → README/NOTICE → docs.
