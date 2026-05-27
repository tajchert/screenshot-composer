import { promises as fs, existsSync } from 'node:fs';
import type { ProjectPaths } from '../paths.js';

/** Built-in template ids shipped with the package. Expanded by the resolver in Milestone 3. */
export const BUILTIN_TEMPLATES = ['bold-headline'] as const;

export interface TemplateInfo {
  id: string;
  source: 'built-in' | 'project';
}

/** Enumerate built-in templates plus any project-local template directories. */
export async function listTemplates(paths: ProjectPaths): Promise<TemplateInfo[]> {
  const out: TemplateInfo[] = BUILTIN_TEMPLATES.map((id) => ({ id, source: 'built-in' as const }));
  if (existsSync(paths.templates)) {
    const entries = await fs.readdir(paths.templates, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) out.push({ id: entry.name, source: 'project' });
    }
  }
  return out;
}
