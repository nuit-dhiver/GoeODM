import type { Loader } from 'astro/loaders';
import {
  fetchWorksFromFirestore,
  FIRESTORE_DATABASE_ID,
  FIRESTORE_PROJECT_ID,
  WORKS_COLLECTION,
} from '../lib/firestore-content';

/**
 * Build-time Astro content loader for works stored in Firestore.
 * Uses Application Default Credentials / IAM — never runs in the browser.
 */
export function firestoreWorksLoader(): Loader {
  return {
    name: 'firestore-works',
    load: async ({ store, logger, parseData, generateDigest }) => {
      logger.info(
        `Loading works from Firestore project=${FIRESTORE_PROJECT_ID} database=${FIRESTORE_DATABASE_ID} collection=${WORKS_COLLECTION}`,
      );

      let works;
      try {
        works = await fetchWorksFromFirestore();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to load works from Firestore (${FIRESTORE_PROJECT_ID}/${FIRESTORE_DATABASE_ID}/${WORKS_COLLECTION}): ${message}`,
        );
      }

      if (works.length === 0) {
        throw new Error(
          `Firestore works collection is empty (${FIRESTORE_PROJECT_ID}/${FIRESTORE_DATABASE_ID}/${WORKS_COLLECTION}). Refusing to build with no content.`,
        );
      }

      store.clear();

      for (const work of works) {
        const data = await parseData({
          id: work.id,
          data: work.data,
        });

        store.set({
          id: work.id,
          data,
          digest: generateDigest(data),
        });
      }

      logger.info(`Loaded ${works.length} works from Firestore`);
    },
  };
}
