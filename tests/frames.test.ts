import { describe, it, expect } from 'vitest';
import { loadFrame, listFrames } from '../src/frames/load.js';

describe('frames', () => {
  it('lists the built-in pixel-9 frame', async () => {
    const ids = await listFrames();
    expect(ids).toContain('pixel-9');
  });

  it('loads the pixel-9 manifest and webp data-URI', async () => {
    const { manifest, imageDataUri, maskDataUri } = await loadFrame('pixel-9');
    expect(manifest.id).toBe('pixel-9');
    expect(manifest.screen.width).toBe(1080);
    expect(manifest.intrinsic).toEqual({ width: 1198, height: 2531 });
    expect(imageDataUri).toMatch(/^data:image\/webp;base64,/);
    expect(imageDataUri.length).toBeGreaterThan(10000);
    expect(maskDataUri?.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('throws a clear error for an unknown frame', async () => {
    await expect(loadFrame('nope')).rejects.toThrow(/unknown frame/i);
  });
});
