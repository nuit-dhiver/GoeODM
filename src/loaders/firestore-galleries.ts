import type { Loader } from 'astro/loaders';
import {
  fetchGalleriesFromFirestore,
  FIRESTORE_DATABASE_ID,
  FIRESTORE_PROJECT_ID,
  GALLERIES_COLLECTION,
} from '../lib/firestore-content';
import { readFileSync } from 'node:fs';

/**
 * Build-time Astro content loader for galleries stored in Firestore.
 * Uses Application Default Credentials / IAM — never runs in the browser.
 */
export function firestoreGalleriesLoader(): Loader {
  return {
    name: 'firestore-galleries',
    load: async ({ store, logger, parseData, generateDigest }) => {
      logger.info(
        `Loading galleries from Firestore project=${FIRESTORE_PROJECT_ID} database=${FIRESTORE_DATABASE_ID} collection=${GALLERIES_COLLECTION}`,
      );

      let galleries;
      try {
        if (process.env.GALLERIES_FIXTURE) {
          galleries = JSON.parse(readFileSync(process.env.GALLERIES_FIXTURE, 'utf8'));
        } else {
          galleries = await fetchGalleriesFromFirestore();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to load galleries from Firestore (${FIRESTORE_PROJECT_ID}/${FIRESTORE_DATABASE_ID}/${GALLERIES_COLLECTION}): ${message}`,
        );
      }

      if (galleries.length === 0) {
        throw new Error(
          `Firestore galleries collection is empty (${FIRESTORE_PROJECT_ID}/${FIRESTORE_DATABASE_ID}/${GALLERIES_COLLECTION}). Refusing to build with no content.`,
        );
      }

      store.clear();

      for (const gallery of galleries) {
        const data = await parseData({
          id: gallery.id,
          data: gallery.data,
        });

        store.set({
          id: gallery.id,
          data,
          digest: generateDigest(data),
        });
      }

      logger.info(`Loaded ${galleries.length} galleries from Firestore`);
    },
  };
}