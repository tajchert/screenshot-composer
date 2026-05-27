import type { RenderServer } from './server.js';
import type { FormFactorT } from '../config/schema.js';
import { getBrowser } from './browser.js';
import { resolveDimensions, enforceConstraints } from './constraints.js';
import { RenderError } from '../errors.js';

export async function renderSlot(
  server: RenderServer,
  slotId: string,
  locale: string,
  format: FormFactorT,
): Promise<Buffer> {
  const { width, height, scale } = resolveDimensions(format);
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: 'light',
    locale,
  });

  try {
    const page = await context.newPage();
    const res = await page.goto(
      `${server.url}/render?slot=${encodeURIComponent(slotId)}&locale=${encodeURIComponent(locale)}&format=${format}`,
      { waitUntil: 'networkidle' },
    );
    if (!res || !res.ok()) {
      throw new RenderError(`Render route failed for slot '${slotId}' (${res?.status() ?? 'no response'})`);
    }

    await page.evaluate(async () => {
      // @ts-ignore - browser context
      await document.fonts.ready;
      // @ts-ignore
      const imgs = Array.from(document.images).filter((i) => !i.complete);
      await Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
      await new Promise<void>((resolve) => {
        // @ts-ignore
        const check = () => (window.__READY__ ? resolve() : setTimeout(check, 16));
        check();
      });
    });

    const png = await page.screenshot({ type: 'png', fullPage: false });
    return await enforceConstraints(png, slotId);
  } finally {
    await context.close();
  }
}
