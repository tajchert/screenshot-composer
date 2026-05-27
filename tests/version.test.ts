import { describe, it, expect } from 'vitest';
import { versionInfo, formatVersion } from '../src/version.js';

describe('version', () => {
  it('reports tool + node + playwright + chromium fields', () => {
    const v = versionInfo();
    expect(v.tool).toMatch(/\d+\.\d+\.\d+/);
    expect(v.node).toBe(process.versions.node);
    expect(typeof v.playwright).toBe('string');
    expect(typeof v.chromium).toBe('string');
  });

  it('formats a multi-line version string containing the tool semver', () => {
    const out = formatVersion({ tool: '1.2.3', node: '26.0.0', playwright: '1.49.1', chromium: 'rev 1148' });
    expect(out).toContain('screenshot-composer 1.2.3');
    expect(out).toContain('node');
    expect(out).toContain('playwright');
    expect(out).toContain('chromium');
  });
});
