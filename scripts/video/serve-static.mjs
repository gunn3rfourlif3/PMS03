/**
 * Dependency-free static server for the Expo web exports.
 *
 *   node scripts/video/serve-static.mjs --dir mobile-tenant/dist --port 8081
 *
 * Why this exists: `expo start --web` runs Metro, which builds the bundle on
 * demand. During recording that failed silently — the dev server accepted the
 * connection and served the HTML shell, so every health check passed, but the
 * bundle never finished building and the recorder filmed a blank white page for
 * 75 seconds. Nothing in the pipeline could tell that apart from a slow load.
 *
 * A static export removes the whole failure class: the build either succeeds
 * before recording starts, or it fails loudly with a non-zero exit. It is also
 * what production serves, so the video shows the same bundle real users get.
 *
 * No `npx serve` because that needs a network fetch on a cold cache, and this
 * pipeline should run offline once the export exists.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const DIR = arg('dir', 'dist');
const PORT = Number(arg('port', '8081'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

async function send(res, file, status = 200) {
  const body = await readFile(file);
  res.writeHead(status, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': body.length,
    // The recorder opens a fresh context per beat; stale caches would mask a
    // rebuild and film the previous version of the app.
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    // normalize() collapses any ../ before it can escape the export directory.
    const rel = normalize(url).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIR, rel);

    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      await send(res, file);
      return;
    } catch {
      /* fall through to the SPA fallback */
    }

    // Expo Router uses client-side routing, so unknown paths must return the
    // shell rather than a 404 — otherwise a deep link films an error page.
    await send(res, join(DIR, 'index.html'));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`serve-static: ${e.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`serving ${DIR} on http://localhost:${PORT}`);
});
