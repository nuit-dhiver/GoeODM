#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fetchWorksFromFirestore } from './lib/firestore-works.mjs';

const REPO_ROOT = process.cwd();
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');
const THUMBNAIL_DIR = path.join(PUBLIC_DIR, 'images/thumbnails/works');

const THUMBNAIL_WIDTH = Number(process.env.WORK_THUMBNAIL_WIDTH || 900);
const THUMBNAIL_QUALITY = Number(process.env.WORK_THUMBNAIL_QUALITY || 72);
const CONCURRENCY = Number(process.env.WORK_THUMBNAIL_CONCURRENCY || 4);
const FORCE_REGENERATE = process.argv.includes('--force');

function stripQueryAndHash(value) {
  return value.split('#')[0].split('?')[0];
}

function getThumbnailPath(photoPath) {
  const cleanPath = stripQueryAndHash(photoPath).trim();
  const normalizedPath = cleanPath.replace(/^\/+/, '');
  return `/images/thumbnails/works/${normalizedPath}.webp`;
}

function toRemoteAssetUrl(assetPath, baseUrl) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;

  if (normalizedBase.includes('firebasestorage.googleapis.com')) {
    return `${normalizedBase}/${encodeURIComponent(normalizedPath)}?alt=media`;
  }

  return `${normalizedBase}/${normalizedPath}`;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseEnvVariable(rawEnv, key) {
  const lines = rawEnv.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.startsWith(`${key}=`)) continue;

    let value = trimmed.slice(key.length + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    return value;
  }

  return '';
}

async function loadPublicAssetsBaseUrl() {
  if (process.env.PUBLIC_ASSETS_BASE_URL) {
    return process.env.PUBLIC_ASSETS_BASE_URL.trim();
  }

  const envCandidates = ['.env', '.env.local'];

  for (const envFile of envCandidates) {
    const absPath = path.join(REPO_ROOT, envFile);
    if (!(await pathExists(absPath))) continue;
    const content = await fs.readFile(absPath, 'utf8');
    const value = parseEnvVariable(content, 'PUBLIC_ASSETS_BASE_URL');
    if (value) return value;
  }

  return '';
}

async function getPhotoSourceBuffer(photoPath, publicAssetsBaseUrl) {
  if (/^https?:\/\//i.test(photoPath)) {
    const response = await fetch(photoPath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${photoPath}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  if (publicAssetsBaseUrl) {
    const remoteUrl = toRemoteAssetUrl(photoPath, publicAssetsBaseUrl);
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${remoteUrl}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const localPhotoPath = stripQueryAndHash(photoPath).replace(/^\/+/, '');
  const absLocalPath = path.join(PUBLIC_DIR, localPhotoPath);
  return fs.readFile(absLocalPath);
}

async function runWithConcurrency(items, limit, worker) {
  const inFlight = new Set();

  for (const item of items) {
    const task = Promise.resolve().then(() => worker(item));
    inFlight.add(task);
    task.finally(() => inFlight.delete(task));

    if (inFlight.size >= limit) {
      await Promise.race(inFlight);
    }
  }

  await Promise.all(inFlight);
}

async function main() {
  const publicAssetsBaseUrl = await loadPublicAssetsBaseUrl();
  const works = await fetchWorksFromFirestore();
  const photoSet = new Set();

  for (const work of works) {
    if (!Array.isArray(work.data?.photos)) continue;

    for (const photo of work.data.photos) {
      if (typeof photo === 'string' && photo.trim()) {
        photoSet.add(photo.trim());
      }
    }
  }

  const photos = [...photoSet];

  await fs.mkdir(THUMBNAIL_DIR, { recursive: true });

  let generatedCount = 0;
  let skippedCount = 0;
  const failed = [];

  await runWithConcurrency(photos, Math.max(1, CONCURRENCY), async (photo) => {
    const thumbnailPath = getThumbnailPath(photo);
    const absThumbnailPath = path.join(PUBLIC_DIR, thumbnailPath.replace(/^\/+/, ''));

    await fs.mkdir(path.dirname(absThumbnailPath), { recursive: true });

    if (!FORCE_REGENERATE && (await pathExists(absThumbnailPath))) {
      skippedCount += 1;
      return;
    }

    try {
      const sourceBuffer = await getPhotoSourceBuffer(photo, publicAssetsBaseUrl);

      await sharp(sourceBuffer)
        .rotate()
        .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMBNAIL_QUALITY, effort: 4 })
        .toFile(absThumbnailPath);

      generatedCount += 1;
    } catch (error) {
      failed.push({ photo, error: error instanceof Error ? error.message : String(error) });
    }
  });

  console.log(`[thumbnail] Works loaded from Firestore: ${works.length}`);
  console.log(`[thumbnail] Work gallery photos discovered: ${photos.length}`);
  console.log(`[thumbnail] Generated: ${generatedCount}`);
  console.log(`[thumbnail] Skipped existing: ${skippedCount}`);

  if (failed.length > 0) {
    console.warn(`[thumbnail] Failed: ${failed.length}`);
    for (const entry of failed) {
      console.warn(`[thumbnail] - ${entry.photo}: ${entry.error}`);
    }
  }
}

main().catch((error) => {
  console.error(`[thumbnail] Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
