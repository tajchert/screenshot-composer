import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import { projectPaths } from '../paths.js';
import { loadConfig } from '../config/load.js';
import { ensureChromium } from '../render/chromium.js';
import { startRenderServer } from '../render/server.js';
import { renderSlot } from '../render/renderSlot.js';
import { closeBrowser } from '../render/browser.js';
import { extFor } from '../render/constraints.js';
import type { FormFactorT } from '../config/schema.js';
import { validateSlotTemplates } from '../templates/validate.js';
import { versionInfo } from '../version.js';
import {
  loadCacheIndex,
  saveCacheIndex,
  cacheKeyForSlot,
  identityKey,
  outputFilePath,
} from '../render/cache.js';

export interface GenerateOptions {
  locale?: string;
  format?: FormFactorT;
  slot?: string;
  force?: boolean;
}

export async function runGenerate(root: string, opts: GenerateOptions): Promise<void> {
  const paths = projectPaths(root);
  const config = await loadConfig(paths.config);
  await validateSlotTemplates(config, paths);

  const locales = opts.locale ? [opts.locale] : config.locales;
  const formats = opts.format ? [opts.format] : config.formFactors;
  const slots = opts.slot ? config.slots.filter((s) => s.id === opts.slot) : config.slots;

  await ensureChromium();
  const server = await startRenderServer({ config, paths });

  const index = await loadCacheIndex(paths.cache);
  const version = versionInfo();
  let rendered = 0;
  let cached = 0;

  try {
    for (const slot of slots) {
      for (const locale of locales) {
        for (const format of formats) {
          const id = identityKey(locale, format, slot.id);
          const key = await cacheKeyForSlot(config, paths, slot, locale, format, version);
          const entry = index.entries[id];

          if (
            !opts.force &&
            entry &&
            entry.key === key &&
            existsSync(outputFilePath(paths.outputs, locale, format, slot.id, entry.ext))
          ) {
            cached++;
            console.error(`↳ cached ${id}`);
            continue;
          }

          const buf = await renderSlot(server, slot.id, locale, format);
          const ext = extFor(buf);
          const outDir = path.join(paths.outputs, locale, format);
          await fs.mkdir(outDir, { recursive: true });
          await fs.writeFile(path.join(outDir, `${slot.id}.${ext}`), buf);

          // Drop a stale sibling if the output format flipped between png and jpg.
          const otherExt = ext === 'png' ? 'jpg' : 'png';
          await fs.rm(path.join(outDir, `${slot.id}.${otherExt}`), { force: true });

          index.entries[id] = { key, ext };
          // Persist after each render so a mid-run failure still banks completed work.
          // If this throws after the write, the next run simply re-renders (self-healing).
          await saveCacheIndex(paths.cache, index);
          rendered++;
          console.error(`✓ ${id}`);
        }
      }
    }
  } finally {
    await server.close();
    await closeBrowser();
  }

  console.error(`Rendered ${rendered}, cached ${cached}`);
}
