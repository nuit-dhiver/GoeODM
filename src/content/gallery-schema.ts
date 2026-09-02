import { z } from 'astro:content';

/**
 * Localized text: a map of locale code to string, e.g. { de: "…" } or
 * { de: "…", en: "…" }.
 *
 * No locale is required and none is privileged — a gallery may be published in
 * German only, English only, or in a locale added later. What a gallery must have
 * is at least one. Pages are generated per locale from what is actually
 * present (see `workLocales` in src/utils/locales.ts), so a gallery never renders
 * a language it was not written in.
 */
export const localizedText = z
  .record(z.string(), z.string().min(1))
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one locale is required',
  });

export const gallerySchema = z.object({
  id: z.enum(['fountains', 'monuments', 'artworks']),
  title: localizedText,
  description: localizedText,
});

export type GalleryData = z.infer<typeof gallerySchema>;

export type LocalizedText = Record<string, string>;