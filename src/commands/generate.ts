import path from 'node:path';
import { promises as fs } from 'node:fs';
import { projectPaths } from '../paths.js';
import { loadConfig } from '../config/load.js';
import { ensureChromium } from '../render/chromium.js';
import { startRenderServer } from '../render/server.js';
import { renderSlot } from '../render/renderSlot.js';
import { closeBrowser } from '../render/browser.js';
import { extFor } from '../render/constraints.js';
import type { FormFactorT } from '../config/schema.js';
import { validateSlotTemplates } from '../templates/validate.js';

export interface GenerateOptions {
  locale?: string;
  format?: FormFactorT;
  slot?: string;
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

  try {
    for (const slot of slots) {
      for (const locale of locales) {
        for (const format of formats) {
          const buf = await renderSlot(server, slot.id, locale, format);
          const outDir = path.join(paths.outputs, locale, format);
          await fs.mkdir(outDir, { recursive: true });
          const outFile = path.join(outDir, `${slot.id}.${extFor(buf)}`);
          await fs.writeFile(outFile, buf);
          console.error(`✓ ${locale}/${format}/${slot.id}`);
        }
      }
    }
  } finally {
    await server.close();
    await closeBrowser();
  }
}
