import type { RenderServer } from './server.js';
import type { FormFactorT } from '../config/schema.js';
import type { BrowserContext } from 'playwright';
import { getBrowser } from './browser.js';
import { enforceConstraints } from './constraints.js';
import { resolveRenderTarget } from './target.js';
import { RenderError } from '../errors.js';

export async function renderSlot(
  server: RenderServer,
  slotId: string,
  locale: string,
  format: FormFactorT,
): Promise<Buffer> {
  const slot = server.config.slots.find((s) => s.id === slotId);
  if (!slot) throw new RenderError(`No slot with id '${slotId}' in config`);
  const { width, height, scale } = resolveRenderTarget(slot, format);
  const browser = await getBrowser();
  let context: BrowserContext | undefined;

  try {
    context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      colorScheme: 'light',
      locale,
    });

    const page = await context.newPage();
    const res = await page.goto(
      `${server.url}/render?slot=${encodeURIComponent(slotId)}&locale=${encodeURIComponent(locale)}&format=${format}`,
      { waitUntil: 'networkidle' },
    );
    if (!res || !res.ok()) {
      throw new RenderError(`Render route failed for slot '${slotId}' (${res?.status() ?? 'no response'})`);
    }

    // Wait for fonts and images via a string expression to avoid esbuild __name injection.
    await page.waitForFunction('document.fonts.ready.then(() => true)');
    await page.waitForFunction('window.__READY__ === true && Array.from(document.images).every((i) => i.complete)', undefined, { timeout: 10_000 });

    const png = await page.screenshot({ type: 'png', fullPage: false });
    return await enforceConstraints(png, slotId);
  } finally {
    if (context) await context.close();
  }
}
