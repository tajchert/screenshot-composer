import sharp from 'sharp';
import type { FormFactorT } from '../config/schema.js';
import { ConstraintError } from '../errors.js';

export interface Dimensions {
  width: number;
  height: number;
  scale: number;
}

export function resolveDimensions(format: FormFactorT): Dimensions {
  if (format === 'phone') return { width: 1080, height: 1920, scale: 1 };
  throw new Error(`Form factor '${format}' is not supported yet (Milestone 5). Use 'phone'.`);
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
