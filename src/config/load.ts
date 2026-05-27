import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { ConfigSchema, type Config } from './schema.js';
import { ConfigValidationError } from '../errors.js';

// In source/dev this resolves to src/index.ts; the published build resolves the
// specifier through node_modules and this alias is an unused fallback.
const SELF_ALIAS = fileURLToPath(new URL('../index.ts', import.meta.url));

export async function loadConfig(configPath: string): Promise<Config> {
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: { 'screenshot-composer': SELF_ALIAS },
  });

  let loaded: unknown;
  try {
    loaded = await jiti.import(configPath, { default: true });
  } catch (err) {
    throw new ConfigValidationError(configPath, (err as Error).message);
  }

  const result = ConfigSchema.safeParse(loaded);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
      .join('\n');
    throw new ConfigValidationError(configPath, detail);
  }
  return result.data;
}
