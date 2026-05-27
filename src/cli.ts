#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runGenerate } from './commands/generate.js';
import { runDoctor } from './commands/doctor.js';
import { runClean } from './commands/clean.js';
import { runTemplatesList } from './commands/templatesList.js';
import { runFramesList } from './commands/framesList.js';
import { formatVersion } from './version.js';
import { exitCodeFor } from './errors.js';
import type { FormFactorT } from './config/schema.js';

const program = new Command();
program
  .name('screenshot-composer')
  .description('Compose Google Play Store screenshots from Android app screenshots')
  .version(formatVersion(), '-V, --version', 'output version info (tool, node, playwright, chromium)');

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

program
  .command('doctor')
  .description('Diagnose setup (Node, Chromium, config)')
  .action(async () => {
    await guard(async () => {
      const { checks, ok } = await runDoctor(process.cwd());
      for (const c of checks) {
        console.log(`${c.ok ? '✓' : '✗'} ${c.name} — ${c.detail}`);
      }
      if (!ok) process.exit(1);
    });
  });

program
  .command('clean')
  .description('Remove cached artifacts (downloaded Chromium and the project .cache)')
  .option('--cache', 'remove only the project .cache, leave Chromium')
  .action(async (opts: { cache?: boolean }) => {
    await guard(async () => {
      const { removed } = await runClean(process.cwd(), { cache: opts.cache });
      if (removed.length === 0) {
        console.log('Nothing to clean.');
        return;
      }
      for (const r of removed) {
        console.log(`Removed ${r.path} (${formatBytes(r.bytes)})`);
      }
    });
  });

const templates = program.command('templates').description('Inspect templates');
templates
  .command('list')
  .description('List available templates (built-in + project-local)')
  .action(async () => {
    await guard(() => runTemplatesList(process.cwd()));
  });

const frames = program.command('frames').description('Inspect device frames');
frames
  .command('list')
  .description('List available device frames')
  .action(async () => {
    await guard(() => runFramesList());
  });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(exitCodeFor(err));
  }
}

program.parseAsync(process.argv).catch((err) => {
  console.error((err as Error).message);
  process.exit(exitCodeFor(err));
});
