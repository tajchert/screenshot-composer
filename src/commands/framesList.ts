import { listFrameInfos } from '../frames/load.js';

/** Print available device frames to stdout. */
export async function runFramesList(): Promise<void> {
  const frames = await listFrameInfos();
  for (const f of frames) {
    console.log(`${f.id}  ${f.displayName}  [${f.colors.join(', ')}]`);
  }
}
