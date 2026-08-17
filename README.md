# Open Museum

Open Museum is a bilingual (English/German) static website for exploring 3D reconstructions of monuments, fountains, and public art. The project documents cultural heritage through interactive 3D presentation at [openmuseum.io](https://openmuseum.io).

> Working on the code? [`AGENTS.md`](AGENTS.md) is the orientation guide — architecture, the build's Firestore dependency, and the gotchas that are not visible from the tree. Written for coding agents, but the same ground a new contributor needs.

## Project Goals

The primary aim is to document and preserve 3D models of cultural and artistic heritage in public spaces. By leveraging modern photogrammetry and 3D reconstruction, we make these works accessible for online viewing and cultural documentation.

## Explore the Models

All works are available on the website for interactive viewing in the browser:

- **Browse models**: Visit [openmuseum.io](https://openmuseum.io)
- Models are served as `.glb` (web) and `.usdz` (Apple AR) where available
- Most works are **view-only** on the website; downloads are offered only for selected works where rights allow (see [License](#license))

Each work page shows its IP status (public domain, freedom of panorama, or authorized use) and whether downloads are available.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Astro](https://astro.build/) v7 (static output) |
| Styling | Tailwind CSS v4 |
| 3D viewer | [`<model-viewer>`](https://modelviewer.dev/) v4 |
| Content | Cloud Firestore (`content` / `works`) loaded at build time |
| i18n | Astro built-in routing — English at `/`, German under `/de/` |
| Deployment | GitHub Pages via GitHub Actions |

## Local Development

```bash
pnpm install
pnpm dev
```

Content is fetched from Firestore during `astro dev` and `astro build`. Authenticate with Application Default Credentials first:

```bash
# Option A: gcloud ADC
gcloud auth application-default login

# Option B: point at a credentials file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/adc.json
export GOOGLE_CLOUD_PROJECT=open-museum-885a1
```

Create a `.env` file in the project root for optional configuration (see [Asset Storage](#asset-storage)).

## Asset Storage

Large files (3D models and images) are hosted on external storage to keep the repository lightweight.

The storage URL is configured via the `PUBLIC_ASSETS_BASE_URL` environment variable:

```bash
# .env
PUBLIC_ASSETS_BASE_URL=https://open-museum-885a1.firebasestorage.app
```

Asset paths in Firestore documents are resolved at build/runtime via [`src/utils/assets.ts`](src/utils/assets.ts).

### Modes

- **With remote assets**: Set `PUBLIC_ASSETS_BASE_URL` in `.env` and assets load from Firebase (or another compatible host)
- **With local assets**: Leave `PUBLIC_ASSETS_BASE_URL` empty and place asset files in `public/models/` and `public/images/works/` (these directories are gitignored)
- **Switching providers**: Change the base URL — path resolution is handled centrally in `getAssetUrl()`

### Firebase (authenticated model loading)

When Firebase is configured, model files can be loaded through authenticated requests. Set these in `.env` (or as GitHub Actions variables for deployment):

- `PUBLIC_FIREBASE_API_KEY`
- `PUBLIC_FIREBASE_AUTH_DOMAIN`
- `PUBLIC_FIREBASE_PROJECT_ID`
- `PUBLIC_FIREBASE_STORAGE_BUCKET`
- `PUBLIC_FIREBASE_APP_ID`

## Content

Works are stored in Firestore (project `open-museum-885a1`, database `content`, collection `works`). Each document ID is the work slug (for example `berlinstein`). Astro loads the collection **only at build/dev time** via a custom content loader — visitors receive static HTML and never talk to Firestore.

Edit documents in the [Firebase Console](https://console.firebase.google.com/project/open-museum-885a1/firestore/databases/content/data) or via the Firebase/Admin CLI. Security rules allow **public reads** (the work data is public website content) and deny client writes except for the content-admin allowlist in `isContentAdmin()`, which exists so the work creator below can publish new works. Console/CLI updates use IAM and are not blocked by those rules.

Key fields:

- `title`, `description` — bilingual (`de` / `en`)
- `category` — `brunnen`, `denkmal`, or `kunstwerk`
- `model.glb`, `model.usdz` — asset paths
- `photos`, `poster` — gallery and preview images
- `location` — coordinates, address, optional Google My Maps embed URL
- `city`, `country`, `artist`, `modelCreator`, `year`, `material` — metadata
- `ipStatus` — `public-domain`, `freedom-of-panorama`, or `authorized-use`
- `downloadAllowed` — whether GLB/USDZ download is offered on the work page
- `tour` — optional guided camera tour steps

See [`src/content/work-schema.ts`](src/content/work-schema.ts) for the full schema.

### Adding a work

```bash
pnpm work:create
```

This serves the [work creator](tools/work-creator/) at
<http://localhost:5174/tools/work-creator/>: a local page that uploads the
GLB/USDZ/poster/photos to Firebase Storage and writes the `works/<slug>`
document, validated against the same rules the build enforces. It needs a
one-time setup (an admin user plus a config file) — see
[`tools/work-creator/README.md`](tools/work-creator/README.md).

Gallery thumbnails need no action: `prebuild` regenerates missing `.webp` files
from Storage during the build, so nothing has to be committed for a new work.

Validation is shared between the tool and the CLI in
[`scripts/lib/work-shape.mjs`](scripts/lib/work-shape.mjs); keep it in sync with
`src/content/work-schema.ts` when fields change.

### Publishing content changes

Firestore edits do **not** auto-publish. After updating works:

1. Push to `main`, or
2. Run the **Deploy to GitHub Pages** workflow manually (`workflow_dispatch`)

### Migration helpers

If you still have local JSON under `src/content/works/`:

```bash
pnpm works:migrate:dry   # validate + print plan
pnpm works:migrate       # upsert into Firestore
pnpm works:verify        # read back / validate remote documents
```

### GitHub Actions variables for Firestore builds

In addition to the existing `PUBLIC_*` variables, set:

| Variable | Example |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/717967107645/locations/global/workloadIdentityPools/github-actions/providers/github-oidc` |
| `GCP_SERVICE_ACCOUNT` | `github-astro-build@open-museum-885a1.iam.gserviceaccount.com` |

These enable keyless Workload Identity Federation so CI/deploy can read Firestore at build time.

### Security rules are deployed by CI

`firestore.rules` and `storage.rules` are the source of truth. The **Deploy Firebase Rules** workflow compiles them on every pull request that touches them, deploys them when the change merges to `main`, and redeploys weekly so that an edit made directly in the Firebase Console is detected and overwritten rather than silently diverging.

Editing rules in the Console still works, but the change will be reverted on the next merge or scheduled run unless it is copied back into the repo.

This needs two IAM grants beyond the variables above. The build service account has Firestore read access only, so without both, the workflow fails on its first step:

```bash
gcloud projects add-iam-policy-binding open-museum-885a1 --member="serviceAccount:github-astro-build@open-museum-885a1.iam.gserviceaccount.com" --role="roles/firebaserules.admin"
```

```bash
gcloud projects add-iam-policy-binding open-museum-885a1 --member="serviceAccount:github-astro-build@open-museum-885a1.iam.gserviceaccount.com" --role="roles/serviceusage.serviceUsageViewer"
```

Or in the Cloud Console: **IAM & Admin → IAM →** edit that service account **→ Add role →** *Firebase Rules Admin*, then *Service Usage Viewer*.

The second role is the non-obvious one. Before touching rules at all, the CLI checks that `firestore.googleapis.com` and `firebasestorage.googleapis.com` are enabled, which reads the Service Usage API. Without `serviceusage.services.get` the run dies in that preflight with a 403 that names an API rather than a rules permission — and it dies on the `--dry-run` too, so validation fails as well as deploys. A local deploy does not hit this because a human running it is usually a project Owner.

## Gallery Thumbnails (Build-Time Optimization)

Work-page gallery images use generated `.webp` thumbnails for initial render and load the full-size photo only when the user opens the lightbox.

- Generator script: `pnpm thumbs:generate`
- Script source: `scripts/generate-work-photo-thumbnails.mjs`
- Auto-run before build: `prebuild` runs the generator automatically
- Output directory: `public/images/thumbnails/works/`

The generator reads all `photos` arrays from Firestore works (gallery photos only), then:

- fetches originals from `PUBLIC_ASSETS_BASE_URL` when set (Firebase-compatible URL handling), or
- reads originals from local `public/` when external storage is not configured.

Optional tuning via environment variables:

- `WORK_THUMBNAIL_WIDTH` (default: `900`)
- `WORK_THUMBNAIL_QUALITY` (default: `72`)
- `WORK_THUMBNAIL_CONCURRENCY` (default: `4`)

## CI Asset Health Check

The deployment workflow includes an automated changed-page asset validation step:

- Command: `pnpm test:assets:changed`
- Script: `scripts/ci/asset-health-check.mjs`
- Scope: validates only pages affected by changed content/routes in the current deployment diff
- Checks:
  - poster assets (e.g. `<model-viewer poster>` and `og:image`)
  - photo assets (`<img src>`)
  - 3D model sources (`<model-viewer src>` and `ios-src`)

If validation fails, the workflow:

- fails the build before deployment,
- emits GitHub Actions error annotations per failed asset,
- uploads `asset-health-report.md` as a workflow artifact,
- writes the same report to the workflow step summary for quick triage.

## How to Contribute

Feel free to contribute in any way you can — capturing new models, improving existing ones, or sharing feedback.

If you have questions or suggestions, don't hesitate to get in touch.

## Support Us

Your support means a lot:

- Make a donation
- Star this repository
- Share the project with others

## License

### Code (website / software)

All source code (Astro/TypeScript/CSS/JavaScript) in this repository is licensed under the MIT License. See [`LICENSE`](LICENSE).

### 3D models and media

**Not all assets share the same license.** Rights vary by work:

- **View-only works** — Most 3D models, scans, textures, and photos on the website are shown for online viewing and cultural documentation only. They remain subject to the copyright of their artists, creators, or rights holders. Downloading, reproducing, or creating derivative works is not permitted unless explicitly stated on the individual work page.
- **Downloadable works** — A subset of works is offered for download where the underlying subject is public domain or explicit permission has been granted. Those downloads are released under [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) for non-commercial use, as indicated on each work page.

Check the IP status badge and download controls on each work page at [openmuseum.io](https://openmuseum.io) before reusing any asset. For rights questions or takedown requests, see the [About page](https://openmuseum.io/en/about) or contact alex@openmuseum.io.

Thank you for your interest in Open Museum!
