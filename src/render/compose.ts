import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Config, FormFactorT } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { loadFrame } from '../frames/load.js';
import { resolveTemplate } from '../templates/resolve.js';
import { resolveRenderTarget } from './target.js';
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

  const filePath = inputFilePath(paths, ref.locale, ref.format, slot.screenshot);
  if (!existsSync(filePath)) throw new MissingInputError(filePath);

  const { width, height } = resolveRenderTarget(slot, ref.format);
  const { manifest, imageDataUri, maskDataUri } = await loadFrame(slot.frame.id);
  const template = await resolveTemplate(slot.template, paths);

  // Resolve every declared copy key for this locale, falling back to defaultLocale.
  const copy: Record<string, string> = {};
  for (const key of Object.keys(slot.copy)) {
    copy[key] = slot.copy[key]?.[ref.locale] ?? slot.copy[key]?.[config.defaultLocale] ?? '';
  }

  return template.render({
    width,
    height,
    copy,
    screenshotUrl: inputUrl(ref.locale, ref.format, slot.screenshot),
    frame: { intrinsic: manifest.intrinsic, screen: manifest.screen, image: imageDataUri, mask: maskDataUri },
    layout: slot.layout,
    theme: config.theme,
  });
}
