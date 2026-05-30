import http from 'node:http';
import path from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import type { Config, FormFactorT } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { composeSlotHtml } from './compose.js';
import { MissingInputError } from '../errors.js';

export interface RenderServer {
  readonly url: string;
  readonly port: number;
  readonly config: Config;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function startRenderServer(opts: { config: Config; paths: ProjectPaths }): Promise<RenderServer> {
  const { config, paths } = opts;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (url.pathname === '/render') {
        const slotId = url.searchParams.get('slot') ?? '';
        const locale = url.searchParams.get('locale') ?? config.defaultLocale;
        const format = (url.searchParams.get('format') ?? 'phone') as FormFactorT;
        const html = await composeSlotHtml(config, paths, { slotId, locale, format });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (url.pathname.startsWith('/input/')) {
        const rel = decodeURIComponent(url.pathname.slice('/input/'.length));
        // Prevent path traversal.
        const filePath = path.join(paths.inputs, rel);
        const relCheck = path.relative(paths.inputs, filePath);
        if (relCheck.startsWith('..') || path.isAbsolute(relCheck) || !existsSync(filePath)) {
          res.writeHead(404).end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
        const stream = createReadStream(filePath);
        stream.on('error', () => { if (!res.headersSent) res.writeHead(500).end(); else res.destroy(); });
        stream.pipe(res);
        return;
      }

      res.writeHead(404).end('not found');
    } catch (err) {
      const code = err instanceof MissingInputError ? 404 : 500;
      res.writeHead(code, { 'content-type': 'text/plain' }).end((err as Error).message);
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    config,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
