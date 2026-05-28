import { describe, it, expect } from 'vitest';
import { listFrameInfos } from '../src/frames/load.js';

const EXPECTED = [
  { id: 'pixel-9', displayName: 'Pixel 9', colors: ['obsidian', 'porcelain'] },
  { id: 'pixel-9-pro', displayName: 'Pixel 9 Pro', colors: ['obsidian', 'hazel'] },
  { id: 'pixel-9-pro-xl', displayName: 'Pixel 9 Pro XL', colors: ['obsidian', 'porcelain'] },
  { id: 'pixel-9a', displayName: 'Pixel 9a', colors: ['obsidian', 'iris'] },
  { id: 'pixel-tablet', displayName: 'Pixel Tablet', colors: ['porcelain', 'hazel'] },
  { id: 'generic-android', displayName: 'Generic Android', colors: ['graphite'] },
  { id: 'generic-tablet-7', displayName: 'Generic 7" Tablet', colors: ['graphite'] },
  { id: 'generic-tablet-10', displayName: 'Generic 10" Tablet', colors: ['graphite'] },
];

describe('listFrameInfos', () => {
  it('lists every built-in frame with its display name and at least the expected colors', async () => {
    const infos = await listFrameInfos();
    const byId = new Map(infos.map((i) => [i.id, i]));
    for (const want of EXPECTED) {
      const got = byId.get(want.id);
      expect(got, `frame '${want.id}' should be listed`).toBeDefined();
      expect(got!.displayName).toBe(want.displayName);
      for (const color of want.colors) {
        expect(got!.colors, `frame '${want.id}' should expose color '${color}'`).toContain(color);
      }
    }
  });

  it('returns ids in a stable sorted order', async () => {
    const infos = await listFrameInfos();
    const ids = infos.map((i) => i.id);
    expect(ids).toEqual([...ids].sort());
  });
});
