import sharp from 'sharp';
import type { FormFactorT, Orientation } from '../config/schema.js';
import { ConstraintError } from '../errors.js';

export interface Dimensions {
  width: number;
  height: number;
  scale: number;
}

/**
 * Logical viewport (template authoring size) + deviceScaleFactor for each
 * (form factor, orientation). Logical × scale = the exported pixel size, which
 * stays within Google Play's per-side limits and 16:9 / 9:16 aspect rules.
 */
export function resolveDimensions(format: FormFactorT, orientation: Orientation = 'portrait'): Dimensions {
  const portrait = orientation === 'portrait';
  switch (format) {
    case 'phone':
      return portrait ? { width: 1080, height: 1920, scale: 1 } : { width: 1920, height: 1080, scale: 1 };
    case 'tablet7':
      return portrait ? { width: 1200, height: 1920, scale: 1 } : { width: 1920, height: 1200, scale: 1 };
    case 'tablet10':
      return portrait ? { width: 1080, height: 1920, scale: 2 } : { width: 1920, height: 1080, scale: 2 };
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unhandled form factor: ${String(_exhaustive)}`);
    }
  }
}

const MAX_BYTES = 8 * 1024 * 1024;

/** Returns the PNG unchanged if under 8 MB, else the smallest acceptable JPEG. */
export async function enforceConstraints(png: Buffer, slotId: string): Promise<Buffer> {
  if (png.byteLength <= MAX_BYTES) return png;
  for (const quality of [95, 90, 85, 80, 75]) {
    const jpeg = await sharp(png).jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
    if (jpeg.byteLength <= MAX_BYTES) return jpeg;
  }
  throw new ConstraintError(`Cannot fit output under 8 MB for slot ${slotId}`);
}

/** Returns the file extension matching a PNG or JPEG buffer. */
export function extFor(buf: Buffer): 'png' | 'jpg' {
  return buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg' : 'png';
}
