import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createJiti } from 'jiti';
import { ConfigSchema, type Config } from './schema.js';
import { ConfigValidationError } from '../errors.js';
import { formatZodError } from './format-error.js';

// In source/dev this resolves to src/index.ts; the published build resolves the
// specifier through node_modules and this alias is an unused fallback.
const SELF_ALIAS = fileURLToPath(new URL('../index.ts', import.meta.url));

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
