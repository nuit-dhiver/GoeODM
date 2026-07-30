#!/usr/bin/env node

/**
 * Migrate local src/content/works/*.json into Firestore database `content`.
 *
 * Usage:
 *   pnpm works:migrate:dry   # validate + print plan, no writes
 *   pnpm works:migrate       # upsert all works
 *   pnpm works:verify        # read back and compare with local JSON
 *
 * Auth: Application Default Credentials (gcloud auth application-default login,
 * GitHub WIF via google-github-actions/auth, or GOOGLE_APPLICATION_CREDENTIALS).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  FIRESTORE_DATABASE_ID,
  FIRESTORE_PROJECT_ID,
  WORKS_COLLECTION,
  assertWorkShape,
  deepEqual,
  fetchWorksFromFirestore,
  getContentFirestore,
  normalizeWorkRecord,
} from './lib/firestore-works.mjs';

const REPO_ROOT = process.cwd();
const WORKS_DIR = path.join(REPO_ROOT, 'src/content/works');

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify');

async function listJsonFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(absPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(absPath);
    }
  }

  return files;
}

async function loadLocalWorks() {
  if (!(await pathExists(WORKS_DIR))) {
    return [];
  }

  const files = await listJsonFiles(WORKS_DIR);
  const works = [];

  for (const filePath of files) {
    const slug = path.basename(filePath, '.json');
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const work = normalizeWorkRecord(raw, slug);
    assertWorkShape(work, path.relative(REPO_ROOT, filePath));
    works.push({
      ...work,
      source: path.relative(REPO_ROOT, filePath),
    });
  }

  works.sort((a, b) => a.id.localeCompare(b.id));
  return works;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function migrate() {
  const localWorks = await loadLocalWorks();
  console.log(
    `[migrate] project=${FIRESTORE_PROJECT_ID} database=${FIRESTORE_DATABASE_ID} collection=${WORKS_COLLECTION}`,
  );
  console.log(`[migrate] local works: ${localWorks.length}`);

  if (localWorks.length === 0) {
    throw new Error(
      `No local JSON works found in ${path.relative(REPO_ROOT, WORKS_DIR)}. Nothing to migrate.`,
    );
  }

  if (DRY_RUN) {
    for (const work of localWorks) {
      console.log(`[migrate] would upsert ${work.id} from ${work.source}`);
    }
    console.log('[migrate] dry-run complete (no writes)');
    return;
  }

  const db = getContentFirestore();
  const batchSize = 400;
  let written = 0;

  for (let i = 0; i < localWorks.length; i += batchSize) {
    const chunk = localWorks.slice(i, i + batchSize);
    const batch = db.batch();

    for (const work of chunk) {
      const ref = db.collection(WORKS_COLLECTION).doc(work.id);
      batch.set(ref, work.data, { merge: false });
    }

    await batch.commit();
    written += chunk.length;
    console.log(`[migrate] upserted ${written}/${localWorks.length}`);
  }

  console.log('[migrate] write complete; verifying...');
  await verify(localWorks);
}

async function verify(expectedWorks) {
  const remoteWorks = await fetchWorksFromFirestore();
  console.log(`[verify] remote=${remoteWorks.length}`);

  if (remoteWorks.length === 0) {
    console.error('[verify] Firestore works collection is empty');
    process.exitCode = 1;
    return;
  }

  for (const work of remoteWorks) {
    try {
      assertWorkShape(work, `firestore:${work.id}`);
    } catch (error) {
      console.error(`[verify] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }

  let localWorks = expectedWorks;
  if (!localWorks) {
    try {
      localWorks = await loadLocalWorks();
    } catch {
      localWorks = [];
    }
  }

  if (localWorks.length === 0) {
    console.log('[verify] OK — remote works are present and well-formed (no local JSON to compare)');
    return;
  }

  console.log(`[verify] local=${localWorks.length}`);

  const localById = new Map(localWorks.map((w) => [w.id, w.data]));
  const remoteById = new Map(remoteWorks.map((w) => [w.id, w.data]));

  const missingRemote = [...localById.keys()].filter((id) => !remoteById.has(id));
  const unexpectedRemote = [...remoteById.keys()].filter((id) => !localById.has(id));
  const mismatched = [];

  for (const [id, localData] of localById) {
    if (!remoteById.has(id)) continue;
    if (!deepEqual(localData, remoteById.get(id))) {
      mismatched.push(id);
    }
  }

  if (missingRemote.length || unexpectedRemote.length || mismatched.length) {
    if (missingRemote.length) {
      console.error(`[verify] missing in Firestore: ${missingRemote.join(', ')}`);
    }
    if (unexpectedRemote.length) {
      console.error(`[verify] unexpected in Firestore: ${unexpectedRemote.join(', ')}`);
    }
    if (mismatched.length) {
      console.error(`[verify] data mismatch: ${mismatched.join(', ')}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[verify] OK — all works match');
}

async function main() {
  if (VERIFY_ONLY) {
    await verify();
    return;
  }
  await migrate();
}

main().catch((error) => {
  console.error(`[migrate] Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
