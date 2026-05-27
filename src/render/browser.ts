import { chromium, type Browser } from 'playwright';
import { CHROMIUM_DIR } from '../paths.js';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  process.env.PLAYWRIGHT_BROWSERS_PATH = CHROMIUM_DIR;
  if (!browser) {
    browser = await chromium.launch({
      args: ['--disable-dev-shm-usage', '--font-render-hinting=none', '--force-color-profile=srgb'],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
