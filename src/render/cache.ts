import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Config, FormFactorT, Slot } from '../config/schema.js';
import type { Dimensions } from './constraints.js';
import type { ProjectPaths } from '../paths.js';
import { resolveDimensions } from './constraints.js';
import { resolveCopy } from './compose.js';
import { versionInfo } from '../version.js';
import { MissingInputError } from '../errors.js';

/** Bump to invalidate every cache key (key-algorithm change). */
export const CACHE_FORMAT_VERSION = 1;
/** Schema version of index.json; a mismatch discards the whole index. */
export const CACHE_INDEX_VERSION = 1;

export interface CacheEntry {
  key: string;
  ext: 'png' | 'jpg';
}

export interface CacheIndex {
  version: number;
  entries: Record<string, CacheEntry>;
}

function emptyIndex(): CacheIndex {
  return { version: CACHE_INDEX_VERSION, entries: {} };
}

export async function loadCacheIndex(cacheDir: string): Promise<CacheIndex> {
  try {
    const raw = await fs.readFile(path.join(cacheDir, 'index.json'), 'utf8');
    const parsed = JSON.parse(raw) as CacheIndex;
    if (
      !parsed ||
      parsed.version !== CACHE_INDEX_VERSION ||
      typeof parsed.entries !== 'object' ||
      parsed.entries === null
    ) {
      return emptyIndex();
    }
    return parsed;
  } catch {
    return emptyIndex();
  }
}

export async function saveCacheIndex(cacheDir: string, index: CacheIndex): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  const indexPath = path.join(cacheDir, 'index.json');
  const tmp = path.join(cacheDir, `index.json.tmp-${process.pid}`);
  await fs.writeFile(tmp, JSON.stringify(index, null, 2));
  await fs.rename(tmp, indexPath);
}

export interface CacheKeyInput {
  cacheFormatVersion: number;
  tool: string;
  chromium: string;
  locale: string;
  format: FormFactorT;
  dimensions: Dimensions;
  slotId: string;
  frameId: string;
  templateId: string;
  layout: unknown;
  copy: Record<string, string>;
  theme: unknown;
  screenshotHash: string;
  templateSourceHash: string | null;
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortValue(obj[k])]));
  }
  return v;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function computeCacheKey(input: CacheKeyInput): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

export function identityKey(locale: string, format: string, slotId: string): string {
  return `${locale}/${format}/${slotId}`;
}

export function outputFilePath(
  outputsDir: string,
  locale: string,
  format: string,
  slotId: string,
  ext: string,
): string {
  return path.join(outputsDir, locale, format, `${slotId}.${ext}`);
}

async function hashFile(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

export async function cacheKeyForSlot(
  config: Config,
  paths: ProjectPaths,
  slot: Slot,
  locale: string,
  format: FormFactorT,
  version: { tool: string; chromium: string } = versionInfo(),
): Promise<string> {
  const dimensions = resolveDimensions(format);

  const screenshotPath = path.join(paths.inputs, locale, format, slot.screenshot);
  if (!existsSync(screenshotPath)) throw new MissingInputError(screenshotPath);
  const screenshotHash = await hashFile(screenshotPath);

  const localTemplate = path.join(paths.templates, slot.template, 'index.ts');
  const templateSourceHash = existsSync(localTemplate) ? await hashFile(localTemplate) : null;

  return computeCacheKey({
    cacheFormatVersion: CACHE_FORMAT_VERSION,
    tool: version.tool,
    chromium: version.chromium,
    locale,
    format,
    dimensions,
    slotId: slot.id,
    frameId: slot.frame.id,
    templateId: slot.template,
    layout: slot.layout,
    copy: resolveCopy(slot, locale, config.defaultLocale),
    theme: config.theme,
    screenshotHash,
    templateSourceHash,
  });
}
