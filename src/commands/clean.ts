import { promises as fs, existsSync } from 'node:fs';
import { projectPaths } from '../paths.js';
import { CHROMIUM_DIR } from '../paths.js';
import { dirSize } from '../fsutil.js';

export interface CleanOptions {
  cache?: boolean;
}

export interface CleanResult {
  removed: { path: string; bytes: number }[];
}

/** Remove cached artifacts. By default: Chromium + project .cache; with {cache:true}: only project .cache. */
export async function runClean(
  root: string,
  opts: CleanOptions,
  chromiumDir: string = CHROMIUM_DIR,
): Promise<CleanResult> {
  const paths = projectPaths(root);
  const targets = opts.cache ? [paths.cache] : [chromiumDir, paths.cache];

  const removed: { path: string; bytes: number }[] = [];
  for (const target of targets) {
    if (!existsSync(target)) continue;
    const bytes = await dirSize(target);
    await fs.rm(target, { recursive: true, force: true });
    removed.push({ path: target, bytes });
  }
  return { removed };
}
