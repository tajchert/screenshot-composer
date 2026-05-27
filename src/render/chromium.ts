import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { execa } from 'execa';
import { CHROMIUM_DIR } from '../paths.js';

/** Ensures Chromium is installed under ~/.screenshot-composer/chromium. */
export async function ensureChromium(log: Pick<Console, 'error'> = console): Promise<void> {
  await fs.mkdir(CHROMIUM_DIR, { recursive: true });
  process.env.PLAYWRIGHT_BROWSERS_PATH = CHROMIUM_DIR;

  const entries = existsSync(CHROMIUM_DIR) ? await fs.readdir(CHROMIUM_DIR) : [];
  if (entries.some((e) => e.startsWith('chromium'))) return;

  log.error('Downloading Chromium (one-time, ~170 MB)…');
  await execa('playwright', ['install', 'chromium'], {
    preferLocal: true,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: CHROMIUM_DIR },
    stdio: 'inherit',
  });
}
