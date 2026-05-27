import os from 'node:os';
import path from 'node:path';

export const HOME_DIR = path.join(os.homedir(), '.screenshot-composer');
export const CHROMIUM_DIR = path.join(HOME_DIR, 'chromium');
export const FONTS_DIR = path.join(HOME_DIR, 'fonts');

export const WORKDIR_NAME = 'play-screenshots';

export interface ProjectPaths {
  base: string;
  config: string;
  inputs: string;
  outputs: string;
  templates: string;
  assets: string;
  cache: string;
  gitignore: string;
}

export function projectPaths(root: string): ProjectPaths {
  const base = path.join(root, WORKDIR_NAME);
  return {
    base,
    config: path.join(base, 'screenshot-composer.config.ts'),
    inputs: path.join(base, 'inputs'),
    outputs: path.join(base, 'outputs'),
    templates: path.join(base, 'templates'),
    assets: path.join(base, 'assets'),
    cache: path.join(base, '.cache'),
    gitignore: path.join(base, '.gitignore'),
  };
}
