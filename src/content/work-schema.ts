import { z } from 'astro:content';

export const tourStepSchema = z.object({
  cameraOrbit: z.string(),
  cameraTarget: z.string().optional(),
  fieldOfView: z.string().optional(),
  text: z.object({
    de: z.string(),
    en: z.string(),
  }),
  audio: z
    .object({
      de: z.string(),
      en: z.string(),
    })
    .optional(),
  durationMs: z.number().optional(),
});

export const workSchema = z.object({
  title: z.object({
    de: z.string(),
    en: z.string(),
  }),
  description: z.object({
    de: z.string(),
    en: z.string(),
  }),
  category: z.enum(['brunnen', 'denkmal', 'kunstwerk']),
  model: z.object({
    glb: z.string().optional(),
    usdz: z.string().optional(),
  }),
  photos: z.array(z.string()).default([]),
  poster: z.string().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
    myMapsEmbedUrl: z.string().optional(),
  }),
  city: z.string().optional(),
  country: z.string().optional(),
  artist: z.string().optional(),
  modelCreator: z.string().optional(),
  year: z.string().optional(),
  material: z
    .object({
      de: z.string(),
      en: z.string(),
    })
    .optional(),
  downloadAllowed: z.boolean().default(false),
  ipStatus: z
    .enum(['public-domain', 'freedom-of-panorama', 'authorized-use'])
    .default('freedom-of-panorama'),
  tour: z.array(tourStepSchema).optional(),
});

export type WorkData = z.infer<typeof workSchema>;
