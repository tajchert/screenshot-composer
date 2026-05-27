import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Config, FormFactorT } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { loadFrame } from '../frames/load.js';
import { renderHtml } from '../templates/bold-headline/render.js';
import { resolveDimensions } from './constraints.js';
import { MissingInputError, RenderError } from '../errors.js';

export interface SlotRef {
  slotId: string;
  locale: string;
  format: FormFactorT;
}

export function inputUrl(locale: string, format: string, file: string): string {
  return `/input/${locale}/${format}/${file}`;
}

export function inputFilePath(paths: ProjectPaths, locale: string, format: string, file: string): string {
  return path.join(paths.inputs, locale, format, file);
}

export async function composeSlotHtml(config: Config, paths: ProjectPaths, ref: SlotRef): Promise<string> {
  const slot = config.slots.find((s) => s.id === ref.slotId);
  if (!slot) throw new RenderError(`No slot with id '${ref.slotId}' in config`);

  // Skeleton ships only 'bold-headline'.
  if (slot.template !== 'bold-headline') {
    throw new RenderError(`Template '${slot.template}' is not available yet (Milestone 3). Use 'bold-headline'.`);
  }

  const filePath = inputFilePath(paths, ref.locale, ref.format, slot.screenshot);
  if (!existsSync(filePath)) throw new MissingInputError(filePath);

  const { width, height } = resolveDimensions(ref.format);
  const { manifest, svg } = await loadFrame(slot.frame.id, slot.frame.color);

  const headline = slot.copy.headline?.[ref.locale] ?? slot.copy.headline?.[config.defaultLocale] ?? '';

  return renderHtml({
    width,
    height,
    headline,
    screenshotUrl: inputUrl(ref.locale, ref.format, slot.screenshot),
    frame: { intrinsic: manifest.intrinsic, screen: manifest.screen, svg },
    layout: slot.layout,
    theme: config.theme,
  });
}
