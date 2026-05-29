# Milestone 5a — Form factors + tablet frames + orientation — Design Spec

**Date:** 2026-05-29
**Status:** Approved design, ready to decompose into an implementation plan
**Milestone:** 5a (the first half of the roadmap's Milestone 5)

---

## 0. Context

The original design (`2026-05-27-screenshot-composer-design.md` §13.5) defines Milestone 5
as *"All form factors + i18n (Latin) + theming + tilt — `deviceScaleFactor` scaling, tablet
frames, per-locale copy, font strategy, RTL plumbing, text-fit, backgrounds, palette, tilt
presets/sliders."*

That is seven loosely-coupled features. To ship in shippable increments we **split
Milestone 5 into two specs/plans**:

- **5a (this spec): the geometry half** — form factors, `deviceScaleFactor` scaling, tablet
  frames, and a per-slot/per-form-factor **orientation** model. Tilt already works
  end-to-end (raw `x/y/z` + `translate`/`perspective`), so it needs only verification at the
  new aspect ratios — no preset layer (YAGNI; sliders are the deferred editor).
- **5b (future spec): the text/i18n half** — bundled Latin fonts (Inter + Manrope + Geist),
  RTL (`dir` from locale + CSS logical properties), and auto shrink-to-fit headline sizing.

Backgrounds, palette, and per-locale copy resolution are **already implemented** (M2–M4) and
out of scope here except where tablet aspect ratios exercise them.

## 1. Current state (what already works)

- `resolveDimensions(format)` (`src/render/constraints.ts`) handles **phone only** and throws
  for `tablet7`/`tablet10`.
- The `pixel-tablet` frame asset exists (landscape-native, intrinsic 2798×1837, screen
  2560×1600) but `generate` cannot render it because tablets throw.
- `renderSlot` opens a Playwright context at `viewport: {width,height}` + `deviceScaleFactor`
  from `resolveDimensions`, and `compose` passes the same `width`/`height` to the template.
- Per-locale copy resolution (locale → `defaultLocale` fallback) works in `compose.ts`.
- Tilt/translate/perspective work via `deviceTransform` and the `LayoutSchema`.

## 2. Scope

**In scope:**
1. Tablet form factors render (`tablet7`, `tablet10`); remove the phone-only throw.
2. `deviceScaleFactor`-based resolution scaling so templates author once at a logical
   viewport (CLAUDE.md gotcha #4) and tablet10 upscales ×2.
3. A per-slot, per-form-factor **orientation** model with sensible defaults.
4. The `pixel-tablet` frame becomes renderable to tablet form factors.
5. Verify built-in templates render cleanly at landscape and tablet aspect ratios.

**Out of scope (deferred to 5b or later):** bundled fonts, RTL, text-fit headline sizing,
tilt presets/sliders, portrait-native tablet frame assets.

## 3. Dimension & scale table

The single source of truth for `(formFactor, orientation) → viewport`. Logical viewport is
what templates author against; `deviceScaleFactor` (DSF) multiplies to the export pixels.
All targets satisfy Google Play's min/max side limits and the 16:9 / 9:16 aspect requirement.

| Form factor | Orientation        | Logical viewport | DSF | Export px   |
|-------------|--------------------|------------------|-----|-------------|
| phone       | portrait (default) | 1080 × 1920      | 1   | 1080 × 1920 |
| phone       | landscape          | 1920 × 1080      | 1   | 1920 × 1080 |
| tablet7     | landscape (default)| 1920 × 1200      | 1   | 1920 × 1200 |
| tablet7     | portrait           | 1200 × 1920      | 1   | 1200 × 1920 |
| tablet10    | landscape (default)| 1920 × 1080      | 2   | 3840 × 2160 |
| tablet10    | portrait           | 1080 × 1920      | 2   | 2160 × 3840 |

Notes:
- tablet10 uses DSF=2 for crisp output at large export sizes; templates never see the
  multiplier — they lay out against the logical size.
- tablet7 stays DSF=1 (its export already sits within Play's 320–3840 side range and needs no
  upscaling).
- phone landscape is included for completeness/symmetry; the default remains portrait.

## 4. Orientation model

**Resolution rule:** `orientation = slot.orientation?.[format] ?? DEFAULT_ORIENTATION[format]`
where `DEFAULT_ORIENTATION = { phone: 'portrait', tablet7: 'landscape', tablet10: 'landscape' }`.

**Schema (`src/config/schema.ts`):** add an optional per-slot map keyed by form factor:

```ts
const OrientationEnum = z.enum(['portrait', 'landscape']);
// added to SlotSchema:
orientation: z
  .object({
    phone: OrientationEnum.optional(),
    tablet7: OrientationEnum.optional(),
    tablet10: OrientationEnum.optional(),
  })
  .optional(),
```

This gives zero-config sensible defaults for the common case and full per-form-factor control
when needed (e.g. `orientation: { tablet10: 'portrait' }`). A `Slot` rendered to several form
factors thus gets the right orientation for each.

## 5. Frame orientation handling (the one real design choice)

**Decision: frames composite in their native orientation; the orientation field controls only
the output canvas dimensions.**

The `pixel-tablet` frame is landscape-native. Whether the canvas is portrait or landscape, the
device renders landscape and the template positions it within the canvas. A landscape device
centered on a tall (portrait) background is a valid, common Play composition. Templates already
size the device responsively from `width`/`height` props, so this requires **zero
frame-rotation code**.

**Rejected alternative — rotate the frame 90° via CSS to fake a portrait tablet:** rotating the
device as a unit also rotates the screen hole and the (landscape) screenshot, producing a
sideways device with the camera/home edge on the wrong side. It would also demand screenshot
re-orientation we do not control (we *consume* screenshots, never transform their content).
Portrait-native tablet frames are a future **asset**, not a render trick.

**Documented consequence:** a tablet slot's screenshot must match the frame's screen aspect
(a landscape screenshot for the landscape `pixel-tablet` frame), placed under
`inputs/{locale}/{tablet7|tablet10}/`. This follows the existing scope boundary that the user
supplies appropriately-shaped screenshots.

## 6. Architecture & module changes

A new pure helper centralizes target resolution so `renderSlot` (viewport + DSF) and `compose`
(template `width`/`height`) never drift:

```ts
// src/render/target.ts (new)
export type Orientation = 'portrait' | 'landscape';
export const DEFAULT_ORIENTATION: Record<FormFactorT, Orientation>;
export function resolveOrientation(slot: Slot, format: FormFactorT): Orientation;
export interface RenderTarget { width: number; height: number; scale: number; orientation: Orientation; }
export function resolveRenderTarget(slot: Slot, format: FormFactorT): RenderTarget;
```

Changes:

| File | Change |
|------|--------|
| `src/config/schema.ts` | Add `orientation` to `SlotSchema`; export `Orientation` type if useful. |
| `src/render/constraints.ts` | `resolveDimensions(format, orientation)` returns the full §3 table; remove the throw. |
| `src/render/target.ts` (new) | `DEFAULT_ORIENTATION`, `resolveOrientation`, `resolveRenderTarget`. |
| `src/render/compose.ts` | Use `resolveRenderTarget(slot, format)` for `width`/`height`. (compose already holds the slot + config.) |
| `src/render/renderSlot.ts` | Accept the resolved `RenderTarget` (or `slot` + `format`) as a parameter instead of calling `resolveDimensions(format)` itself; use it for `viewport` + `deviceScaleFactor`. |
| `src/commands/generate.ts` | Compute `resolveRenderTarget(slot, format)` (it already iterates `slot` objects and holds `config`) and pass it to `renderSlot`. |
| templates | Verify clean rendering at landscape/tablet aspects; minimal tweaks only if something overflows the canvas. |

**Render route stays unchanged.** The stable `/render?slot&locale&format` contract is *not*
extended — `compose` derives orientation internally from the config + slot, so no
`&orientation=` query param is added. The viewport size is set in `renderSlot` from a
`RenderTarget` computed by `generate.ts` (which already has both `config` and the `slot`); the
`RenderServer` interface is **not** widened to carry the config.

## 7. Testing (TDD)

**Unit:**
- `resolveDimensions(format, orientation)` returns the exact §3 table for all six rows.
- `resolveRenderTarget` / `resolveOrientation`: defaults applied per form factor; per-form-factor
  overrides honored; unspecified form factors fall back to defaults.
- Schema: a config with `orientation: { tablet10: 'portrait' }` validates; an invalid value
  (e.g. `'sideways'`) is rejected with a field-path error.

**Integration (real Chromium):**
- Render the `pixel-tablet` frame to `tablet10` landscape → assert output is 3840×2160 and ≤8 MB.
- Render a `tablet7` slot with a `portrait` override → assert 1200×1920 and ≤8 MB.
- Existing phone render tests stay green (no regression).

**CLI smoke:** a config with `formFactors: ['phone', 'tablet10']` runs `generate` and writes
both `phone/` and `tablet10/` outputs.

Test fixtures must supply a tablet-shaped (landscape) screenshot for tablet renders. Use
`os.mkdtemp` isolation; never write into the repo (existing convention).

## 8. Risks & notes

- **Logical viewport choice for tablet7** (DSF=1, 1920×1200) means its output is authored at
  full export size — fine, but template px constants tuned for 1080-wide phones will look
  small. Headline polish across aspect ratios is explicitly 5b (text-fit) work; 5a only
  guarantees correct, non-overflowing rendering.
- **No new query param** keeps the render-route contract stable (CLAUDE.md). Target resolution
  lives in `generate.ts` (which already owns `config` and the `slot`) and is passed into
  `renderSlot`; the `RenderServer` interface is not widened.
- After 5a, update CLAUDE.md's "Current state" line and `resolveDimensions` description, and
  note in README that tablets render (with the landscape-screenshot caveat).
