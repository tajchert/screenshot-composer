import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import {
  loadCacheIndex,
  saveCacheIndex,
  CACHE_INDEX_VERSION,
  type CacheIndex,
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
