#!/usr/bin/env node

/**
 * Create initial gallery documents in Firestore.
 *
 * Usage:
 *   pnpm works:create-galleries:dry   # validate + print plan, no writes
 *   pnpm works:create-galleries       # create gallery documents
 *
 * Auth: Application Default Credentials (gcloud auth application-default login,
 * GitHub WIF via google-github-actions/auth, or GOOGLE_APPLICATION_CREDENTIALS).
 */

import { Firestore } from '@google-cloud/firestore';
import {
  GALLERY_IDS,
  FIRESTORE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
} from './lib/firestore-works.mjs';

const GALLERIES_COLLECTION = 'galleries';

const DRY_RUN = process.argv.includes('--dry-run');

const INITIAL_GALLERIES = [
  {
    id: 'fountains',
    title: { de: 'Brunnen', en: 'Fountains' },
    description: {
      de: 'Historische und moderne Brunnen im Stadtgebiet',
      en: 'Historic and modern fountains across the city',
    },
  },
  {
    id: 'monuments',
    title: { de: 'Denkmäler', en: 'Monuments' },
    description: {
      de: 'Denkmäler und Gedenkstätten in Göttingen',
      en: 'Monuments and memorials in Göttingen',
    },
  },
  {
    id: 'artworks',
    title: { de: 'Kunstwerke', en: 'Artworks' },
    description: {
      de: 'Skulpturen und Kunstinstallationen im öffentlichen Raum',
      en: 'Sculptures and public art installations',
    },
  },
];

function getContentFirestore() {
  return new Firestore({
    projectId: FIRESTORE_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    ignoreUndefinedProperties: true,
  });
}

async function createGalleries() {
  console.log(
    `[create-galleries] project=${FIRESTORE_PROJECT_ID} database=${FIRESTORE_DATABASE_ID} collection=${GALLERIES_COLLECTION}`,
  );
  console.log(`[create-galleries] galleries to create: ${INITIAL_GALLERIES.length}`);

  if (DRY_RUN) {
    for (const gallery of INITIAL_GALLERIES) {
      console.log(`[create-galleries] would create ${gallery.id}`);
    }
    console.log('[create-galleries] dry-run complete (no writes)');
    return;
  }

  const db = getContentFirestore();
  const batch = db.batch();

  for (const gallery of INITIAL_GALLERIES) {
    const ref = db.collection(GALLERIES_COLLECTION).doc(gallery.id);
    batch.set(ref, gallery, { merge: false });
    console.log(`[create-galleries] queued create for ${gallery.id}`);
  }

  await batch.commit();
  console.log('[create-galleries] write complete');
}

createGalleries().catch((error) => {
  console.error(`[create-galleries] Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});