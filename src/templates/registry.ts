import { promises as fs, existsSync } from 'node:fs';
import type { ProjectPaths } from '../paths.js';

/** Built-in template ids shipped with the package. Expanded by the resolver in Milestone 3. */
export const BUILTIN_TEMPLATES = ['bold-headline'] as const;

export interface TemplateInfo {
  id: string;
  source: 'built-in' | 'project';
}

/** Enumerate built-in templates plus any project-local template directories.
 *  Project-local templates shadow built-ins with the same id (listed once, as 'project'). */
export async function listTemplates(paths: ProjectPaths): Promise<TemplateInfo[]> {
  const projectEntries: TemplateInfo[] = [];
  if (existsSync(paths.templates)) {
    const entries = await fs.readdir(paths.templates, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) projectEntries.push({ id: entry.name, source: 'project' });
    }
  }
  const projectIds = new Set(projectEntries.map((e) => e.id));
  const builtins: TemplateInfo[] = BUILTIN_TEMPLATES.filter((id) => !projectIds.has(id)).map((id) => ({
    id,
    source: 'built-in' as const,
  }));
  return [...builtins, ...projectEntries];
}
