import { promises as fs } from 'node:fs';
import path from 'node:path';

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
