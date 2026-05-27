import os from 'node:os';
import path from 'node:path';

// Set PLAYWRIGHT_BROWSERS_PATH before any test module imports playwright,
// because playwright resolves the registry directory at module-load time.
const CHROMIUM_DIR = path.join(os.homedir(), '.screenshot-composer', 'chromium');
process.env.PLAYWRIGHT_BROWSERS_PATH = CHROMIUM_DIR;
