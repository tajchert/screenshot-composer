import { promises as fs, existsSync } from 'node:fs';
import type { ProjectPaths } from '../paths.js';
import type { TemplateModule } from './types.js';
import boldHeadline from './bold-headline/index.js';

/** Static map of built-in template id → module. Single source of truth for built-ins.
 *  Static (not dynamic globbing) so it still resolves after bundling to dist/ in M7. */
export const BUILTIN_MODULES: Record<string, TemplateModule> = {
  'bold-headline': boldHeadline,
};

/** Built-in template ids shipped with the package, derived from BUILTIN_MODULES. */
export const BUILTIN_TEMPLATES = Object.keys(BUILTIN_MODULES);

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
