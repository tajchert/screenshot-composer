import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { resolveTemplate } from '../src/templates/resolve.js';
import { projectPaths } from '../src/paths.js';
import { ConfigValidationError } from '../src/errors.js';

describe('resolveTemplate', () => {
  it('resolves a built-in template by id', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-res-'));
    const tpl = await resolveTemplate('bold-headline', projectPaths(root));
    expect(tpl.meta.id).toBe('bold-headline');
    expect(typeof tpl.render).toBe('function');
  });

  it('throws ConfigValidationError on an unknown id, listing available ids', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-res2-'));
    await expect(resolveTemplate('nope', projectPaths(root))).rejects.toMatchObject({
      name: 'ConfigValidationError',
    });
    await expect(resolveTemplate('nope', projectPaths(root))).rejects.toThrow(/bold-headline/);
  });

  it('loads a project-local template that shadows a built-in id', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-res3-'));
    const p = projectPaths(root);
    const dir = path.join(p.templates, 'bold-headline');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'index.ts'),
      `export const meta = { id: 'bold-headline', displayName: 'Local', description: 'x', copyFields: [] };
export function render() { return '<!DOCTYPE html><html><body>LOCAL-OVERRIDE</body></html>'; }
export default { meta, render };
`,
    );
    const tpl = await resolveTemplate('bold-headline', p);
    expect(tpl.meta.displayName).toBe('Local');
    expect(tpl.render({} as never)).toContain('LOCAL-OVERRIDE');
  });

  it('throws ConfigValidationError when a project template lacks meta/render', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-res4-'));
    const p = projectPaths(root);
    const dir = path.join(p.templates, 'broken');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.ts'), `export default { nope: true };\n`);
    await expect(resolveTemplate('broken', p)).rejects.toBeInstanceOf(ConfigValidationError);
  });
});
