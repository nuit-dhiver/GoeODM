#!/usr/bin/env node

/**
 * Migrate existing works from German `category` field to English `gallery` field.
 *
 * Usage:
 *   pnpm works:migrate-category-to-gallery:dry   # validate + print plan, no writes
 *   pnpm works:migrate-category-to-gallery       # migrate all works
 *
 * Auth: Application Default Credentials (gcloud auth application-default login,
 * GitHub WIF via google-github-actions/auth, or GOOGLE_APPLICATION_CREDENTIALS).
 */

import { Firestore } from '@google-cloud/firestore';
import {
  GALLERY_ID_MAP,
  FIRESTORE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  WORKS_COLLECTION,
} from './lib/firestore-works.mjs';

const DRY_RUN = process.argv.includes('--dry-run');

function getContentFirestore() {
  return new Firestore({
    projectId: FIRESTORE_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    ignoreUndefinedProperties: true,
  });
}

async function migrateCategoryToGallery() {
  console.log(
    `[migrate-category-to-gallery] project=${FIRESTORE_PROJECT_ID} database=${FIRESTORE_DATABASE_ID} collection=${WORKS_COLLECTION}`,
  );

  const db = getContentFirestore();
  const snapshot = await db.collection(WORKS_COLLECTION).get();

  if (snapshot.empty) {
    console.log('[migrate-category-to-gallery] No works found in Firestore');
    return;
  }

  const works = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data(),
  }));

  console.log(`[migrate-category-to-gallery] found ${works.length} works`);

  let migrated = 0;
  let skipped = 0;
  const errors = [];

  for (const work of works) {
    const data = work.data;
    const oldCategory = data.category;

    if (!oldCategory) {
      errors.push(`${work.id}: missing category field`);
      continue;
    }

    const newGallery = GALLERY_ID_MAP[oldCategory];

    if (!newGallery) {
      errors.push(`${work.id}: unknown category "${oldCategory}"`);
      continue;
    }

    // Check if already migrated
    if (data.gallery === newGallery) {
      skipped++;
      continue;
    }

    console.log(`[migrate-category-to-gallery] ${work.id}: ${oldCategory} -> ${newGallery}`);

    if (!DRY_RUN) {
      const ref = db.collection(WORKS_COLLECTION).doc(work.id);
      await ref.update({
        gallery: newGallery,
        category: Firestore.FieldValue.delete(),
      });
    }
    migrated++;
  }

  if (DRY_RUN) {
    console.log(`[migrate-category-to-gallery] dry-run complete: would migrate ${migrated}, skip ${skipped}`);
  } else {
    console.log(`[migrate-category-to-gallery] complete: migrated ${migrated}, skipped ${skipped}`);
  }

  if (errors.length > 0) {
    console.error('[migrate-category-to-gallery] Errors:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
  }
}

migrateCategoryToGallery().catch((error) => {
  console.error(`[migrate-category-to-gallery] Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});