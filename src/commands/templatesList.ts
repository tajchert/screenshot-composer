import { projectPaths } from '../paths.js';
import { listTemplates } from '../templates/registry.js';

/** Print available templates to stdout. */
export async function runTemplatesList(root: string): Promise<void> {
  const templates = await listTemplates(projectPaths(root));
  for (const t of templates) {
    console.log(`${t.id}  (${t.source})`);
  }
}
