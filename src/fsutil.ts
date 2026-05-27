import path from 'node:path';
import { promises as fs } from 'node:fs';

/** Total size in bytes of all files under `target` (0 if it does not exist). */
export async function dirSize(target: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(target, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else if (entry.isFile()) {
      try {
        total += (await fs.stat(full)).size;
      } catch {
        // file vanished mid-scan or is a broken symlink — skip it
      }
    }
  }
  return total;
}
