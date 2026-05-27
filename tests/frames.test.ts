import { describe, it, expect } from 'vitest';
import { loadFrame, listFrames } from '../src/frames/load.js';

describe('frames', () => {
  it('lists the built-in pixel-9 frame', async () => {
    const ids = await listFrames();
    expect(ids).toContain('pixel-9');
  });

  it('loads the pixel-9 manifest and svg, defaulting the color', async () => {
    const { manifest, svg } = await loadFrame('pixel-9');
    expect(manifest.id).toBe('pixel-9');
    expect(manifest.screen.width).toBe(744);
    expect(manifest.intrinsic).toEqual({ width: 800, height: 1700 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 800 1700"');
  });

  it('throws a clear error for an unknown frame', async () => {
    await expect(loadFrame('nope')).rejects.toThrow(/unknown frame/i);
  });
});
