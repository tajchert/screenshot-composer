import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { FormFactorT } from '../config/schema.js';
import type { Dimensions } from './constraints.js';

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
