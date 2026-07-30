import { Firestore } from '@google-cloud/firestore';

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

/**
 * Normalize legacy JSON quirks before schema validation / Firestore write.
 * genesis.json nested artist/year/material inside location.
 */
export function normalizeWorkRecord(raw, slug) {
  const data = structuredClone(raw);

  if (data.location && typeof data.location === 'object') {
    const location = data.location;

    if (!data.artist && typeof location.artist === 'string') {
      data.artist = location.artist;
    }
    if (!data.year && typeof location.year === 'string') {
      data.year = location.year;
    }
    if (!data.material && location.material && typeof location.material === 'object') {
      data.material = location.material;
    }

    data.location = {
      lat: location.lat,
      lng: location.lng,
      ...(typeof location.address === 'string' ? { address: location.address } : {}),
      ...(typeof location.myMapsEmbedUrl === 'string'
        ? { myMapsEmbedUrl: location.myMapsEmbedUrl }
        : {}),
    };
  }

  if (!Array.isArray(data.photos)) {
    data.photos = [];
  }

  if (typeof data.downloadAllowed !== 'boolean') {
    data.downloadAllowed = false;
  }

  if (!data.ipStatus) {
    data.ipStatus = 'freedom-of-panorama';
  }

  return { id: slug, data };
}

export function assertWorkShape(work, sourceLabel) {
  const { id, data } = work;
  const errors = [];

  if (!id || typeof id !== 'string') {
    errors.push('missing document id/slug');
  }

  if (!data?.title?.de || !data?.title?.en) {
    errors.push('title.de and title.en are required');
  }
  if (!data?.description?.de || !data?.description?.en) {
    errors.push('description.de and description.en are required');
  }
  if (!['brunnen', 'denkmal', 'kunstwerk'].includes(data?.category)) {
    errors.push('category must be brunnen|denkmal|kunstwerk');
  }
  if (!data?.model || typeof data.model !== 'object') {
    errors.push('model object is required');
  }
  if (
    typeof data?.location?.lat !== 'number' ||
    typeof data?.location?.lng !== 'number'
  ) {
    errors.push('location.lat and location.lng are required numbers');
  }
  if (!Array.isArray(data?.photos)) {
    errors.push('photos must be an array');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid work ${sourceLabel}: ${errors.join('; ')}`);
  }
}

export function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
