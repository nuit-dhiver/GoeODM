# Work Creator

A local page for adding a new work: fill the form, drop in the GLB and photos,
and it uploads the assets to Firebase Storage and writes the `works/<slug>`
document — instead of hand-authoring the document in the Firebase Console and
uploading files one by one.

```bash
pnpm work:create
```

That serves `tools/` and `scripts/lib/` on <http://localhost:5174> and opens the
page. It must be served rather than opened from disk: Firebase Auth rejects
`file://` origins, while `localhost` is an authorized domain by default.

## One-time setup

1. **Create the admin user.** Firebase Console → Authentication → Sign-in
   method → enable **Email/Password**, then add a user under **Users**. Copy its
   **UID** into the `isContentAdmin()` allowlist in both
   [`firestore.rules`](../../firestore.rules) and
   [`storage.rules`](../../storage.rules) — the two lists must match.

2. **Deploy the rules.** Validate first; the dry run compiles them server-side
   without applying anything:

   ```bash
   firebase deploy --only firestore:rules,storage --project open-museum-885a1 --dry-run
   ```

   ```bash
   firebase deploy --only firestore:rules,storage --project open-museum-885a1
   ```

3. **Write the config.** Copy `creator.config.example.json` to
   `creator.config.json` in this folder and fill it in. That filename is
   gitignored and loads automatically on every visit; you can also drag any
   config file onto the page instead.

   Every `firebase.*` value in it is already public in the built site's HTML —
   it is a convenience, not a credential. **Never** put a service-account key or
   a GitHub token in it.

4. **Check the API key.** If the browser API key is referrer-restricted in the
   Google Cloud console, add `http://localhost:5174` to its allowed referrers,
   or sign-in will fail with a network error.

## What it does

- Derives the slug from the German title (`Gänseliesel` → `gaenseliesel`),
  rejects the reserved slugs that collide with static routes, and checks
  Firestore so you cannot reuse an existing one.
- Validates the document with the same
  [`scripts/lib/work-shape.mjs`](../../scripts/lib/work-shape.mjs) the migration
  CLI uses, so what the tool accepts is what the build accepts.
- Uploads to `models/<slug>.glb`, `models/<slug>.usdz`,
  `images/<slug>-poster.<ext>` and `images/<slug>-<n>.<ext>`, and records
  bucket-relative paths (`/models/<slug>.glb`) the way `getAssetUrl()` expects.
- Renders the GLB before publishing so you can catch a bad orientation or scale.
- Blocks the write until every chosen file has finished uploading — a document
  pointing at missing Storage objects passes the write and then fails the whole
  deploy at `pnpm test:assets:changed`.

Thumbnails need no action: `prebuild` regenerates missing `.webp` from Storage
during CI, so nothing has to be committed for a new work.

## Saved is not live

The site is static and reads Firestore only at build time. After a successful
write the page links to the **Deploy to GitHub Pages** workflow — publishing
means running it (or pushing to `main`).

## Scope

Create-only, by design. Editing, deleting and tour authoring are not here:
edit in the Firebase Console, and use [`../tour-editor/`](../tour-editor/) for
`tour[]` steps. `firestore.rules` denies client deletes outright, because the
build refuses to run against an empty collection.

## Storage rules

[`storage.rules`](../../storage.rules) is now tracked in this repo and is the
source of truth — editing rules in the Console will be overwritten by the next
`firebase deploy`. It preserves the read model the site depends on
(`models/**` needs a session, `images/**` is public) and adds admin-only
`create`/`update` with content-type and size caps: 250 MB for models, 30 MB for
images. Deletes are denied for everyone — removing an object a published
document still points at breaks the work page and the next asset health check.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Email/Password sign-in is not enabled` | Setup step 1 not done |
| `permission-denied` on write | UID missing from `isContentAdmin()`, or rules not deployed |
| `storage/unauthorized` on upload | UID missing from `isContentAdmin()` in `storage.rules`, rules not deployed, or the file exceeds the size cap |
| Sign-in fails with a network error | API key referrer restrictions (setup step 4) |
| Signed in, but reading the collection fails | Wrong `firestore.databaseId` — it is `content`, not `(default)` |
