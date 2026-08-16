import { Firestore } from '@google-cloud/firestore';

// Shape helpers live in a dependency-free module so the browser tool in
// tools/work-creator/ can import the same validation over HTTP.
export {
  WORK_CATEGORIES,
  IP_STATUSES,
  RESERVED_SLUGS,
  SLUG_PATTERN,
  LOCALE_PATTERN,
  slugify,
  validateSlug,
  normalizeWorkRecord,
  validateWorkShape,
  workLocales,
  assertWorkShape,
  deepEqual,
} from './work-shape.mjs';

export const FIRESTORE_PROJECT_ID =
  process.env.FIRESTORE_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  process.env.GCLOUD_PROJECT?.trim() ||
  process.env.PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
  'open-museum-885a1';

export const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID?.trim() || 'content';

export const WORKS_COLLECTION =
  process.env.FIRESTORE_WORKS_COLLECTION?.trim() || 'works';

let firestoreClient;

export function getContentFirestore() {
  if (!firestoreClient) {
    firestoreClient = new Firestore({
      projectId: FIRESTORE_PROJECT_ID,
      databaseId: FIRESTORE_DATABASE_ID,
      ignoreUndefinedProperties: true,
    });
  }

  return firestoreClient;
}

export async function fetchWorksFromFirestore() {
  const db = getContentFirestore();
  const snapshot = await db.collection(WORKS_COLLECTION).get();
  const works = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data(),
  }));
  works.sort((a, b) => a.id.localeCompare(b.id));
  return works;
}
