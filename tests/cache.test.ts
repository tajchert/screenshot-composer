import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import {
  loadCacheIndex,
  saveCacheIndex,
  CACHE_INDEX_VERSION,
  CACHE_FORMAT_VERSION,
  computeCacheKey,
  identityKey,
  outputFilePath,
  type CacheIndex,
  type CacheKeyInput,
} from '../src/render/cache.js';

async function tmpCacheDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sc-cache-'));
}

describe('cache index', () => {
  it('returns an empty index when the file is missing', async () => {
    const dir = await tmpCacheDir();
    expect(await loadCacheIndex(dir)).toEqual({ version: CACHE_INDEX_VERSION, entries: {} });
  });

  it('round-trips through save/load', async () => {
    const dir = await tmpCacheDir();
    const index: CacheIndex = {
      version: CACHE_INDEX_VERSION,
      entries: { 'en-US/phone/01': { key: 'abc', ext: 'png' } },
    };
    await saveCacheIndex(dir, index);
    expect(await loadCacheIndex(dir)).toEqual(index);
  });

  it('treats corrupt JSON as empty', async () => {
    const dir = await tmpCacheDir();
    await fs.writeFile(path.join(dir, 'index.json'), '{ not json');
    expect(await loadCacheIndex(dir)).toEqual({ version: CACHE_INDEX_VERSION, entries: {} });
  });

  it('treats a version mismatch as empty', async () => {
    const dir = await tmpCacheDir();
    await fs.writeFile(
      path.join(dir, 'index.json'),
      JSON.stringify({ version: CACHE_INDEX_VERSION + 1, entries: { x: { key: 'k', ext: 'png' } } }),
    );
    expect(await loadCacheIndex(dir)).toEqual({ version: CACHE_INDEX_VERSION, entries: {} });
  });
});

const baseInput: CacheKeyInput = {
  cacheFormatVersion: CACHE_FORMAT_VERSION,
  tool: '0.1.0',
  chromium: '120',
  locale: 'en-US',
  format: 'phone',
  dimensions: { width: 1080, height: 1920, scale: 1 },
  slotId: '01',
  frameId: 'pixel-9',
  templateId: 'bold-headline',
  layout: {},
  copy: { headline: 'Hi' },
  theme: { palette: { fg: '#000' } },
  screenshotHash: 'aaa',
  templateSourceHash: null,
};

describe('computeCacheKey', () => {
  it('is stable for identical input', () => {
    expect(computeCacheKey(baseInput)).toBe(computeCacheKey({ ...baseInput }));
  });

  it('is independent of key insertion order in nested objects', () => {
    const za = computeCacheKey({ ...baseInput, theme: { z: '#fff', a: '#000' } });
    const az = computeCacheKey({ ...baseInput, theme: { a: '#000', z: '#fff' } });
    expect(za).toBe(az);
    // sanity: a genuinely different value still changes the key
    expect(computeCacheKey({ ...baseInput, theme: { a: '#111', z: '#fff' } })).not.toBe(az);
  });

  it('changes when any rendering input changes', () => {
    const base = computeCacheKey(baseInput);
    const variants: CacheKeyInput[] = [
      { ...baseInput, tool: '0.2.0' },
      { ...baseInput, chromium: '121' },
      { ...baseInput, cacheFormatVersion: CACHE_FORMAT_VERSION + 1 },
      { ...baseInput, locale: 'de-DE' },
      { ...baseInput, format: 'tablet7' },
      { ...baseInput, slotId: '02' },
      { ...baseInput, dimensions: { width: 1440, height: 1920, scale: 1 } },
      { ...baseInput, frameId: 'pixel-7' },
      { ...baseInput, templateId: 'showcase' },
      { ...baseInput, layout: { tilt: 5 } },
      { ...baseInput, copy: { headline: 'Bye' } },
      { ...baseInput, theme: { palette: { fg: '#fff' } } },
      { ...baseInput, screenshotHash: 'bbb' },
      { ...baseInput, templateSourceHash: 'ccc' },
    ];
    for (const v of variants) expect(computeCacheKey(v)).not.toBe(base);
  });
});

describe('path helpers', () => {
  it('builds the identity key', () => {
    expect(identityKey('en-US', 'phone', '01')).toBe('en-US/phone/01');
  });
  it('builds the output file path', () => {
    expect(outputFilePath('/out', 'en-US', 'phone', '01', 'png')).toBe(
      path.join('/out', 'en-US', 'phone', '01.png'),
    );
  });
});
