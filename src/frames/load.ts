import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import { FrameManifestSchema, type FrameManifest } from './schema.js';

export type { FrameManifest } from './schema.js';

const FRAMES_DIR = path.dirname(fileURLToPath(import.meta.url));

export async function listFrames(): Promise<string[]> {
  const entries = await fs.readdir(FRAMES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .filter((e) => existsSync(path.join(FRAMES_DIR, e.name, 'manifest.json')))
    .map((e) => e.name)
    .sort();
}

/** Read, parse, and Zod-validate manifest.json for a frame. */
export async function loadManifest(id: string): Promise<FrameManifest> {
  const dir = path.join(FRAMES_DIR, id);
  let raw: string;
  try {
    raw = await fs.readFile(path.join(dir, 'manifest.json'), 'utf8');
  } catch {
    throw new Error(`Unknown frame: '${id}'`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Frame '${id}' has invalid manifest.json: ${(err as Error).message}`);
  }
  const result = FrameManifestSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Frame '${id}' has invalid manifest:\n${issues}`);
  }
  return result.data;
}

export async function loadFrame(
  id: string,
  color?: string,
): Promise<{ manifest: FrameManifest; svg: string; color: string }> {
  const manifest = await loadManifest(id);
  const resolved = color && manifest.files[color] ? color : manifest.colors[0];
  if (!resolved || !manifest.files[resolved]) {
    throw new Error(`Frame '${id}' has no usable color/svg files`);
  }
  const dir = path.join(FRAMES_DIR, id);
  const svg = await fs.readFile(path.join(dir, manifest.files[resolved]), 'utf8');
  return { manifest, svg, color: resolved };
}

export interface FrameInfo {
  id: string;
  displayName: string;
  colors: string[];
}

export async function listFrameInfos(): Promise<FrameInfo[]> {
  const ids = await listFrames();
  const infos: FrameInfo[] = [];
  for (const id of ids) {
    const manifest = await loadManifest(id);
    infos.push({ id, displayName: manifest.displayName, colors: manifest.colors });
  }
  return infos;
}
