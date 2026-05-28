import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import type { ProjectPaths } from '../paths.js';
import type { TemplateModule } from './types.js';
import { BUILTIN_MODULES } from './registry.js';
import { ConfigValidationError } from '../errors.js';

// Mirror the config loader: alias the package specifier to the source entry so a
// project template that imports type-only symbols from 'screenshot-composer' resolves.
const SELF_ALIAS = fileURLToPath(new URL('../index.ts', import.meta.url));

export async function resolveTemplate(id: string, paths: ProjectPaths): Promise<TemplateModule> {
  const localEntry = path.join(paths.templates, id, 'index.ts');
  if (existsSync(localEntry)) {
    const jiti = createJiti(import.meta.url, {
      interopDefault: true,
      alias: { 'screenshot-composer': SELF_ALIAS },
    });
    let mod: unknown;
    try {
      mod = await jiti.import(localEntry, { default: true });
    } catch (err) {
      throw new ConfigValidationError(localEntry, `Could not load project template '${id}'\n  ${(err as Error).message}`);
    }
    const candidate = mod as Partial<TemplateModule>;
    if (!candidate || typeof candidate.render !== 'function' || !candidate.meta) {
      throw new ConfigValidationError(localEntry, `Project template '${id}' must default-export { meta, render }.`);
    }
    return candidate as TemplateModule;
  }

  const builtin = BUILTIN_MODULES[id];
  if (builtin) return builtin;

  const available = Object.keys(BUILTIN_MODULES).sort().join(', ');
  throw new ConfigValidationError(
    paths.config,
    `Unknown template '${id}'. Available built-ins: ${available}. Project templates live in ${paths.templates}/<id>/index.ts.`,
  );
}
