import { describe, it, expect } from 'vitest';
import { listFrameInfos } from '../src/frames/load.js';

describe('listFrameInfos', () => {
  it('lists frames with display names (subset present)', async () => {
    const byId = new Map((await listFrameInfos()).map((i) => [i.id, i.displayName]));
    expect(byId.get('pixel-9')).toBe('Pixel 9');
    expect(byId.get('pixel-9-pro-xl')).toBe('Pixel 9 Pro XL');
    expect(byId.get('pixel-tablet')).toBe('Pixel Tablet');
  });

  it('returns ids in stable sorted order', async () => {
    const ids = (await listFrameInfos()).map((i) => i.id);
    expect(ids).toEqual([...ids].sort());
  });
});
