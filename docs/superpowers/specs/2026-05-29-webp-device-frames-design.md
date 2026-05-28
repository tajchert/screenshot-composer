# Design — webp device frames (AOSP emulator skins) replacing clean-room SVGs

Date: 2026-05-29
Status: Approved-pending-review
Supersedes the rendering half of: `2026-05-28-aosp-frame-geometry-design.md`
Scope: device frames (`src/frames/`), render compositing (`deviceMarkup`/`compose`), licensing

## Problem

The clean-room SVG frames are stylized approximations — they don't look like the real
devices. The Android Open Source Project (AOSP) emulator skins on disk ship pixel-accurate
device frame images (`back.webp`) plus a display corner mask (`mask.webp`) and a `layout`
file with exact geometry. AOSP is Apache-2.0, compatible with this MIT project under the
mixed license already established. Use the real webp assets instead of redrawing SVGs.

## Decisions (from brainstorming)

- **Swap in-place.** Keep the licensing files, manifest schema (evolved), screen geometry,
  the `aosp-layout` parser, and the geometry guard test. Replace the SVG assets, the SVG
  builder (`svg.ts`), and the SVG overlay in `deviceMarkup` with webp assets + raster
  compositing. No `git revert`.
- **webp-only renderer.** One real color per device. Delete the SVG builder and the three
  invented `generic-*` frames. Single raster render path.
- **Expand the catalog** to every SDK skin with the standard single-display trio
  (`layout` + `back.webp` + `mask.webp`): 21 frames (Pixel 4–10 families + Pixel Tablet).

## Non-goals / boundaries

- Foldables (`pixel_fold`, `*_pro_fold`), Pixel 2/3 (older skin format), Nexus, Wear, TV,
  and Automotive are out — they lack the standard trio. Not handled.
- No new render route. The webp is embedded as a base64 data-URI in the composed HTML; the
  `/render?slot&locale&format` contract is unchanged.
- `resolveDimensions` stays phone-only (Milestone 5 unaffected). `pixel-tablet` ships as a
  catalogued landscape-native asset that `generate` cannot render yet.
- The frame `back.webp` is overlaid as-is; we do **not** recolor or modify the AOSP images.

## Scope-boundary change

CLAUDE.md's hard boundary "frames are clean-room SVG redrawn assets" is **replaced**: built-in
frames are now the AOSP emulator device images (Apache-2.0), composited under the screenshot.
This is a deliberate, approved design change. CLAUDE.md must be updated to say so.

## Device catalog (21)

`pixel-4`, `pixel-4-xl`, `pixel-4a`, `pixel-5`, `pixel-6`, `pixel-6-pro`, `pixel-6a`,
`pixel-7`, `pixel-7-pro`, `pixel-7a`, `pixel-8`, `pixel-8-pro`, `pixel-8a`, `pixel-9`,
`pixel-9-pro`, `pixel-9-pro-xl`, `pixel-9a`, `pixel-10`, `pixel-10-pro`, `pixel-10-pro-xl`,
`pixel-tablet`. (Skin id `pixel_9` → frame id `pixel-9`.)

## Asset model & manifest

Each `src/frames/<id>/` holds the copied `back.webp` + `mask.webp` and a `manifest.json`:

```json
{
  "id": "pixel-9",
  "displayName": "Pixel 9",
  "manufacturer": "Google",
  "intrinsic": { "width": 1198, "height": 2531 },
  "screen": { "x": 55, "y": 58, "width": 1080, "height": 2424, "radius": 87 },
  "image": "back.webp",
  "mask": "mask.webp",
  "source": "AOSP emulator skin pixel_9",
  "license": "Apache-2.0"
}
```

Schema changes (`src/frames/schema.ts`):
- **Remove** `colors` and `files`.
- **Add** `image: z.string().min(1)` (required) and `mask: z.string().min(1).optional()`.
- Keep `intrinsic`, `screen`, `shadow?`, `source?`, `license?`, and the screen-bounds
  `superRefine`. (`radius` from the layout `corner_radius`, or the documented
  `round(0.08 × display.width)` fallback when a skin omits it.)

`displayName` is derived from the skin id (e.g. `pixel_9_pro_xl` → `Pixel 9 Pro XL`).
`manufacturer` is `Google` for all 21.

## Frame loading (`src/frames/load.ts`)

- `loadFrame(id)` returns `{ manifest, imageDataUri, maskDataUri? }`, reading `back.webp`
  (and `mask.webp` if present) and encoding as `data:image/webp;base64,…`. The `color`
  parameter is removed.
- `listFrameInfos()` returns `{ id, displayName }` (no `colors`). `frames list` output and
  its tests update accordingly.

## Import tool (`src/frames/_build/import-aosp.ts`)

Replaces `extract-aosp.ts`. Offline, maintainer-run (`npm run frames:import -- <skin…>`,
needs `$ANDROID_HOME`). For each skin:
1. Parse `layout` via the existing `parseAospLayout` (reused, unchanged) → intrinsic, screen
   rect, corner radius (with the 0.08×width fallback).
2. Copy `back.webp` + `mask.webp` into `src/frames/<id>/`.
3. Write `manifest.json` (`displayName` derived, `license: "Apache-2.0"`,
   `source: "AOSP emulator skin <skin>"`).

A second script `frames:import:all` (or documented arg list) imports all 21. Committed output
is the source of truth; the tool is excluded from CI. `src/frames/_build/generate.ts` and
`svg.ts` are deleted. Adds ~4–6 MB of webp to the repo.

## Render pipeline (`deviceMarkup` in `src/templates/shared.ts`)

`TemplateProps.frame` changes from `{ intrinsic, screen, svg }` to
`{ intrinsic, screen, image: string, mask?: string }` (data-URIs). New `deviceMarkup`:

```
<div style="position:relative; width:DEVW; height:DEVH; transform:…; transform-origin:center center;">
  <img  <!-- screenshot, behind -->
        style="position:absolute; left:SX%; top:SY%; width:SW%; height:SH%;
               object-fit:cover; border-radius:Rpx;" src="SCREENSHOT_URL">
  <img  <!-- device frame, on top: transparent screen hole shows screenshot through -->
        style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;"
        src="FRAME_IMAGE_DATA_URI">
</div>
```

- `SX/SY/SW/SH` and `R` come from `computeDevice` (reused) — `R = (screen.radius/intrinsic.width)·deviceWidth`.
- The frame `<img>` fills the device box (resolution-independent, like the SVG did).
- `mask.webp` is copied and available; the renderer relies on `back.webp`'s baked-in
  transparent rounded hole + the screenshot's `border-radius`. If corner bleed appears in
  verification, add `mask.webp` as a foreground overlay `<img>` (third layer). The plan must
  include a visual check at this step.
- `shadow` (optional) applies as a CSS `filter: drop-shadow(...)` on the frame `<img>`.

`compose.ts` loads the frame via `loadFrame(slot.frame.id)` and passes `image`/`mask`
data-URIs. Slot `frame.color` stays optional in the config schema but is ignored (back-compat).

## Licensing

- `NOTICE`: reword to state the repo **includes device-frame images** (`back.webp`,
  `mask.webp`) from the AOSP emulator skins, licensed Apache-2.0 — not merely derived
  geometry. Keep `LICENSE`, `LICENSE-APACHE`, README note, `package.json` SPDX
  `"MIT AND Apache-2.0"`. Per-manifest `license`/`source` as above.

## Removed

`src/frames/_build/svg.ts`, `src/frames/_build/generate.ts`, all `<color>.svg` files, the
three `generic-android` / `generic-tablet-7` / `generic-tablet-10` frames,
`tests/frames-svg-builder.test.ts`, and `src/frames/_build/extract-aosp.ts` (→ `import-aosp.ts`).
`npm run frames:build` is replaced by `frames:import`.

## Testing

1. `tests/frames-schema.test.ts` — accepts `image`/`mask`; rejects a manifest missing
   `image`; screen-bounds refine still works.
2. `tests/aosp-layout.test.ts` — unchanged (parser reused).
3. `tests/frames-geometry.test.ts` — assert a representative subset of devices
   (`pixel-9`, `pixel-10-pro-xl`, `pixel-tablet`) on-disk manifests match known
   intrinsic/screen numbers + `license: "Apache-2.0"` + `source`. Guards drift.
4. `tests/frames-structural.test.ts` — **rewritten**: every frame dir has `manifest.json`
   + `back.webp` (+ `mask.webp` if declared); each webp validates via `sharp.metadata()`
   and its pixel dimensions equal `intrinsic` (`back.webp`) / display size (`mask.webp`);
   manifest validates.
5. `tests/shared.test.ts` — `deviceMarkup` emits the screenshot `<img>` + the frame `<img>`
   with the frame filling the box (no inline `<svg>`).
6. Render integration (`renderSlot`/`generate` tests) — render a slot with a webp frame to a
   valid in-constraint PNG (update frame ids used).
7. `tests/licensing.test.ts` — NOTICE mentions device-frame images from AOSP.

## Verification (in the plan)

After import + pipeline swap, render `pixel-9` and one more device frame-only on white and a
real screenshot in a tilted frame; confirm the screenshot fills the screen, corners are clean
(decide mask.webp necessity here), and the bezel looks right.

## Rollout (single milestone, test-first)

schema (image/mask) → import-aosp tool → import 21 frames (commit assets) → loadFrame
(data-URI) → deviceMarkup (raster) + TemplateProps → compose → delete svg.ts/generate.ts/
generic frames/svg files → rewrite structural + svg-builder removal → update geometry/
schema/shared/frames-list tests → NOTICE/CLAUDE/README docs → full suite + render check.
