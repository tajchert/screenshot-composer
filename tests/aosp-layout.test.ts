import { describe, it, expect } from 'vitest';
import { parseAospLayout } from '../src/frames/_build/aosp-layout.js';

// Trimmed copy of ~/Library/Android/sdk/skins/pixel_9/layout
const PIXEL_9 = `parts {
  device {
    display {
      width 1080
      height 2424
      x 0
      y 0
      corner_radius 87
    }
  }
}
layouts {
  portrait {
    width 1198
    height 2531
    part2 {
      name device
      x 55
      y 58
    }
  }
}`;

describe('parseAospLayout', () => {
  it('extracts display, corner radius, frame size and device offset', () => {
    const g = parseAospLayout(PIXEL_9);
    expect(g.display).toEqual({ width: 1080, height: 2424 });
    expect(g.cornerRadius).toBe(87);
    expect(g.frame).toEqual({ width: 1198, height: 2531 });
    expect(g.offset).toEqual({ x: 55, y: 58 });
  });

  it('returns null cornerRadius when the layout omits it (Pixel 6/7/8)', () => {
    const noRadius = PIXEL_9.replace(/\s*corner_radius 87\n/, '\n');
    const g = parseAospLayout(noRadius);
    expect(g.cornerRadius).toBeNull();
  });
});
