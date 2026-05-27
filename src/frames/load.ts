import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';

const FRAMES_DIR = path.dirname(fileURLToPath(import.meta.url));

export interface FrameManifest {
  id: string;
  displayName: string;
  manufacturer: string;
  colors: string[];
  intrinsic: { width: number; height: number };
  screen: { x: number; y: number; width: number; height: number; radius: number };
  shadow?: { x: number; y: number; blur: number; color: string };
  files: Record<string, string>;
}

export async function listFrames(): Promise<string[]> {
  const entries = await fs.readdir(FRAMES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .filter((e) => existsSync(path.join(FRAMES_DIR, e.name, 'manifest.json')))
    .map((e) => e.name)
    .sort();
}

/** Read and parse manifest.json for a frame, without loading the SVG. */
export async function loadManifest(id: string): Promise<FrameManifest> {
  const dir = path.join(FRAMES_DIR, id);
  let raw: string;
  try {
    raw = await fs.readFile(path.join(dir, 'manifest.json'), 'utf8');
  } catch {
    throw new Error(`Unknown frame: '${id}'`);
  }
  return JSON.parse(raw) as FrameManifest;
}

export async function loadFrame(
  id: string,
  color?: string,
): Promise<{ manifest: FrameManifest; svg: string; color: string }> {
  const manifest = await loadManifest(id);
  const resolved = color && manifest.files[color] ? color : manifest.colors?.[0];
  if (!resolved || !manifest.files[resolved]) {
    throw new Error(`Frame '${id}' has no usable color/svg files`);
  }
  const chosen = resolved;
  const dir = path.join(FRAMES_DIR, id);
  const svg = await fs.readFile(path.join(dir, manifest.files[chosen]), 'utf8');
  return { manifest, svg, color: chosen };
}

export interface FrameInfo {
  id: string;
  displayName: string;
  colors: string[];
}

/** List built-in frames with display name and available colors. */
export async function listFrameInfos(): Promise<FrameInfo[]> {
  const ids = await listFrames();
  const infos: FrameInfo[] = [];
  for (const id of ids) {
    const manifest = await loadManifest(id);
    infos.push({ id, displayName: manifest.displayName, colors: manifest.colors });
  }
  return infos;
}
