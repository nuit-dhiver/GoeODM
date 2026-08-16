/**
 * Shared work shape helpers.
 *
 * Dependency-free on purpose: this module is imported both by the Node
 * migration scripts and, over HTTP, by the browser tool in
 * `tools/work-creator/`. Do not add imports here.
 *
 * `src/content/work-schema.ts` remains the schema of record for the build,
 * but it imports `z` from `astro:content` and only resolves inside Astro.
 * Keep the two in sync when fields change.
 */

export const WORK_CATEGORIES = ['brunnen', 'denkmal', 'kunstwerk'];

export const IP_STATUSES = ['public-domain', 'freedom-of-panorama', 'authorized-use'];

/**
 * Slugs that collide with static routes and would be silently dropped by
 * `src/pages/{de,en}/[slug].astro`.
 */
export const RESERVED_SLUGS = ['about', 'artworks', 'cities', 'fountains', 'monuments'];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Convert a title to a slug. Mirrors `cityNameToSlug` in src/i18n/ui.ts
 * (German transliteration) with extra cleanup for punctuation.
 */
// Combining diacritical marks, stripped after NFD so "Café" → "cafe" not "caf-".
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ä/g, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate a document id / slug. Returns a list of human-readable problems.
 */
export function validateSlug(slug) {
  const errors = [];

  if (typeof slug !== 'string' || slug.trim() === '') {
    errors.push('slug is required');
    return errors;
  }

  if (!SLUG_PATTERN.test(slug)) {
    errors.push('slug must be lowercase letters, digits and single dashes (e.g. berlinstein)');
  }
  if (RESERVED_SLUGS.includes(slug)) {
    errors.push(`slug "${slug}" is reserved by a static route and would never render`);
  }

  return errors;
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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function bilingualErrors(value, label, { required }) {
  const errors = [];

  if (value === undefined || value === null) {
    if (required) errors.push(`${label}.de and ${label}.en are required`);
    return errors;
  }

  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object with de and en`);
    return errors;
  }

  for (const lang of ['de', 'en']) {
    if (!isNonEmptyString(value[lang])) {
      errors.push(`${label}.${lang} is required (the site reads ${label}[lang] with no fallback)`);
    }
  }

  return errors;
}

function optionalStringErrors(value, label) {
  if (value === undefined || value === null) return [];
  if (!isNonEmptyString(value)) return [`${label} must be a non-empty string when present`];
  return [];
}

/**
 * Asset paths are bucket-relative — getAssetUrl() in src/utils/assets.ts strips
 * one leading slash and appends the rest to PUBLIC_ASSETS_BASE_URL, so a value
 * without the slash resolves to a different object and 404s.
 */
function assetPathErrors(value, label, { required = false } = {}) {
  if (value === undefined || value === null) {
    return required ? [`${label} is required`] : [];
  }
  if (!isNonEmptyString(value)) {
    return [`${label} must be a non-empty string${required ? '' : ' when present'}`];
  }
  if (!value.startsWith('/') && !/^https?:\/\//i.test(value)) {
    return [`${label} must start with "/" (bucket-relative, e.g. /images/slug-poster.png)`];
  }
  return [];
}

function tourErrors(tour) {
  const errors = [];

  if (tour === undefined || tour === null) return errors;
  if (!Array.isArray(tour)) return ['tour must be an array of steps'];

  tour.forEach((step, index) => {
    const label = `tour[${index}]`;

    if (!isPlainObject(step)) {
      errors.push(`${label} must be an object`);
      return;
    }

    if (!isNonEmptyString(step.cameraOrbit)) {
      errors.push(`${label}.cameraOrbit is required (e.g. "-45.0deg 75.0deg 6.000m")`);
    }
    errors.push(...optionalStringErrors(step.cameraTarget, `${label}.cameraTarget`));
    errors.push(...optionalStringErrors(step.fieldOfView, `${label}.fieldOfView`));
    errors.push(...bilingualErrors(step.text, `${label}.text`, { required: true }));

    if (step.audio !== undefined) {
      errors.push(...bilingualErrors(step.audio, `${label}.audio`, { required: true }));
    }
    if (step.durationMs !== undefined && typeof step.durationMs !== 'number') {
      errors.push(`${label}.durationMs must be a number`);
    }
  });

  return errors;
}

/**
 * Strict validation mirroring `workSchema` in src/content/work-schema.ts.
 * Returns every problem found so a UI can show them at once.
 *
 * Used by the work creator for new content. The looser `assertWorkShape`
 * below stays the gate for the migration CLI, which runs against documents
 * that predate this check.
 */
export function validateWorkShape(work) {
  const { id, data } = work ?? {};
  const errors = validateSlug(id);

  if (!isPlainObject(data)) {
    errors.push('work data must be an object');
    return errors;
  }

  errors.push(...bilingualErrors(data.title, 'title', { required: true }));
  errors.push(...bilingualErrors(data.description, 'description', { required: true }));

  if (!WORK_CATEGORIES.includes(data.category)) {
    errors.push(`category must be one of ${WORK_CATEGORIES.join(' | ')}`);
  }

  if (!isPlainObject(data.model)) {
    errors.push('model object is required');
  } else {
    if (!isNonEmptyString(data.model.glb)) {
      errors.push('model.glb is required — a work without a GLB renders an empty viewer');
    }
    for (const key of ['glb', 'usdz']) {
      errors.push(...assetPathErrors(data.model[key], `model.${key}`));
    }
  }

  if (!Array.isArray(data.photos)) {
    errors.push('photos must be an array');
  } else {
    data.photos.forEach((photo, index) => {
      errors.push(...assetPathErrors(photo, `photos[${index}]`, { required: true }));
    });
  }

  errors.push(...assetPathErrors(data.poster, 'poster'));

  if (!isPlainObject(data.location)) {
    errors.push('location object with lat and lng is required');
  } else {
    const { lat, lng } = data.location;

    if (typeof lat !== 'number' || !Number.isFinite(lat)) {
      errors.push('location.lat must be a number');
    } else if (lat < -90 || lat > 90) {
      errors.push('location.lat must be between -90 and 90');
    }

    if (typeof lng !== 'number' || !Number.isFinite(lng)) {
      errors.push('location.lng must be a number');
    } else if (lng < -180 || lng > 180) {
      errors.push('location.lng must be between -180 and 180');
    }

    errors.push(...optionalStringErrors(data.location.address, 'location.address'));
    errors.push(...optionalStringErrors(data.location.myMapsEmbedUrl, 'location.myMapsEmbedUrl'));
  }

  for (const key of ['city', 'country', 'artist', 'modelCreator']) {
    errors.push(...optionalStringErrors(data[key], key));
  }

  if (data.year !== undefined && data.year !== null) {
    if (typeof data.year === 'number') {
      errors.push('year must be a string, not a number (e.g. "1960")');
    } else {
      errors.push(...optionalStringErrors(data.year, 'year'));
    }
  }

  if (data.material !== undefined && data.material !== null) {
    errors.push(...bilingualErrors(data.material, 'material', { required: true }));
  }

  if (typeof data.downloadAllowed !== 'boolean') {
    errors.push('downloadAllowed must be a boolean');
  }

  if (!IP_STATUSES.includes(data.ipStatus)) {
    errors.push(`ipStatus must be one of ${IP_STATUSES.join(' | ')}`);
  }

  errors.push(...tourErrors(data.tour));

  return errors;
}

/**
 * Migration-CLI gate. Intentionally looser than `validateWorkShape` so it keeps
 * accepting the documents that were already published when it was written.
 */
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
  if (!WORK_CATEGORIES.includes(data?.category)) {
    errors.push(`category must be ${WORK_CATEGORIES.join('|')}`);
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
