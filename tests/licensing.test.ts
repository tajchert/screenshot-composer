import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');

describe('licensing', () => {
  it('ships an MIT LICENSE file', () => {
    expect(existsSync(path.join(ROOT, 'LICENSE'))).toBe(true);
    expect(read('LICENSE')).toMatch(/MIT License/);
  });

  it('ships the Apache-2.0 license text', () => {
    expect(existsSync(path.join(ROOT, 'LICENSE-APACHE'))).toBe(true);
    expect(read('LICENSE-APACHE')).toMatch(/Apache License\s*\n\s*Version 2\.0/);
  });

  it('ships a NOTICE attributing AOSP', () => {
    expect(existsSync(path.join(ROOT, 'NOTICE'))).toBe(true);
    expect(read('NOTICE')).toMatch(/Android Open Source Project/);
  });

  it('README documents the mixed license', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/Apache License, Version 2\.0/);
    expect(readme).toMatch(/LICENSE-APACHE/);
  });
});
