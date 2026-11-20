# Profile Document Vault

← Back to [[🔧 Features Roadmap]]

## Status
Shipped (visa) — 2026-11-19

## Model
- `passenger_profiles` — durable traveller identity per user (`identityKey` = `pp:` / `nd:` / …)
- `documents` — profile-owned vault rows (`userId`, `profileId`, `visibility`, `supersededByDocumentId`)
- Applications attach frozen refs: `{ documentId, slotKey, key, … }` — **no file copy**

## Replace rule
Insert new vault row → set prior active slot row to `visibility=hidden`. Never delete S3/objects that applications may still reference (same spirit as correction history).

## What belongs in the vault
- Applicant personal docs only: `passport-front` / `passport-back` / `photo`, catalog document types, listing component UUID slots
- **Not** staff outcomes (`visa_outcome`, `passport_outcome`) — those stay on the application
- `/traveller-profiles` (legacy `/documents` redirects) dedupes by catalog type so one passport / one photo per traveller

## Vault vs application separation (critical)
- **Application attachments** are frozen refs in `travellers[].documents[]` (`documentId` + `key`)
- Admin/app document panels resolve via `loadDocumentsForApplication` — not “every row with this applicationId”
- **Vault replace** inserts a new profile row with `applicationId = null` and only hides the prior vault-active row
- Submitted application keeps showing the old file forever
- Repair: `npm run db:repair-vault-app-separation`

## Storage
New visa uploads: `users/{userId}/profiles/{profileId}/{slotKey}[__rev].{ext}`  
Backfilled rows keep legacy `applications/...` keys.

## Ops
```bash
npm run db:migrate
npm run db:backfill-passenger-profiles
```

## Out of scope (this pass)
Passport apply still application-scoped; outcome PDFs stay app-scoped.
