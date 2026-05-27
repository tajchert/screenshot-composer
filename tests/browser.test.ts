import { describe, it, expect, afterAll } from 'vitest';
import { ensureChromium } from '../src/render/chromium.js';
import { getBrowser, closeBrowser } from '../src/render/browser.js';

afterAll(async () => { await closeBrowser(); });

describe('chromium provisioning', () => {
  it('ensures Chromium and launches a browser that can open a page', async () => {
    await ensureChromium();
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent('<h1 id="t">hi</h1>');
    expect(await page.textContent('#t')).toBe('hi');
    await page.close();
  });
});
