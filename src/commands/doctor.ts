import { existsSync } from 'node:fs';
import { CHROMIUM_DIR, projectPaths } from '../paths.js';
import { loadConfig } from '../config/load.js';
import { isChromiumPresent } from '../render/chromium.js';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  ok: boolean;
}

export async function runDoctor(root: string, chromiumDir: string = CHROMIUM_DIR): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];

  // Node version
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'Node.js >= 20',
    ok: nodeMajor >= 20,
    detail: `found v${process.versions.node}`,
  });

  // Chromium presence (downloaded by `generate` on first run)
  const chromiumOk = await isChromiumPresent(chromiumDir);
  checks.push({
    name: 'Chromium installed',
    ok: chromiumOk,
    detail: chromiumOk ? chromiumDir : 'not downloaded yet — run `screenshot-composer generate`',
  });

  // Config validity (informational when absent — doctor can run outside a project)
  const paths = projectPaths(root);
  if (existsSync(paths.config)) {
    try {
      await loadConfig(paths.config);
      checks.push({ name: 'Config', ok: true, detail: paths.config });
    } catch (err) {
      checks.push({ name: 'Config', ok: false, detail: (err as Error).message });
    }
  } else {
    checks.push({ name: 'Config', ok: true, detail: 'no config here (run `init` to create one)' });
  }

  return { checks, ok: checks.every((c) => c.ok) };
}
