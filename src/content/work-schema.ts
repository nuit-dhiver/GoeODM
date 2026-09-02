import { z } from 'astro:content';

/**
 * Localized text: a map of locale code to string, e.g. { de: "Brunnen" } or
 * { de: "…", en: "…" }.
 *
 * No locale is required and none is privileged — a work may be published in
 * German only, English only, or in a locale added later. What a work must have
 * is at least one. Pages are generated per locale from what is actually
 * present (see `workLocales` in src/utils/locales.ts), so a work never renders
 * a language it was not written in.
 */
export const localizedText = z
  .record(z.string(), z.string().min(1))
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one locale is required',
  });

export const tourStepSchema = z.object({
  cameraOrbit: z.string(),
  cameraTarget: z.string().optional(),
  fieldOfView: z.string().optional(),
  text: localizedText,
  audio: localizedText.optional(),
  durationMs: z.number().optional(),
});

export const workSchema = z.object({
  title: localizedText,
  description: localizedText,
  gallery: z.enum(['fountains', 'monuments', 'artworks']),
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
  material: localizedText.optional(),
  downloadAllowed: z.boolean().default(false),
  ipStatus: z
    .enum(['public-domain', 'freedom-of-panorama', 'authorized-use'])
    .default('freedom-of-panorama'),
  tour: z.array(tourStepSchema).optional(),
});

export type WorkData = z.infer<typeof workSchema>;

// Spelled out rather than inferred: `z` re-exported from astro:content is a
// value, not a namespace, so `z.infer` already fails typecheck on the line
// above. Not adding a second instance of that.
export type LocalizedText = Record<string, string>;
