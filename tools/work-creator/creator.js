/**
 * Work Creator — form logic.
 *
 * Firebase lives entirely in ./firebase-gateway.js. Validation is imported
 * from the same module the migration CLI uses, served by scripts/serve-tools.mjs,
 * so the tool and the build agree on what a valid work is.
 */

import {
  validateWorkShape,
  validateSlug,
  slugify,
  IP_STATUSES,
} from '/scripts/lib/work-shape.mjs';

import {
  applyConfig,
  assetExists,
  findStoredConfig,
  createWork,
  currentUser,
  describeError,
  forgetConfig,
  getConfig,
  listWorks,
  onAuthChange,
  signIn,
  signOutAdmin,
  slugExists,
  uploadAsset,
} from './firebase-gateway.js';

const $ = (id) => document.getElementById(id);

let unsubscribeAuth = null;

const state = {
  slug: '',
  slugEdited: false,
  slugTaken: false,
  existingSlugs: new Set(),
  cities: new Set(),
  assets: { glb: null, usdz: null, poster: null, photos: [] },
  uploading: false,
  signedIn: false,
  saved: null,
};

// ==========================================
// Small helpers
// ==========================================

function trimmedValue(id) {
  return $(id).value.trim();
}

function numberValue(id) {
  const raw = $(id).value.trim();
  if (raw === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function setStatus(element, message, kind = '') {
  element.className = `status-line ${kind}`.trim();
  element.textContent = message;
}

function setStatusList(element, message, items, kind = '') {
  element.className = `status-line ${kind}`.trim();
  element.textContent = message;

  if (items?.length) {
    const list = document.createElement('ul');
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    }
    element.appendChild(list);
  }
}

let toastTimer = null;
function showToast(message, isError = false) {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function fileExtension(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function setBadge(text, kind) {
  const badge = $('connection-badge');
  badge.textContent = text;
  badge.className = `badge badge-${kind}`;
}

// ==========================================
// Config
// ==========================================

function renderConfigSummary(config) {
  const summary = $('config-summary');
  summary.innerHTML = '';

  const rows = [
    ['Project', config.firebase.projectId],
    ['Database', config.firestore.databaseId],
    ['Collection', config.firestore.collection],
    ['Bucket', config.firebase.storageBucket],
  ];

  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    summary.append(dt, dd);
  }

  summary.classList.remove('hidden');
}

function applyDefaults(config) {
  const defaults = config.defaults ?? {};

  if (defaults.city) $('field-city').value = defaults.city;
  if (defaults.country) $('field-country').value = defaults.country;
  if (defaults.modelCreator) $('field-model-creator').value = defaults.modelCreator;
  if (defaults.ipStatus && IP_STATUSES.includes(defaults.ipStatus)) {
    $('field-ip-status').value = defaults.ipStatus;
  }
  if (typeof defaults.downloadAllowed === 'boolean') {
    $('field-download-allowed').checked = defaults.downloadAllowed;
  }
}

async function useConfig(raw, sourceLabel) {
  try {
    await applyConfig(raw);
  } catch (error) {
    setStatusList($('config-status'), 'Config rejected:', error.details ?? [describeError(error)], 'error');
    setBadge('Bad config', 'error');
    return false;
  }

  const config = getConfig();
  renderConfigSummary(config);
  setStatus($('config-status'), `Loaded from ${sourceLabel}.`, 'ok');
  setBadge('Config ready', 'warn');

  $('btn-forget-config').classList.remove('hidden');
  $('auth-email').disabled = false;
  $('auth-password').disabled = false;
  $('btn-sign-in').disabled = false;

  applyDefaults(config);

  // The listener can only be attached once an app exists, so it is wired here
  // rather than at boot — a config attached by hand has to arm it too.
  if (unsubscribeAuth) unsubscribeAuth();
  unsubscribeAuth = onAuthChange((user) => {
    if (user) onSignedIn(user);
  });

  updateAll();
  return true;
}

async function readConfigFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    await useConfig(parsed, file.name);
  } catch (error) {
    setStatus($('config-status'), `Could not read ${file.name}: ${error.message}`, 'error');
  }
}

function wireConfigIntake() {
  $('config-input').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) readConfigFile(file);
  });

  const drop = $('config-drop');
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('dragover');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('dragover');
    const [file] = event.dataTransfer.files;
    if (file) readConfigFile(file);
  });

  $('btn-forget-config').addEventListener('click', () => {
    forgetConfig();
    showToast('Stored config forgotten — reload to start clean');
  });
}

// ==========================================
// Auth
// ==========================================

function wireAuth() {
  $('btn-sign-in').addEventListener('click', async () => {
    const email = trimmedValue('auth-email');
    const password = $('auth-password').value;

    if (!email || !password) {
      setStatus($('auth-status'), 'Email and password are required.', 'error');
      return;
    }

    $('btn-sign-in').disabled = true;
    setStatus($('auth-status'), 'Signing in…');

    try {
      await signIn(email, password);
      $('auth-password').value = '';
    } catch (error) {
      setStatus($('auth-status'), describeError(error), 'error');
      $('btn-sign-in').disabled = false;
    }
  });

  $('auth-password').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') $('btn-sign-in').click();
  });

  $('btn-sign-out').addEventListener('click', async () => {
    await signOutAdmin();
    location.reload();
  });
}

/**
 * Runs on sign-in. Reading the collection is also the connectivity smoke test:
 * if the Web SDK cannot reach the named Enterprise database, it fails here
 * rather than halfway through a publish.
 */
async function loadExistingWorks() {
  setStatus($('auth-status'), 'Reading existing works…');

  try {
    const works = await listWorks();
    state.existingSlugs = new Set(works.map((work) => work.id));
    state.cities = new Set(works.map((work) => work.city).filter(Boolean));
    renderCityOptions();
    setBadge(`${works.length} works`, 'ok');
    setStatus($('auth-status'), `Signed in. ${works.length} works in the collection.`, 'ok');
  } catch (error) {
    setBadge('Read failed', 'error');
    setStatusList(
      $('auth-status'),
      `Signed in, but reading the collection failed: ${describeError(error)}`,
      ['Check firestore.databaseId in the config and that the rules are deployed.'],
      'error',
    );
  }
}

function renderCityOptions() {
  const datalist = $('city-options');
  datalist.innerHTML = '';

  for (const city of [...state.cities].sort((a, b) => a.localeCompare(b))) {
    const option = document.createElement('option');
    option.value = city;
    datalist.appendChild(option);
  }
}

function onSignedIn(user) {
  if (state.signedIn) return;
  state.signedIn = true;

  $('admin-email').textContent = user.email ?? user.uid;
  $('admin-email').classList.remove('hidden');
  $('btn-sign-out').classList.remove('hidden');
  $('setup-panel').classList.add('hidden');
  $('editor').classList.remove('hidden');
  loadExistingWorks().then(updateAll);
}

// ==========================================
// Slug
// ==========================================

let slugCheckTimer = null;

function deriveSlug() {
  if (state.slugEdited) return;
  const derived = slugify(trimmedValue('title-de') || trimmedValue('title-en'));
  $('field-slug').value = derived;
  state.slug = derived;
}

function scheduleSlugCheck() {
  clearTimeout(slugCheckTimer);
  slugCheckTimer = setTimeout(checkSlugAvailability, 400);
}

async function checkSlugAvailability() {
  const slug = state.slug;
  if (!slug || validateSlug(slug).length > 0) return;

  if (state.existingSlugs.has(slug)) {
    state.slugTaken = true;
    updateAll();
    return;
  }

  try {
    state.slugTaken = await slugExists(slug);
  } catch {
    // A failed lookup should not block editing; createWork re-checks anyway.
    state.slugTaken = false;
  }
  updateAll();
}

function renderSlugStatus() {
  const element = $('slug-status');
  const slug = state.slug;

  if (!slug) {
    setStatus(element, 'Type a German title above, or enter a slug directly.');
    return;
  }

  const errors = validateSlug(slug);
  if (errors.length > 0) {
    setStatus(element, errors.join(' · '), 'error');
    return;
  }
  if (state.slugTaken) {
    setStatus(element, `"${slug}" already exists — this tool only creates new works.`, 'error');
    return;
  }

  setStatus(element, `Available → /en/${slug}/ and /de/${slug}/`, 'ok');
}

// ==========================================
// Location helpers
// ==========================================

/**
 * Pull coordinates out of whatever a Google Maps share produces, or a plain
 * "lat, lng" pair.
 */
export function parseCoordinates(input) {
  const text = String(input ?? '').trim();
  if (!text) return null;

  // Place pin: !3d<lat> and !4d<lng>, which point at the place itself rather
  // than the view centre. They are not always adjacent or in order.
  const pinLat = text.match(/!3d(-?\d+(?:\.\d+)?)/);
  const pinLng = text.match(/!4d(-?\d+(?:\.\d+)?)/);
  if (pinLat && pinLng) return { lat: Number(pinLat[1]), lng: Number(pinLng[1]) };

  // Map centre: @<lat>,<lng>,<zoom>z
  const centre = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (centre) return { lat: Number(centre[1]), lng: Number(centre[2]) };

  // query=<lat>,<lng> or ll=<lat>,<lng>
  const query = text.match(/(?:query|q|ll|daddr)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (query) return { lat: Number(query[1]), lng: Number(query[2]) };

  // Bare pair
  const pair = text.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (pair) return { lat: Number(pair[1]), lng: Number(pair[2]) };

  return null;
}

function wireLocation() {
  $('btn-parse-maps').addEventListener('click', () => {
    const parsed = parseCoordinates($('maps-paste').value);

    if (!parsed) {
      showToast('No coordinates found in that text', true);
      return;
    }

    $('field-lat').value = parsed.lat;
    $('field-lng').value = parsed.lng;
    showToast(`Coordinates set: ${parsed.lat}, ${parsed.lng}`);
    updateAll();
  });

  $('maps-paste').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('btn-parse-maps').click();
    }
  });
}

function renderMapLink() {
  const lat = numberValue('field-lat');
  const lng = numberValue('field-lng');
  const link = $('link-verify-map');

  if (lat === undefined || lng === undefined) {
    link.classList.add('hidden');
    return;
  }

  link.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  link.classList.remove('hidden');
}

// ==========================================
// Markdown preview
// ==========================================

let markdownParser;

async function getMarkdownParser() {
  if (markdownParser !== undefined) return markdownParser;

  try {
    const module = await import('https://cdn.jsdelivr.net/npm/marked@17.0.2/+esm');
    markdownParser = (text) => module.marked.parse(text);
  } catch {
    markdownParser = null;
  }

  return markdownParser;
}

function wireMarkdownPreviews() {
  for (const button of document.querySelectorAll('.preview-toggle')) {
    button.addEventListener('click', async () => {
      const sourceId = button.dataset.previewFor;
      const preview = document.querySelector(`[data-preview-of="${sourceId}"]`);
      const isHidden = preview.classList.contains('hidden');

      if (!isHidden) {
        preview.classList.add('hidden');
        button.textContent = 'Preview';
        return;
      }

      const text = $(sourceId).value;
      const parse = await getMarkdownParser();

      if (parse) {
        preview.innerHTML = parse(text);
      } else {
        preview.textContent = text;
        preview.classList.add('font-mono');
      }

      preview.classList.remove('hidden');
      button.textContent = 'Hide';
    });
  }
}

// ==========================================
// Assets
// ==========================================

function makeAsset(kind, file) {
  return { kind, file, path: '', status: 'pending', progress: 0, error: '' };
}

function computeAssetPaths() {
  const config = getConfig();
  if (!config || !state.slug) return;

  const { modelPrefix, imagePrefix } = config.storage;
  const assign = (asset, path) => {
    if (!asset) return;
    // Renaming the slug after an upload means the uploaded object no longer
    // matches the document — send it back to pending.
    if (asset.status === 'done' && asset.path !== path) {
      asset.status = 'pending';
      asset.progress = 0;
    }
    asset.path = path;
  };

  assign(state.assets.glb, `${modelPrefix}${state.slug}.glb`);
  assign(state.assets.usdz, `${modelPrefix}${state.slug}.usdz`);

  if (state.assets.poster) {
    const extension = fileExtension(state.assets.poster.file.name) || 'png';
    assign(state.assets.poster, `${imagePrefix}${state.slug}-poster.${extension}`);
  }

  state.assets.photos.forEach((photo, index) => {
    const extension = fileExtension(photo.file.name) || 'jpg';
    assign(photo, `${imagePrefix}${state.slug}-${index + 1}.${extension}`);
  });
}

function allAssets() {
  return [
    state.assets.glb,
    state.assets.usdz,
    state.assets.poster,
    ...state.assets.photos,
  ].filter(Boolean);
}

function pendingAssets() {
  return allAssets().filter((asset) => asset.status !== 'done');
}

function renderAssetList() {
  const container = $('asset-list');
  container.innerHTML = '';

  const assets = allAssets();
  if (assets.length === 0) {
    container.innerHTML = '<p class="hint">No files chosen yet.</p>';
    return;
  }

  const labels = { glb: 'GLB', usdz: 'USDZ', poster: 'Poster', photo: 'Photo' };

  assets.forEach((asset) => {
    const row = document.createElement('div');
    row.className = `asset-row ${asset.status === 'done' ? 'done' : ''} ${asset.status === 'error' ? 'error' : ''}`.trim();

    const kind = document.createElement('span');
    kind.className = 'asset-row-kind';
    kind.textContent = labels[asset.kind] ?? asset.kind;

    const body = document.createElement('div');
    body.className = 'asset-row-body';

    const name = document.createElement('div');
    name.className = 'asset-row-name';
    const sizeMb = (asset.file.size / 1024 / 1024).toFixed(1);
    name.textContent = `${asset.file.name} · ${sizeMb} MB`;

    const path = document.createElement('div');
    path.className = 'asset-row-path';
    path.textContent = asset.error || (asset.path ? `→ ${asset.path}` : '→ set a slug first');

    const track = document.createElement('div');
    track.className = 'progress-track';
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.style.width = `${asset.status === 'done' ? 100 : asset.progress}%`;
    track.appendChild(bar);

    body.append(name, path, track);

    const actions = document.createElement('div');
    actions.className = 'asset-row-actions';

    const statusLabel = document.createElement('span');
    statusLabel.className = 'hint';
    statusLabel.textContent =
      asset.status === 'done' ? 'uploaded' : asset.status === 'uploading' ? `${asset.progress}%` : asset.status;
    actions.appendChild(statusLabel);

    if (!state.uploading) {
      const remove = document.createElement('button');
      remove.className = 'btn btn-outline btn-xs';
      remove.textContent = '✕';
      remove.title = 'Remove this file';
      remove.addEventListener('click', () => removeAsset(asset));
      actions.appendChild(remove);
    }

    row.append(kind, body, actions);
    container.appendChild(row);
  });
}

function removeAsset(asset) {
  if (asset.kind === 'photo') {
    state.assets.photos = state.assets.photos.filter((entry) => entry !== asset);
  } else {
    state.assets[asset.kind] = null;
    if (asset.kind === 'glb') clearModelPreview();
  }
  updateAll();
}

let previewObjectUrl = null;

function clearModelPreview() {
  const viewer = $('asset-preview');
  viewer.removeAttribute('src');
  $('viewer-placeholder').classList.remove('hidden');

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function showModelPreview(file) {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  $('asset-preview').src = previewObjectUrl;
  $('viewer-placeholder').classList.add('hidden');
}

function wireAssetInputs() {
  for (const input of document.querySelectorAll('.asset-input')) {
    input.addEventListener('change', (event) => {
      const slot = input.dataset.slotInput;
      const files = [...event.target.files];
      if (files.length === 0) return;

      if (slot === 'photos') {
        for (const file of files) state.assets.photos.push(makeAsset('photo', file));
      } else if (slot === 'glb') {
        state.assets.glb = makeAsset('glb', files[0]);
        showModelPreview(files[0]);
      } else {
        state.assets[slot] = makeAsset(slot, files[0]);
      }

      // Allow re-picking the same file after a removal.
      event.target.value = '';
      updateAll();
    });
  }

  $('poster-from-photo').addEventListener('change', (event) => {
    if (event.target.checked && state.assets.poster) {
      state.assets.poster = null;
      showToast('Poster file dropped — using the first gallery photo');
    }
    updateAll();
  });

  $('btn-upload-assets').addEventListener('click', uploadPendingAssets);
}

async function uploadPendingAssets() {
  const pending = pendingAssets().filter((asset) => asset.path);
  if (pending.length === 0) return;

  const uploadStatus = $('upload-status');
  state.uploading = true;
  $('btn-upload-assets').disabled = true;
  setStatus(uploadStatus, 'Checking for existing files…');

  let conflicts = [];
  try {
    const results = await Promise.all(pending.map((asset) => assetExists(asset.path)));
    conflicts = pending.filter((_, index) => results[index]);
  } catch (error) {
    setStatus(uploadStatus, `Could not check Storage: ${describeError(error)}`, 'error');
    state.uploading = false;
    updateAll();
    return;
  }

  if (conflicts.length > 0) {
    const list = conflicts.map((asset) => asset.path).join('\n');
    const proceed = confirm(
      `These objects already exist in Storage and would be overwritten:\n\n${list}\n\nOverwrite them?`,
    );
    if (!proceed) {
      setStatus(uploadStatus, 'Cancelled — nothing was uploaded.', 'warn');
      state.uploading = false;
      updateAll();
      return;
    }
  }

  let uploaded = 0;

  for (const asset of pending) {
    asset.status = 'uploading';
    asset.progress = 0;
    asset.error = '';
    setStatus(uploadStatus, `Uploading ${asset.file.name} (${uploaded + 1}/${pending.length})…`);
    renderAssetList();

    try {
      let lastRendered = 0;
      await uploadAsset({
        file: asset.file,
        fullPath: asset.path,
        onProgress: (percent) => {
          asset.progress = percent;
          // Rebuilding the list on every progress event is wasteful for a
          // 100 MB GLB; 5% steps are plenty for a progress bar.
          if (percent - lastRendered >= 5 || percent === 100) {
            lastRendered = percent;
            renderAssetList();
          }
        },
      });
      asset.status = 'done';
      asset.progress = 100;
      uploaded += 1;
    } catch (error) {
      asset.status = 'error';
      asset.error = describeError(error);
      setStatus(uploadStatus, `Upload failed for ${asset.file.name}: ${asset.error}`, 'error');
      state.uploading = false;
      updateAll();
      return;
    }
  }

  state.uploading = false;
  setStatus(uploadStatus, `Uploaded ${uploaded} file${uploaded === 1 ? '' : 's'}.`, 'ok');
  showToast('Assets uploaded');
  updateAll();
}

// ==========================================
// Document assembly
// ==========================================

function storedPath(asset) {
  return asset?.path ? `/${asset.path}` : '';
}

function photoPaths() {
  return state.assets.photos.map(storedPath).filter(Boolean);
}

function posterPath() {
  if ($('poster-from-photo').checked) {
    return photoPaths()[0] ?? '';
  }
  return storedPath(state.assets.poster);
}

function buildWorkData() {
  const data = {
    title: { de: trimmedValue('title-de'), en: trimmedValue('title-en') },
    description: { de: trimmedValue('desc-de'), en: trimmedValue('desc-en') },
    category: document.querySelector('input[name="category"]:checked')?.value ?? '',
    model: {},
    photos: photoPaths(),
    location: {},
    downloadAllowed: $('field-download-allowed').checked,
    ipStatus: $('field-ip-status').value,
  };

  const glb = storedPath(state.assets.glb);
  const usdz = storedPath(state.assets.usdz);
  if (glb) data.model.glb = glb;
  if (usdz) data.model.usdz = usdz;

  const poster = posterPath();
  if (poster) data.poster = poster;

  const lat = numberValue('field-lat');
  const lng = numberValue('field-lng');
  if (lat !== undefined) data.location.lat = lat;
  if (lng !== undefined) data.location.lng = lng;

  const address = trimmedValue('field-address');
  if (address) data.location.address = address;
  const myMaps = trimmedValue('field-mymaps');
  if (myMaps) data.location.myMapsEmbedUrl = myMaps;

  const optionalFields = {
    city: trimmedValue('field-city'),
    country: trimmedValue('field-country'),
    artist: trimmedValue('field-artist'),
    modelCreator: trimmedValue('field-model-creator'),
    year: trimmedValue('field-year'),
  };
  for (const [key, value] of Object.entries(optionalFields)) {
    if (value) data[key] = value;
  }

  const materialDe = trimmedValue('material-de');
  const materialEn = trimmedValue('material-en');
  if (materialDe || materialEn) {
    data.material = { de: materialDe, en: materialEn };
  }

  return data;
}

/**
 * Everything that must be true before the write button unlocks, plus the
 * advisory notes that should not block a publish.
 */
function collectChecks(data) {
  const errors = [];
  const warnings = [];

  errors.push(...validateWorkShape({ id: state.slug, data }));

  if (state.slugTaken) {
    errors.push(`slug "${state.slug}" already exists in Firestore`);
  }

  const notUploaded = allAssets().filter((asset) => asset.status !== 'done');
  if (notUploaded.length > 0) {
    errors.push(
      `${notUploaded.length} file${notUploaded.length === 1 ? '' : 's'} not uploaded yet — ` +
        'a document that points at missing Storage objects fails the deploy',
    );
  }

  if (!state.assets.usdz) {
    warnings.push('No USDZ — iOS AR Quick Look will be unavailable');
  }
  if (!data.poster) {
    warnings.push('No poster — cards and og:image have nothing to show');
  }
  if (data.photos.length === 0) {
    warnings.push('No gallery photos');
  }
  if (data.downloadAllowed && data.ipStatus === 'freedom-of-panorama') {
    warnings.push('downloadAllowed is ignored while ipStatus is freedom-of-panorama');
  }

  return { errors, warnings };
}

function renderChecks(errors, warnings) {
  const list = $('validation-list');
  list.innerHTML = '';

  const addItem = (text, kind) => {
    const li = document.createElement('li');
    li.className = kind;
    li.textContent = text;
    list.appendChild(li);
  };

  if (errors.length === 0) {
    addItem('Document is valid and ready to write', 'ok');
  }
  for (const error of errors) addItem(error, 'error');
  for (const warning of warnings) addItem(warning, 'warn');
}

function renderDownloadNote() {
  const note = $('download-note');
  const isFop = $('field-ip-status').value === 'freedom-of-panorama';

  if ($('field-download-allowed').checked && isFop) {
    note.textContent =
      'The work page suppresses downloads for freedom-of-panorama works regardless of this flag.';
    note.className = 'hint';
  } else {
    note.textContent = '';
  }
}

// ==========================================
// Write
// ==========================================

async function handleWrite() {
  const data = buildWorkData();
  const { errors } = collectChecks(data);
  if (errors.length > 0) return;

  const writeStatus = $('write-status');
  $('btn-write').disabled = true;
  setStatus(writeStatus, 'Writing to Firestore…');

  try {
    await createWork(state.slug, data);
    state.saved = { slug: state.slug, data };
    showSuccess();
    showToast('Work created');
  } catch (error) {
    setStatus(writeStatus, describeError(error), 'error');
    $('btn-write').disabled = false;
  }
}

function showSuccess() {
  const config = getConfig();
  const { slug } = state.saved;

  $('result-url-en').textContent = `https://openmuseum.io/en/${slug}/`;
  $('result-url-de').textContent = `https://openmuseum.io/de/${slug}/`;

  const deployLink = $('link-deploy');
  if (config.deploy?.workflowUrl) {
    deployLink.href = config.deploy.workflowUrl;
    deployLink.classList.remove('hidden');
  } else {
    deployLink.classList.add('hidden');
  }

  state.existingSlugs.add(slug);
  $('save-result').classList.remove('hidden');
  setStatus($('write-status'), `Created "${slug}".`, 'ok');
  $('save-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function wireResultActions() {
  $('btn-download-json').addEventListener('click', () => {
    if (!state.saved) return;

    const blob = new Blob([JSON.stringify(state.saved.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.saved.slug}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  $('btn-new-work').addEventListener('click', () => location.reload());

  $('btn-toggle-json').addEventListener('click', () => {
    const preview = $('json-preview');
    const isHidden = preview.classList.toggle('hidden');
    $('btn-toggle-json').textContent = isHidden ? 'Show' : 'Hide';
  });

  $('btn-write').addEventListener('click', handleWrite);
}

// ==========================================
// Render loop
// ==========================================

function updateAll() {
  if (!getConfig()) return;

  deriveSlug();
  state.slug = $('field-slug').value.trim();
  computeAssetPaths();

  renderSlugStatus();
  renderAssetList();
  renderMapLink();
  renderDownloadNote();

  const data = buildWorkData();
  const { errors, warnings } = collectChecks(data);
  renderChecks(errors, warnings);

  $('json-preview').textContent = JSON.stringify({ [state.slug || '<slug>']: data }, null, 2);

  const hasPending = pendingAssets().some((asset) => asset.path);
  $('btn-upload-assets').disabled = state.uploading || !hasPending;
  $('btn-write').disabled = state.uploading || errors.length > 0 || Boolean(state.saved);

  const posterSlotInput = document.querySelector('[data-slot-input="poster"]');
  posterSlotInput.disabled = $('poster-from-photo').checked;
}

// ==========================================
// Boot
// ==========================================

function wireFormFields() {
  for (const field of document.querySelectorAll('[data-field]')) {
    field.addEventListener('input', updateAll);
    field.addEventListener('change', updateAll);
  }

  $('field-slug').addEventListener('input', () => {
    state.slugEdited = $('field-slug').value.trim() !== '';
    state.slugTaken = false;
    updateAll();
    scheduleSlugCheck();
  });

  for (const id of ['title-de', 'title-en']) {
    $(id).addEventListener('input', () => {
      state.slugTaken = false;
      scheduleSlugCheck();
    });
  }
}

async function boot() {
  wireConfigIntake();
  wireAuth();
  wireFormFields();
  wireLocation();
  wireMarkdownPreviews();
  wireAssetInputs();
  wireResultActions();

  const loaded = await findStoredConfig();
  if (loaded) {
    await useConfig(loaded.config, loaded.source === 'file' ? 'creator.config.json' : 'this browser');

    // A remembered session restores before the listener fires in some browsers.
    const existing = currentUser();
    if (existing) onSignedIn(existing);
  } else {
    setStatus($('config-status'), 'Waiting for a config file.');
  }
}

boot();

// Exported for manual checks in the console.
export { buildWorkData, collectChecks };
