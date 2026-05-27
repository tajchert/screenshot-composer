import { promises as fs } from 'node:fs';
import { execa } from 'execa';
import { CHROMIUM_DIR } from '../paths.js';

/** True if a Chromium build is present under `dir`. Never throws. */
export async function isChromiumPresent(dir: string = CHROMIUM_DIR): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.some((e) => e.startsWith('chromium'));
  } catch {
    return false;
  }
}

/** Ensures Chromium is installed under ~/.screenshot-composer/chromium. */
export async function ensureChromium(log: Pick<Console, 'error'> = console): Promise<void> {
  await fs.mkdir(CHROMIUM_DIR, { recursive: true });
  process.env.PLAYWRIGHT_BROWSERS_PATH = CHROMIUM_DIR;

  if (await isChromiumPresent(CHROMIUM_DIR)) return;

  log.error('Downloading Chromium (one-time, ~170 MB)…');
  await execa('playwright', ['install', 'chromium'], {
    preferLocal: true,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: CHROMIUM_DIR },
    stdio: 'inherit',
  });
}
