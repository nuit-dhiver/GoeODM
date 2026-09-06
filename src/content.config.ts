import { defineCollection } from 'astro:content';
import { workSchema } from './content/work-schema';
import { gallerySchema } from './content/gallery-schema';
import { firestoreWorksLoader } from './loaders/firestore-works';
import { firestoreGalleriesLoader } from './loaders/firestore-galleries';

const works = defineCollection({
  loader: firestoreWorksLoader(),
  schema: workSchema,
});

const galleries = defineCollection({
  loader: firestoreGalleriesLoader(),
  schema: gallerySchema,
});

export const collections = { works, galleries };
