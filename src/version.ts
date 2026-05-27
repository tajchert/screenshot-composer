import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

export interface VersionInfo {
  tool: string;
  node: string;
  playwright: string;
  chromium: string;
}

export function versionInfo(): VersionInfo {
  const pkg = require('../package.json') as { version: string };

  let playwright = 'unknown';
  try {
    playwright = (require('playwright/package.json') as { version: string }).version;
  } catch {
    // playwright package.json not resolvable; leave 'unknown'
  }

  let chromium = 'unknown';
  try {
    const pkgDir = path.dirname(require.resolve('playwright-core'));
    const data = JSON.parse(readFileSync(path.join(pkgDir, 'browsers.json'), 'utf8')) as {
      browsers: { name: string; revision: string; browserVersion?: string }[];
    };
    const c = data.browsers.find((b) => b.name === 'chromium');
    if (c) chromium = c.browserVersion ? `${c.browserVersion} (rev ${c.revision})` : `rev ${c.revision}`;
  } catch {
    // browsers.json not resolvable; leave 'unknown'
  }

  return { tool: pkg.version, node: process.versions.node, playwright, chromium };
}

export function formatVersion(v: VersionInfo = versionInfo()): string {
  return [
    `screenshot-composer ${v.tool}`,
    `  node        ${v.node}`,
    `  playwright  ${v.playwright}`,
    `  chromium    ${v.chromium}`,
  ].join('\n');
}
