/**
 * The only module in this tool that knows Firebase exists.
 *
 * Everything else talks to it through the exported functions. That isolation
 * is deliberate: if the Web SDK ever fails to reach the Enterprise-edition
 * `content` database, the whole tool can be repointed at a local ADC bridge
 * by rewriting this one file.
 */

// Pinned to the `firebase` version in package.json so the tool and the site
// speak the same SDK.
const FIREBASE_VERSION = '12.13.0';
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const CONFIG_STORAGE_KEY = 'openmuseum:work-creator:config';

const state = {
  config: null,
  app: null,
  auth: null,
  db: null,
  storage: null,
  sdk: null,
};

async function loadSdk() {
  if (state.sdk) return state.sdk;

  const [app, auth, firestore, storage] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
    import(`${CDN}/firebase-storage.js`),
  ]);

  state.sdk = { app, auth, firestore, storage };
  return state.sdk;
}

// ==========================================
// Config
// ==========================================

const REQUIRED_CONFIG_PATHS = [
  'firebase.apiKey',
  'firebase.authDomain',
  'firebase.projectId',
  'firebase.storageBucket',
  'firebase.appId',
  'firestore.databaseId',
  'firestore.collection',
  'storage.modelPrefix',
  'storage.imagePrefix',
];

function readPath(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => (value == null ? value : value[key]), object);
}

export function validateConfig(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return ['Config must be a JSON object'];
  }

  for (const dottedPath of REQUIRED_CONFIG_PATHS) {
    const value = readPath(raw, dottedPath);
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`Missing "${dottedPath}"`);
    }
  }

  if (typeof raw.firebase?.apiKey === 'string' && raw.firebase.apiKey.startsWith('AIza...')) {
    errors.push('firebase.apiKey is still the placeholder from creator.config.example.json');
  }

  for (const key of ['modelPrefix', 'imagePrefix']) {
    const value = raw.storage?.[key];
    if (typeof value === 'string' && value.length > 0 && !value.endsWith('/')) {
      errors.push(`storage.${key} must end with "/" (e.g. "models/")`);
    }
    if (typeof value === 'string' && value.startsWith('/')) {
      errors.push(`storage.${key} must not start with "/" (Storage paths are bucket-relative)`);
    }
  }

  if (raw.private_key || raw.type === 'service_account') {
    errors.push(
      'This looks like a service-account key. Do not use one here — the tool signs in as an admin user instead.',
    );
  }

  return errors;
}

/**
 * Validate, remember and initialize Firebase from a config object.
 */
export async function applyConfig(raw, { persist = true } = {}) {
  const errors = validateConfig(raw);
  if (errors.length > 0) {
    const error = new Error('Invalid config');
    error.details = errors;
    throw error;
  }

  // A key pasted from a console often carries a trailing space or newline,
  // which Identity Toolkit rejects as an invalid key with no hint as to why.
  for (const [key, value] of Object.entries(raw.firebase)) {
    if (typeof value === 'string') raw.firebase[key] = value.trim();
  }

  const { app, auth, firestore, storage } = await loadSdk();

  // Attaching a second config must not silently keep talking to the first
  // project, so tear down any app we already created.
  for (const existing of app.getApps()) {
    await app.deleteApp(existing);
  }

  state.app = app.initializeApp(raw.firebase);
  state.auth = auth.getAuth(state.app);
  state.db = firestore.getFirestore(state.app, raw.firestore.databaseId);
  state.storage = storage.getStorage(state.app);
  state.config = raw;

  if (persist) {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(raw));
    } catch {
      // Private browsing or a full quota — the tool still works this session.
    }
  }

  return raw;
}

/**
 * Look for a config without asking: the file sitting next to this page first
 * (so edits to it win), then whatever was remembered last time. Returns the
 * config without applying it — the caller decides.
 */
export async function findStoredConfig() {
  let response;
  try {
    response = await fetch('./creator.config.json', { cache: 'no-store' });
  } catch {
    // No local config file — fall through to the remembered copy.
  }

  if (response?.ok) {
    try {
      return { source: 'file', config: await response.json() };
    } catch (error) {
      // The file exists but is unreadable. Falling back silently would run the
      // tool against the previous settings and make the user's edit look
      // inert, so report it instead.
      const failure = new Error(`creator.config.json is not valid JSON: ${error.message}`);
      failure.configFileBroken = true;
      throw failure;
    }
  }

  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      return { source: 'browser', config: JSON.parse(stored) };
    }
  } catch {
    // Corrupt or rejected — the attach UI takes over.
  }

  return null;
}

export function forgetConfig() {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

export function getConfig() {
  return state.config;
}

export function isReady() {
  return Boolean(state.config && state.db && state.storage);
}

// ==========================================
// Auth
// ==========================================

export function onAuthChange(callback) {
  if (!state.auth) return () => {};
  return state.sdk.auth.onAuthStateChanged(state.auth, callback);
}

export async function signIn(email, password) {
  const { auth } = state.sdk;
  const credential = await auth.signInWithEmailAndPassword(state.auth, email, password);
  return credential.user;
}

export async function signOutAdmin() {
  await state.sdk.auth.signOut(state.auth);
}

export function currentUser() {
  return state.auth?.currentUser ?? null;
}

// ==========================================
// Firestore
// ==========================================

function worksCollection() {
  const { firestore } = state.sdk;
  return firestore.collection(state.db, state.config.firestore.collection);
}

function workDoc(slug) {
  const { firestore } = state.sdk;
  return firestore.doc(state.db, state.config.firestore.collection, slug);
}

/**
 * Read the existing works. Doubles as the connectivity smoke test — if the
 * Web SDK cannot reach the named Enterprise database, this is where it shows.
 */
export async function listWorks() {
  const snapshot = await state.sdk.firestore.getDocs(worksCollection());
  return snapshot.docs
    .map((doc) => ({ id: doc.id, city: doc.data()?.city ?? '' }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function slugExists(slug) {
  const snapshot = await state.sdk.firestore.getDoc(workDoc(slug));
  return snapshot.exists();
}

/**
 * Create-only write. The read and the write run in one transaction so a
 * document created between the two can never be clobbered — the transaction
 * retries or aborts instead. firestore.rules denies `update` as well, so an
 * overwrite is refused server-side even if this check were bypassed.
 */
export async function createWork(slug, data) {
  const { firestore } = state.sdk;
  const ref = workDoc(slug);

  await firestore.runTransaction(state.db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      throw new Error(
        `A work with the slug "${slug}" already exists. This tool only creates new works — edit it in the Firebase Console instead.`,
      );
    }
    transaction.set(ref, data);
  });

  return slug;
}

// ==========================================
// Storage
// ==========================================

const EXTENSION_CONTENT_TYPES = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  usdz: 'model/vnd.usdz+zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

/**
 * Browsers report an empty type for .glb and .usdz (and occasionally for
 * images), so derive it from the extension first and only fall back to what
 * the file claims. Storage rules gate uploads on `model/*` and `image/*`, so
 * an `application/octet-stream` here is a rejected upload.
 */
export function contentTypeFor(filename, fallback = '') {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_CONTENT_TYPES[extension] || fallback || 'application/octet-stream';
}

export async function assetExists(fullPath) {
  const { storage } = state.sdk;
  try {
    await storage.getMetadata(storage.ref(state.storage, fullPath));
    return true;
  } catch (error) {
    if (error?.code === 'storage/object-not-found') return false;
    // Anything else (permission, network) is worth surfacing rather than
    // silently reporting "does not exist".
    throw error;
  }
}

export function uploadAsset({ file, fullPath, onProgress }) {
  const { storage } = state.sdk;
  const ref = storage.ref(state.storage, fullPath);
  const task = storage.uploadBytesResumable(ref, file, {
    contentType: contentTypeFor(file.name, file.type),
  });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (typeof onProgress !== 'function' || snapshot.totalBytes === 0) return;
        onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      reject,
      () => resolve(fullPath),
    );
  });
}

/**
 * Mirror of getAssetUrl() in src/utils/assets.ts, for preview links.
 */
export function assetUrl(bucketPath) {
  const base = state.config?.assetsBaseUrl;
  if (!base) return bucketPath;

  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = bucketPath.startsWith('/') ? bucketPath.slice(1) : bucketPath;

  if (normalizedBase.includes('firebasestorage.googleapis.com')) {
    return `${normalizedBase}/${encodeURIComponent(normalizedPath)}?alt=media`;
  }

  return `${normalizedBase}/${normalizedPath}`;
}

/**
 * Turn Firebase error codes into something a human can act on.
 */
export function describeError(error) {
  const code = error?.code ?? '';

  const messages = {
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      'Identity Toolkit rejected the API key. Most often the config in use is not the one you edited — check the source line under "Attach config", and compare firebase.apiKey against Firebase Console → Project settings → General → Web API Key (a truncated paste looks exactly like this). If the key is definitely right, check its restrictions in Google Cloud Console → Credentials: website restrictions must permit http://localhost, and API restrictions must allow "Identity Toolkit API" and "Token Service API".',
    'auth/api-key-not-valid': 'Identity Toolkit rejected the API key — see the API restrictions on the key in Google Cloud Console.',
    'auth/invalid-api-key': 'Identity Toolkit rejected the API key — see the API restrictions on the key in Google Cloud Console.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/invalid-email': 'That is not a valid email address.',
    'auth/user-not-found': 'No admin user with that email.',
    'auth/wrong-password': 'Wrong password.',
    'auth/too-many-requests': 'Too many attempts — wait a minute and try again.',
    'auth/operation-not-allowed':
      'Email/Password sign-in is not enabled for this Firebase project (Console → Authentication → Sign-in method).',
    'auth/network-request-failed':
      'Network request failed. If the API key is referrer-restricted, add http://localhost to its allowed referrers.',
    'permission-denied':
      'Firestore rules rejected the write. Confirm your UID is in the isContentAdmin() allowlist in firestore.rules and that the rules are deployed.',
    'storage/unauthorized':
      'Storage rules rejected the upload. Confirm your UID is in the isContentAdmin() allowlist in storage.rules and that the rules are deployed.',
    'storage/retry-limit-exceeded': 'Upload timed out. Check your connection and retry.',
    'unavailable': 'Could not reach Firestore. Check your connection.',
  };

  if (messages[code]) return messages[code];
  return error?.message || String(error);
}
