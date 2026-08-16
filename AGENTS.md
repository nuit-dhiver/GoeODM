# AGENTS.md

Orientation for coding agents. Read this before exploring — most of what follows
is not derivable from the code, and getting it wrong wastes a build cycle.

## What this is

Open Museum (openmuseum.io): a bilingual site of 3D-scanned public monuments,
fountains and artworks. **Astro 7, `output: 'static'`, deployed to GitHub Pages.**
No SSR, no API routes, no server at runtime. pnpm 9, Node 22, Tailwind v4.

## The one thing that surprises everyone

**Content lives in Firestore and is read only at build time.** A custom loader
(`src/loaders/firestore-works.ts`) pulls the `works` collection during
`astro build`; visitors receive static HTML and never talk to Firestore.

Consequences worth internalising:

- **Editing Firestore does not publish anything.** A deploy must run afterwards —
  push to `main`, or dispatch the *Deploy to GitHub Pages* workflow.
- **`pnpm build` and `pnpm exec astro check` need Google credentials.** Without
  Application Default Credentials they fail at the loader, not at your change.
  Run `gcloud auth application-default login`, or see *Building without
  credentials* below.
- **One malformed document fails the entire build**, and the loader refuses to
  build against an empty collection. A bad write blocks publishing for every
  work, not just the new one.

| | |
|---|---|
| GCP project | `open-museum-885a1` |
| Firestore database | `content` — a **named**, Enterprise-edition database, not `(default)` |
| Collection | `works`, document ID = the URL slug |
| Assets | Firebase Storage: `models/**` (auth required), `images/**` (public) |

## Content model

Localized fields (`title`, `description`, `material`, `tour[].text`, `tour[].audio`)
are **maps of locale code to string**, e.g. `{ de: "…", en: "…" }` or just
`{ de: "…" }`.

**No locale is required and none is the default.** A work is published in the
locales it carries, and pages are generated only for those. A work is
"available" in a locale when it has **both a title and a description** there —
that single rule lives in `workLocales()` in `src/utils/locales.ts`, and
everything else derives from it: routes, listings, stats, hreflang, and the
language switcher.

Asset paths are **bucket-relative with a leading slash** (`/models/slug.glb`),
resolved at build time by `getAssetUrl()` in `src/utils/assets.ts`.

Slugs are lowercase-dashed and must avoid the reserved set that collides with
static routes: `about`, `artworks`, `cities`, `fountains`, `monuments`.

### Three places define the shape — keep them in sync

| File | Role |
|---|---|
| `src/content/work-schema.ts` | zod schema; the build's gate |
| `scripts/lib/work-shape.mjs` | dependency-free twin, shared by the CLI **and** the browser tool |
| `firestore.rules` | server-side guard on client writes |

`work-shape.mjs` must stay import-free: the work creator loads it over HTTP.
`firestore.rules` cannot iterate map values, so it is deliberately looser —
type and locale-overlap checks live in the other two.

## Adding a work

```bash
pnpm work:create
```

Serves `tools/work-creator/` on <http://localhost:5174> — a local page that
uploads assets to Storage and writes the Firestore document. It must be
*served*, not opened from disk: Firebase Auth rejects `file://` origins.
Setup and troubleshooting: `tools/work-creator/README.md`.

Writes require a Firebase Auth admin whose UID is allowlisted in
`isContentAdmin()` in both rules files. Never commit
`tools/work-creator/creator.config.json` (gitignored), and never put a
service-account key or GitHub token in it.

## Security rules

`firestore.rules` and `storage.rules` are the source of truth; the repo
overwrites the Firebase Console on deploy. **No workflow deploys them** — it is
manual and easy to forget:

```bash
firebase deploy --only firestore:rules,storage --project open-museum-885a1 --dry-run
```

`--dry-run` compiles server-side without applying, and does catch real syntax
errors. The Firestore emulator does **not** — it silently accepts broken rules,
so do not use it as a validation gate. See issue #94 for the drift problem.

Writes are create-only: `allow update` and `allow delete` are `false` by design.
Edit and delete in the Console.

## Building without credentials

To exercise the build locally without ADC, temporarily patch the loader to read
a fixture file, then restore it — do not commit the patch:

```ts
// src/loaders/firestore-works.ts, inside the try block
if (process.env.WORKS_FIXTURE) {
  const { readFileSync } = await import('node:fs');
  works = JSON.parse(readFileSync(process.env.WORKS_FIXTURE, 'utf8'));
} else
works = await fetchWorksFromFirestore();
```

```bash
WORKS_FIXTURE=/tmp/works.json pnpm exec astro build
```

The fixture is an array of `{ id, data }`. Cover single-locale works when
touching anything locale-related — bilingual-only fixtures hide most of the
interesting bugs. Use `pnpm exec astro build` rather than `pnpm build`, since
`prebuild` also hits Firestore.

## Verifying changes

```bash
node --check scripts/lib/work-shape.mjs   # plain-JS files have no typecheck
```

```bash
pnpm works:verify                          # re-validate every live document (needs ADC)
```

```bash
pnpm test:assets:changed                   # what CI runs against dist/
```

After a build, sweeping `dist/` for internal links that resolve to no file is
worth the two minutes — it has caught dead redirects that no test covered.

## Conventions

- Commit subjects start with an emoji: `✨` feature, `🐛` fix, `🔒` security,
  `🌍` i18n, `⬆️` dependency, `📝` docs, `🔧` chore.
- Standalone tools in `tools/` are dependency-free vanilla JS with their own
  copy of the brutalist CSS tokens; they are outside the Astro build and cannot
  import from `src/`.
- CI runs `pnpm build` and the asset health check on PRs. `astro check` is not
  in CI.

## Known pre-existing issues

Do not "fix" these by accident, and do not be alarmed when they appear:

- `astro check` reports one error: `Cannot find namespace 'z'` in
  `work-schema.ts`. `astro:content` exports `z` as a value, not a namespace.
  The build is unaffected. Avoid adding new `z.infer` uses.
- `/404.html` links to `/de/404/`, which does not exist.
- The Dependabot run for `nanoid` fails inside Dependabot's own updater,
  probably tangling with the `pnpm.overrides` block in `package.json`.
