import { defineCollection } from 'astro:content';
import { workSchema } from './content/work-schema';
import { firestoreWorksLoader } from './loaders/firestore-works';

const works = defineCollection({
  loader: firestoreWorksLoader(),
  schema: workSchema,
});

export const collections = { works };
