import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { dirSize } from '../src/fsutil.js';

describe('dirSize', () => {
  it('returns 0 for a missing path', async () => {
    expect(await dirSize('/no/such/path/here')).toBe(0);
  });

  it('sums file sizes recursively', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-size-'));
    await fs.writeFile(path.join(root, 'a.txt'), '12345'); // 5 bytes
    await fs.mkdir(path.join(root, 'sub'));
    await fs.writeFile(path.join(root, 'sub', 'b.txt'), '1234567890'); // 10 bytes
    expect(await dirSize(root)).toBe(15);
  });
});
