import type { FormFactorT, Orientation, Slot } from '../config/schema.js';
import { resolveDimensions, type Dimensions } from './constraints.js';

/** Default orientation per form factor: phones portrait, tablets landscape. */
export const DEFAULT_ORIENTATION: Record<FormFactorT, Orientation> = {
  phone: 'portrait',
  tablet7: 'landscape',
  tablet10: 'landscape',
};

/** A slot's per-form-factor override wins; otherwise the form-factor default. */
export function resolveOrientation(slot: Slot, format: FormFactorT): Orientation {
  return slot.orientation?.[format] ?? DEFAULT_ORIENTATION[format];
}

export interface RenderTarget extends Dimensions {
  orientation: Orientation;
}

/** Logical viewport + deviceScaleFactor + resolved orientation for a slot+format. */
export function resolveRenderTarget(slot: Slot, format: FormFactorT): RenderTarget {
  const orientation = resolveOrientation(slot, format);
  const { width, height, scale } = resolveDimensions(format, orientation);
  return { width, height, scale, orientation };
}
