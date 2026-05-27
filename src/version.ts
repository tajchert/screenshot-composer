import { createRequire } from 'node:module';

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
    const browsers = require('playwright-core/browsers.json') as {
      browsers: { name: string; revision: string }[];
    };
    const c = browsers.browsers.find((b) => b.name === 'chromium');
    if (c) chromium = `rev ${c.revision}`;
  } catch {
    // browsers.json not exported by this playwright-core version; leave 'unknown'
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
