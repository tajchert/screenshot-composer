import { describe, it, expect } from 'vitest';
import { listFrameInfos } from '../src/frames/load.js';

describe('listFrameInfos', () => {
  it('lists pixel-9 with its display name and colors', async () => {
    const infos = await listFrameInfos();
    const pixel = infos.find((f) => f.id === 'pixel-9');
    expect(pixel).toBeDefined();
    expect(pixel!.displayName).toBe('Pixel 9');
    expect(pixel!.colors).toEqual(['obsidian']);
  });
});
