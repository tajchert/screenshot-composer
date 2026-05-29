import sharp from 'sharp';

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Measure a device's true display corner radius from its `back.webp` artwork.
 *
 * Why this exists: older AOSP skins (Pixel 4a–9a, tablet) omit `corner_radius` from
 * their `layout` file, and the importer used to fall back to a `0.08 * width` *guess*.
 * That guess disagreed badly with the real hole baked into `back.webp` (e.g. pixel-7a
 * guessed 86 vs the real 39, pixel-tablet 205 vs 26). Since `screen.radius` drives the
 * screenshot's CSS `border-radius`, an over-large value made the rounded screenshot curve
 * inward past the device's screen hole, leaking the page background through the corner gap.
 *
 * The artwork is the source of truth, so measure it: at the screen-rect corner the body
 * is opaque, and the transparent hole begins `radius` px inward along each edge. Returns
 * `null` when the corner pixel is already transparent — that happens on newer skins where
 * the screen rect slightly overshoots the device silhouette (the corner sits *outside* the
 * body); those skins declare an accurate `corner_radius` in their layout, so the caller
 * keeps that instead.
 */
export async function measureScreenCornerRadius(
  backWebp: string | Buffer,
  screen: ScreenRect,
): Promise<number | null> {
  const { data, info } = await sharp(backWebp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, channels } = info;
  const alpha = (px: number, py: number): number => data[(py * width + px) * channels + (channels - 1)];

  const OPAQUE = 128;
  // Corner outside the body (transparent) → cannot be measured from the hole; let the
  // layout's declared corner_radius win.
  if (alpha(screen.x, screen.y) < OPAQUE) return null;

  // Walk inward from the corner along the top edge and the left edge; the first transparent
  // pixel marks where the rounded hole begins. For a rounded rectangle both insets equal the
  // corner radius; average them to smooth anti-aliasing.
  let top = -1;
  for (let px = screen.x; px < screen.x + screen.width; px++) {
    if (alpha(px, screen.y) < OPAQUE) {
      top = px - screen.x;
      break;
    }
  }
  let left = -1;
  for (let py = screen.y; py < screen.y + screen.height; py++) {
    if (alpha(screen.x, py) < OPAQUE) {
      left = py - screen.y;
      break;
    }
  }
  if (top < 0 || left < 0) return null;
  return Math.round((top + left) / 2);
}
