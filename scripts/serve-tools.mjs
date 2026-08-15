#!/usr/bin/env node

/**
 * Minimal static server for the standalone tools in `tools/`.
 *
 * Why a server at all: Firebase Auth rejects requests from `file://`
 * (origin `null`). `localhost` is an authorized domain by default, so the
 * work creator has to be served rather than double-clicked.
 *
 * Only `/tools/**` and `/scripts/lib/**` are served — the repo root is not,
 * so `.env` and friends stay unreachable. Serving `scripts/lib` is what lets
 * the browser import the same `work-shape.mjs` validation the CLI uses.
 *
 *   node scripts/serve-tools.mjs [--port 5174] [--open /tools/work-creator/]
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REPO_ROOT = process.cwd();
const DEFAULT_PORT = 5174;

/** Directories exposed over HTTP, relative to the repo root. */
const ALLOWED_PREFIXES = ['tools/', 'scripts/lib/'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.usdz': 'model/vnd.usdz+zip',
  '.ico': 'image/x-icon',
};

function parseArgs(argv) {
  const args = { port: DEFAULT_PORT, open: '' };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
        args.port = parsed;
      }
      i += 1;
    } else if (argv[i] === '--open') {
      args.open = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '/tools/';
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) i += 1;
    }
  }

  return args;
}

/**
 * Map a request path to an absolute file path, or null if it escapes the
 * allowlist. Rejects traversal by resolving first and comparing prefixes.
 */
function resolveRequestPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }

  if (decoded.includes('\0')) return null;

  const relative = decoded.replace(/^\/+/, '');
  const withIndex = decoded.endsWith('/') || relative === '' ? `${relative}index.html` : relative;

  const absolute = path.resolve(REPO_ROOT, withIndex);
  const normalizedRelative = path.relative(REPO_ROOT, absolute);

  if (normalizedRelative.startsWith('..') || path.isAbsolute(normalizedRelative)) {
    return null;
  }
  if (!ALLOWED_PREFIXES.some((prefix) => `${normalizedRelative}/`.startsWith(prefix))) {
    return null;
  }

  return absolute;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method not allowed');
    return;
  }

  if (req.url === '/' || req.url === '') {
    send(res, 302, '', { Location: '/tools/work-creator/' });
    return;
  }

  const filePath = resolveRequestPath(req.url);

  if (!filePath) {
    send(res, 403, `Forbidden. This server only exposes ${ALLOWED_PREFIXES.join(' and ')}`);
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    const target = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const content = await fs.readFile(target);
    const contentType = MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      send(res, 404, `Not found: ${req.url}`);
      return;
    }
    send(res, 500, `Server error: ${error.message}`);
  }
});

function openBrowser(url) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(command, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' })
    .on('error', () => console.log(`[tools] Could not open a browser — visit ${url}`))
    .unref();
}

const { port, open } = parseArgs(process.argv.slice(2));

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[tools] Port ${port} is already in use. Try: pnpm tools:serve --port ${port + 1}`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, '127.0.0.1', () => {
  const base = `http://localhost:${port}`;
  console.log(`[tools] Serving ${ALLOWED_PREFIXES.join(', ')} from ${REPO_ROOT}`);
  console.log(`[tools] Work creator: ${base}/tools/work-creator/`);
  console.log(`[tools] Tour editor:  ${base}/tools/tour-editor/`);
  console.log('[tools] Press Ctrl+C to stop.');

  if (open) openBrowser(`${base}${open.startsWith('/') ? open : `/${open}`}`);
});
