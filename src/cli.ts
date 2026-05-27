#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { runInit } from './commands/init.js';
import { runGenerate } from './commands/generate.js';
import { exitCodeFor } from './errors.js';
import type { FormFactorT } from './config/schema.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();
program
  .name('screenshot-composer')
  .description('Compose Google Play Store screenshots from Android app screenshots')
  .version(pkg.version);

program
  .command('init')
  .description('Scaffold a play-screenshots/ workspace with a sample config')
  .action(async () => {
    await guard(() => runInit(process.cwd()));
  });

program
  .command('generate')
  .description('Render all slots × locales × form factors to outputs/')
  .option('--locale <locale>', 'render only this locale')
  .option('--format <format>', 'render only this form factor')
  .option('--slot <slotId>', 'render only this slot')
  .action(async (opts: { locale?: string; format?: string; slot?: string }) => {
    await guard(() =>
      runGenerate(process.cwd(), {
        locale: opts.locale,
        format: opts.format as FormFactorT | undefined,
        slot: opts.slot,
      }),
    );
  });

async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(exitCodeFor(err));
  }
}

program.parseAsync(process.argv);
