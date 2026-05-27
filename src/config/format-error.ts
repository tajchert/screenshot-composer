import type { ZodError, ZodIssue } from 'zod';

/** Render a Zod path like ['slots',0,'layout','tilt','y'] → 'slots[0].layout.tilt.y'. */
export function formatPath(path: ZodIssue['path']): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out ? `.${seg}` : String(seg);
  }
  return out || '(root)';
}

/** Format a ZodError into a readable multi-issue report (all issues, by field path). */
export function formatZodError(file: string, error: ZodError): string {
  const bullets = error.issues.map((i) => `  • ${formatPath(i.path)}: ${i.message}`);
  return `Invalid config: ${file}\n${bullets.join('\n')}`;
}
