import type { AospGeometry } from './aosp-layout.js';
import type { FrameManifest } from '../schema.js';

export function skinToId(skin: string): string {
  return skin.replaceAll('_', '-');
}

export function skinDisplayName(skin: string): string {
  return skin
    .split('_')
    .map((t) => (t === 'xl' ? 'XL' : t === 'pro' ? 'Pro' : t.charAt(0).toUpperCase() + t.slice(1)))
    .join(' ');
}

/** Pure: build a manifest object from a skin id + parsed layout geometry.
 *  `measuredRadius` (the corner radius read off the back.webp artwork) is preferred when
 *  the layout omits `corner_radius`; the `0.08 * width` guess is only a last resort for
 *  callers that have no artwork to measure (e.g. unit tests). */
export function buildFrameManifest(
  skin: string,
  geo: AospGeometry,
  measuredRadius?: number,
): FrameManifest {
  const radius = geo.cornerRadius ?? measuredRadius ?? Math.round(0.08 * geo.display.width);
  return {
    id: skinToId(skin),
    displayName: skinDisplayName(skin),
    manufacturer: 'Google',
    intrinsic: { width: geo.frame.width, height: geo.frame.height },
    screen: { x: geo.offset.x, y: geo.offset.y, width: geo.display.width, height: geo.display.height, radius },
    image: 'back.webp',
    mask: 'mask.webp',
    source: `AOSP emulator skin ${skin}`,
    license: 'Apache-2.0',
  };
}
