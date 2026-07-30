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

let firestoreClient: Firestore | null = null;

export function getContentFirestore(): Firestore {
  if (!firestoreClient) {
    firestoreClient = new Firestore({
      projectId: FIRESTORE_PROJECT_ID,
      databaseId: FIRESTORE_DATABASE_ID,
      ignoreUndefinedProperties: true,
    });
  }

  return firestoreClient;
}

export type WorkDocument = {
  id: string;
  data: Record<string, unknown>;
};

export async function fetchWorksFromFirestore(): Promise<WorkDocument[]> {
  const db = getContentFirestore();
  const snapshot = await db.collection(WORKS_COLLECTION).get();

  const works = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as Record<string, unknown>,
  }));

  works.sort((a, b) => a.id.localeCompare(b.id));
  return works;
}
