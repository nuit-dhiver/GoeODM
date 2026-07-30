# Content source moved to Firestore

Works now live in the Firestore `content` database under the `works` collection
(project `open-museum-885a1`). Document IDs are the work slugs.

Edit content in the Firebase Console, then rebuild/deploy the static site
(manually via GitHub Actions `workflow_dispatch` or a push to `main`).

Migration helpers:

```bash
pnpm works:migrate:dry
pnpm works:migrate
pnpm works:verify
```
