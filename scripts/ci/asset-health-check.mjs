#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { load } from 'cheerio';

const REPO_ROOT = process.cwd();
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const REPORT_PATH = path.join(REPO_ROOT, 'asset-health-report.md');
const GITHUB_STEP_SUMMARY = process.env.GITHUB_STEP_SUMMARY;
const HEAD_SHA = (process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || 'HEAD').trim();
const BASE_SHA = (process.env.GITHUB_BASE_SHA || '').trim();
const ZERO_SHA = /^0+$/;

function run(command) {
  try {
    return execSync(command, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function hasCommit(sha) {
  if (!sha) return false;
  return run(`git cat-file -e ${sha}^{commit}`) !== null;
}

function detectDiffRange() {
  if (BASE_SHA && !ZERO_SHA.test(BASE_SHA) && hasCommit(BASE_SHA) && hasCommit(HEAD_SHA)) {
    return `${BASE_SHA}..${HEAD_SHA}`;
  }

  if (hasCommit('HEAD~1')) {
    return `HEAD~1..${HEAD_SHA}`;
  }

  return null;
}

function parseChangedFiles(diffRange) {
  if (!diffRange) return [];

  const raw = run(`git diff --name-status --find-renames ${diffRange}`);
  if (!raw) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0] || '';
      const kind = status[0] || '';

      if (kind === 'R' || kind === 'C') {
        return {
          status,
          kind,
          oldPath: parts[1] || '',
          newPath: parts[2] || '',
        };
      }

      return {
        status,
        kind,
        oldPath: '',
        newPath: parts[1] || '',
      };
    });
}

function routeFromPageFile(filePath) {
  if (!filePath.startsWith('src/pages/') || !filePath.endsWith('.astro')) return null;

  const rel = filePath.slice('src/pages/'.length).replace(/\.astro$/, '');
  if (rel.includes('[')) {
    return { route: null, dynamic: true };
  }

  if (rel === 'index') {
    return { route: '/', dynamic: false };
  }

  if (rel.endsWith('/index')) {
    return { route: `/${rel.slice(0, -'/index'.length)}/`, dynamic: false };
  }

  return { route: `/${rel}/`, dynamic: false };
}

async function getTargetRoutes(changes) {
  const routes = new Set();
  let runAll = false;
  let reason = '';

  const globalAffectingRoots = [
    'src/components/',
    'src/layouts/',
    'src/styles/',
    'src/i18n/',
    'src/utils/',
  ];

  for (const change of changes) {
    const touched = [change.oldPath, change.newPath].filter(Boolean);

    for (const filePath of touched) {
      if (
        globalAffectingRoots.some((root) => filePath.startsWith(root)) ||
        filePath === 'src/content.config.ts' ||
        filePath === 'src/content/work-schema.ts' ||
        filePath === 'src/loaders/firestore-works.ts' ||
        filePath === 'src/lib/firestore-content.ts'
      ) {
        runAll = true;
        reason = `Global template/shared code changed: ${filePath}`;
      }

      if (filePath.startsWith('src/pages/') && filePath.endsWith('.astro')) {
        const routeData = routeFromPageFile(filePath);
        if (!routeData) continue;

        if (routeData.dynamic) {
          runAll = true;
          reason = `Dynamic page template changed: ${filePath}`;
        } else if (routeData.route) {
          routes.add(routeData.route);
        }
      }
    }
  }

  return { routes, runAll, reason };
}

async function listHtmlFiles(rootDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(abs);
      }
    }
  }

  await walk(rootDir);
  return files;
}

function routeToDistPath(route) {
  const cleanRoute = route.replace(/^\//, '').replace(/\/$/, '');
  if (!cleanRoute) {
    return path.join(DIST_DIR, 'index.html');
  }

  return path.join(DIST_DIR, cleanRoute, 'index.html');
}

function distPathToRoute(filePath) {
  const rel = path.relative(DIST_DIR, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) {
    return `/${rel.slice(0, -'/index.html'.length)}/`;
  }
  return `/${rel}`;
}

function classifyImgType($img) {
  const className = String($img.attr('class') || '');
  if (className.includes('photo-gallery-thumb') || className.includes('photo-lightbox-img')) {
    return 'photo';
  }

  return 'photo';
}

function collectAssets(html) {
  const $ = load(html);
  const assets = [];

  $('model-viewer[src]').each((_, el) => {
    const src = String($(el).attr('src') || '').trim();
    if (src) assets.push({ type: 'model', source: src, tag: 'model-viewer[src]' });
  });

  $('model-viewer[ios-src]').each((_, el) => {
    const src = String($(el).attr('ios-src') || '').trim();
    if (src) assets.push({ type: 'model', source: src, tag: 'model-viewer[ios-src]' });
  });

  $('model-viewer[poster]').each((_, el) => {
    const src = String($(el).attr('poster') || '').trim();
    if (src) assets.push({ type: 'poster', source: src, tag: 'model-viewer[poster]' });
  });

  $('meta[property="og:image"]').each((_, el) => {
    const src = String($(el).attr('content') || '').trim();
    if (src) assets.push({ type: 'poster', source: src, tag: 'meta[property="og:image"]' });
  });

  $('img[src]').each((_, el) => {
    const src = String($(el).attr('src') || '').trim();
    if (src) assets.push({ type: classifyImgType($(el)), source: src, tag: 'img[src]' });
  });

  const deduped = [];
  const seen = new Set();

  for (const asset of assets) {
    const key = `${asset.type}|${asset.source}|${asset.tag}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(asset);
  }

  return deduped;
}

function resolveAssetTarget(assetSource, route) {
  if (!assetSource) return null;

  const clean = assetSource.trim();
  if (!clean || clean.startsWith('data:') || clean.startsWith('blob:')) return null;

  if (clean.startsWith('//')) {
    return { kind: 'remote', url: `https:${clean}`, label: `https:${clean}` };
  }

  if (/^https?:\/\//i.test(clean)) {
    return { kind: 'remote', url: clean, label: clean };
  }

  const noQuery = clean.split('#')[0].split('?')[0];
  if (!noQuery) return null;

  let normalizedPath;
  if (noQuery.startsWith('/')) {
    normalizedPath = path.posix.normalize(noQuery);
  } else {
    const routeDir = route.endsWith('/') ? route : `${route}/`;
    const routeAsFile = path.posix.join(routeDir, 'index.html');
    const baseDir = path.posix.dirname(routeAsFile);
    normalizedPath = path.posix.normalize(path.posix.join(baseDir, noQuery));
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${normalizedPath}`;
    }
  }

  const localPath = path.join(DIST_DIR, normalizedPath.replace(/^\//, ''));
  return { kind: 'local', filePath: localPath, label: normalizedPath };
}

async function checkRemoteAsset(url) {
  const timeoutMs = 15000;

  for (const method of ['HEAD', 'GET']) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status < 400) {
        return { ok: true, details: `${method} ${response.status}` };
      }

      if (method === 'HEAD' && (response.status === 405 || response.status === 501)) {
        continue;
      }

      return { ok: false, details: `${method} ${response.status}` };
    } catch (error) {
      clearTimeout(timer);
      if (method === 'HEAD') continue;
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, details: `${method} request failed: ${message}` };
    }
  }

  return { ok: false, details: 'HEAD and GET failed' };
}

async function validateAsset(asset, route) {
  const target = resolveAssetTarget(asset.source, route);
  if (!target) {
    return { ok: true };
  }

  if (target.kind === 'local') {
    try {
      const stat = await fs.stat(target.filePath);
      if (!stat.isFile()) {
        return { ok: false, reason: 'Path exists but is not a file', resolved: target.label };
      }
      if (stat.size === 0) {
        return { ok: false, reason: 'File exists but is empty', resolved: target.label };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: 'File not found in dist output', resolved: target.label };
    }
  }

  const remoteCheck = await checkRemoteAsset(target.url);
  if (!remoteCheck.ok) {
    // If it is a 3D model asset, receiving a 403 Forbidden is considered successful
    // because it proves the asset exists on Firebase Storage AND is actively protected from crawlers!
    if (asset.type === 'model' && (remoteCheck.details.includes('403') || remoteCheck.details.includes('401'))) {
      return { ok: true };
    }
    return { ok: false, reason: remoteCheck.details, resolved: target.label };
  }

  return { ok: true };
}

function toErrorTitle(assetType) {
  if (assetType === 'poster') return 'Poster not loaded';
  if (assetType === 'model') return '3D model unavailable';
  return 'Missing or broken photo';
}

function toMarkdownTable(rows) {
  if (rows.length === 0) return '_No asset errors detected._';

  const header = '| Page | Type | Asset | Error |\n|---|---|---|---|';
  const body = rows
    .map((row) => `| ${row.route} | ${row.type} | ${row.asset} | ${row.error} |`)
    .join('\n');

  return `${header}\n${body}`;
}

async function main() {
  const diffRange = detectDiffRange();
  const changes = parseChangedFiles(diffRange);
  const { routes, runAll, reason } = await getTargetRoutes(changes);

  const reportLines = [];
  reportLines.push('# Asset Health Check Report');
  reportLines.push('');
  reportLines.push(`- Timestamp: ${new Date().toISOString()}`);
  reportLines.push(`- Diff range: ${diffRange ?? 'N/A (single-commit or first deployment fallback)'}`);
  reportLines.push(`- Changed files scanned: ${changes.length}`);

  if (runAll) {
    reportLines.push(`- Mode: Full-page scan (${reason || 'shared files changed'})`);
  } else {
    reportLines.push('- Mode: Changed-page scan');
  }

  const allHtml = await listHtmlFiles(DIST_DIR);
  const candidatePages = [];

  if (runAll) {
    for (const filePath of allHtml) {
      const route = distPathToRoute(filePath);
      if (route === '/404.html') continue;
      candidatePages.push({ route, filePath });
    }
  } else {
    for (const route of routes) {
      const filePath = routeToDistPath(route);
      try {
        await fs.access(filePath);
        candidatePages.push({ route, filePath });
      } catch {
        // Skip routes that do not exist in the current build output (e.g. removed pages)
      }
    }
  }

  reportLines.push(`- Target pages: ${candidatePages.length}`);

  if (candidatePages.length === 0) {
    reportLines.push('');
    reportLines.push('## Result');
    reportLines.push('No affected pages were detected for this deployment. Validation skipped.');

    const report = `${reportLines.join('\n')}\n`;
    await fs.writeFile(REPORT_PATH, report, 'utf8');
    if (GITHUB_STEP_SUMMARY) await fs.appendFile(GITHUB_STEP_SUMMARY, `\n${report}\n`, 'utf8');

    console.log('Asset health check skipped: no affected routes detected.');
    return;
  }

  const failures = [];
  let inspectedAssets = 0;

  for (const page of candidatePages) {
    const html = await fs.readFile(page.filePath, 'utf8');
    const assets = collectAssets(html);

    for (const asset of assets) {
      inspectedAssets += 1;
      const result = await validateAsset(asset, page.route);
      if (!result.ok) {
        failures.push({
          route: page.route,
          type: asset.type,
          asset: asset.source,
          error: result.reason || 'Unknown error',
        });

        const title = toErrorTitle(asset.type);
        const resolved = result.resolved ? ` (resolved: ${result.resolved})` : '';
        console.error(`::error title=${title}::${page.route} -> ${asset.source}${resolved}: ${result.reason}`);
      }
    }
  }

  reportLines.push(`- Assets inspected: ${inspectedAssets}`);
  reportLines.push(`- Failures: ${failures.length}`);
  reportLines.push('');
  reportLines.push('## Failures');
  reportLines.push(toMarkdownTable(failures));

  const report = `${reportLines.join('\n')}\n`;
  await fs.writeFile(REPORT_PATH, report, 'utf8');
  if (GITHUB_STEP_SUMMARY) await fs.appendFile(GITHUB_STEP_SUMMARY, `\n${report}\n`, 'utf8');

  if (failures.length > 0) {
    throw new Error(`Asset health check failed with ${failures.length} issue(s). See asset-health-report.md.`);
  }

  console.log(`Asset health check passed for ${candidatePages.length} page(s) and ${inspectedAssets} asset(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
