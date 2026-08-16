import type { Lang } from '@/i18n/ui';
import type { WorkData } from '@/content/work-schema';

/**
 * Which locales a work is actually published in.
 *
 * A work is available in a locale when it has both a title and a description
 * there — those are what every page and card renders, so a locale with only
 * one of them cannot produce a complete page.
 *
 * Deliberately not tied to `de`/`en`: the site's locale list lives in
 * astro.config.mjs and i18n/ui.ts, and a work may carry a locale the site does
 * not serve yet. Routes intersect the two.
 */
export function workLocales(data: Pick<WorkData, 'title' | 'description'>): string[] {
  const title = data.title ?? {};
  const description = data.description ?? {};

  return Object.keys(title).filter(
    (locale) => Boolean(title[locale]?.trim()) && Boolean(description[locale]?.trim()),
  );
}

export function hasLocale(data: Pick<WorkData, 'title' | 'description'>, lang: Lang): boolean {
  return workLocales(data).includes(lang);
}

/**
 * Read a localized field for a locale the caller has already established the
 * work supports. Routes filter by `hasLocale` before rendering, so a miss here
 * means a page was generated for a locale the work does not have — surfacing
 * it is better than rendering `undefined` into the markup.
 */
export function localized(
  field: Record<string, string> | undefined,
  lang: Lang,
  context = 'field',
): string {
  const value = field?.[lang];

  if (value === undefined) {
    throw new Error(
      `Missing "${lang}" in ${context}. Pages should be filtered with hasLocale() before rendering.`,
    );
  }

  return value;
}

/**
 * Same, but for optional fields where absence is legitimate (material, tour
 * audio): returns undefined instead of throwing.
 */
export function localizedOptional(
  field: Record<string, string> | undefined,
  lang: Lang,
): string | undefined {
  return field?.[lang];
}
