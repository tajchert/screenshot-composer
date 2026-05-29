import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createJiti } from 'jiti';
import { ConfigSchema, type Config } from './schema.js';
import { ConfigValidationError } from '../errors.js';
import { formatZodError } from './format-error.js';

// User configs `import { defineConfig } from 'screenshot-composer'`. We alias that bare
// specifier to *this* package's entry so the config uses the same module instance (one
// Zod, one defineConfig identity) regardless of how it was installed. In dev the sibling
// entry is `../index.ts`; in the published build it's the compiled `../index.js`. Pick
// whichever exists so both layouts resolve.
const here = path.dirname(fileURLToPath(import.meta.url));
const tsEntry = path.join(here, '..', 'index.ts');
const SELF_ALIAS = existsSync(tsEntry) ? tsEntry : path.join(here, '..', 'index.js');

export async function loadConfig(configPath: string): Promise<Config> {
  if (!existsSync(configPath)) {
    throw new ConfigValidationError(
      configPath,
      `No config found at ${configPath}\n  Run \`screenshot-composer init\` to create one.`,
    );
  }

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: { 'screenshot-composer': SELF_ALIAS },
  });

  let loaded: unknown;
  try {
    loaded = await jiti.import(configPath, { default: true });
  } catch (err) {
    throw new ConfigValidationError(configPath, `Could not load ${configPath}\n  ${(err as Error).message}`);
  }

  const result = ConfigSchema.safeParse(loaded);
  if (!result.success) {
    throw new ConfigValidationError(configPath, formatZodError(configPath, result.error));
  }
  return result.data;
}
