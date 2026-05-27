import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { listTemplates, BUILTIN_TEMPLATES } from '../src/templates/registry.js';
import { projectPaths } from '../src/paths.js';

describe('listTemplates', () => {
  it('lists the built-in templates including bold-headline', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-tpl-'));
    const list = await listTemplates(projectPaths(root));
    expect(BUILTIN_TEMPLATES).toContain('bold-headline');
    expect(list.some((t) => t.id === 'bold-headline' && t.source === 'built-in')).toBe(true);
  });

  it('includes project-local template directories', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-tpl2-'));
    const p = projectPaths(root);
    await fs.mkdir(path.join(p.templates, 'my-custom'), { recursive: true });
    const list = await listTemplates(p);
    expect(list.some((t) => t.id === 'my-custom' && t.source === 'project')).toBe(true);
  });
});
