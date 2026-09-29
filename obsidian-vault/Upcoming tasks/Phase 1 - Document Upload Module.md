# Phase 1 - Document Upload Module

← [[📋 Upcoming Tasks Hub]]

**Status**: 🟢 Phase 1 code complete (cloud submit wiring in Phase 3)  
**Priority**: High  
**Depends on**: Existing `lib/upload` (`local` | `s3` | `cloudinary`)  
**Unlocks**: Phase 3 cloud persistence; improves Phase 2 cross-device draft (blobs in IndexDB)

---

## Goal

Replace today’s apply-flow storage (blob URLs + `localStorage` data URLs) with:

1. **Immediate** write to **IndexedDB** when the user picks / captures a file (passport pages + document slots).
2. **Cloud upload only on submit** (mock pay success in Phase 3), using whatever `UPLOAD_PROVIDER` is set.
3. **Correct folder/key layout** on both S3 and Cloudinary.
4. **Delete old cloud objects** whenever admin **replace** or **delete** runs after submit.

---

## How it works

### Runtime paths

```
User selects file / passport capture
        │
        ▼
Validate type + size (client)
        │
        ▼
Write binary + metadata → IndexedDB (draft store)
        │
        ▼
UI shows preview from IndexDB (object URL from stored blob)
        │
   [user may replace / remove slot]
        │  → update/delete IndexDB entry only (no cloud)
        ▼
… continue apply, login (Phase 2), mock pay …
        │
        ▼
SUBMIT (Phase 3): create applicationId → upload each IndexDB blob to cloud
        │
        ▼
Persist cloud keys/URLs on application JSON + optional `documents` rows
        │
        ▼
Clear or mark IndexDB draft as submitted
```

### Provider switch (already exists)

| `UPLOAD_PROVIDER` | Backend | Notes |
|-------------------|---------|--------|
| `local` | `public/uploads/` | Dev default |
| `s3` | AWS S3 | Production option A |
| `cloudinary` | Cloudinary | Production option B |

Applicant submit must call an **applicant-authenticated** upload path (today `lib/upload/server-actions.ts` is **admin-only**). Extend, do not fork, the same provider interface.

### Cloud key / folder structure (locked)

```
applications/{countryCode}/{listingId}/{userId}/{applicationId}/passengers/{passengerId}/{slotKey}.{ext}
```

Examples:

- `applications/AE/listing-uuid/user-uuid/app-uuid/passengers/pax-1/passport-front.jpg`
- `applications/AE/listing-uuid/user-uuid/app-uuid/passengers/pax-1/passport-back.jpg`
- `applications/AE/listing-uuid/user-uuid/app-uuid/passengers/pax-1/photo.jpg`
- `applications/AE/listing-uuid/user-uuid/app-uuid/passengers/pax-1/bank_statement.pdf`

**slotKey** = stable document slot key from form config (`passport-front`, `passport-back`, or `components_required.key` / file-question key). Sanitize to `[a-z0-9_-]`.

**Cloudinary:** map the same path to `public_id` / folder hierarchy so S3 and Cloudinary stay isomorphic for admin tooling.

### IndexDB draft model (proposed)

Store name suggestion: `visa-apply-idb-v1`

| Store | Key | Value |
|-------|-----|--------|
| `drafts` | `{listingId}` or `{listingId}:{deviceDraftId}` | Travellers JSON (no large binaries) |
| `files` | `{listingId}:{passengerId}:{slotKey}` | `{ blob, mimeType, filename, updatedAt, size }` |

Resume: on apply page load, hydrate wizard from IndexDB (prefer over legacy `localStorage` data URLs; migrate once if old draft exists).

---

## Replace / delete rules

| When | Who | Storage action |
|------|-----|----------------|
| Before submit | Applicant | Replace/remove slot in **IndexDB only** |
| After submit | Applicant | **Forbidden** (read-only) |
| After submit | Admin | Replace → upload new → **delete previous cloud key**; Delete → **delete cloud key** + clear DB reference |

Use existing `uploadService.replace` / `delete` patterns from `lib/upload` so failed upload never orphans the only copy (upload new first, then delete old).

---

## Implementation checklist

- [x] Add `lib/apply/idbDraftStorage.ts` (open DB, put/get/delete file + draft meta)
- [x] Wire `DocumentsTab` + passport save path to write IndexDB immediately
- [x] Stop persisting large `data:` URLs in `localStorage` (meta only / migrate)
- [x] Extend `UploadFolder` / key builder for application path above
- [x] Applicant server action or API: `uploadApplicationDocuments` (session + ownership checks) — used at submit
- [x] Admin replace/delete paths already delete old keys via `uploadService.replace*` (nested keys supported); application-doc admin UI remains Phase 3
- [x] Quota / size errors surfaced in UI (see edge cases)
- [x] Unit/smoke: provider key builder identical for s3 vs cloudinary folder segments (`lib/upload/__smoke__/applicationKey.smoke.ts`)

### Types / API touchpoints (expected)

- `lib/upload/types.ts` — folder typing or parallel `buildApplicationObjectKey(...)`
- `lib/upload/providers/{s3,cloudinary,local}.ts` — ensure delete works for nested keys
- `components/apply/form/DocumentsTab.tsx` — IndexDB + remove control
- `components/apply/ApplyVisaWizard.tsx` / passport flow — passport blobs to IndexDB
- Phase 3 submit orchestrator will call batch upload

---

## Edge cases

1. **IndexDB quota exceeded** — show clear error; suggest removing a large PDF; do not silently fall back to `localStorage` data URLs.
2. **Private mode / IndexDB unavailable** — block continue with message to use a normal browser session (or offer reduced “memory-only” session with warning that refresh loses files).
3. **Stale object URLs** — revoke `URL.createObjectURL` on unmount / replace; rehydrate preview from IndexDB blob on resume.
4. **Partial submit upload failure** — upload files transactionally where possible; on failure, leave application unsubmitted or mark `upload_failed` and retry without duplicating DB row; delete any objects already written for that failed attempt (compensating cleanup).
5. **Replace before submit** — overwrite IndexDB key; no cloud delete.
6. **Wrong MIME / oversized file** — reject client-side before IndexDB write (reuse whitelist: jpg/jpeg/png/webp/pdf; size limits from product rules).
7. **Passenger removed from draft** — delete all IndexDB file keys for that `passengerId`.
8. **Listing / country code change** — drafts are scoped by `listingId`; do not reuse files across listings.
9. **Cloudinary vs S3 delete by URL** — always store canonical `key` / `public_id` in DB, not only CDN URL; parse URL only as fallback.
10. **Concurrent tabs** — last write wins; optional `updatedAt` conflict toast on resume.

---

## Out of scope (this phase)

- Creating `visa_applications` rows (Phase 3)
- Auth gating uploads (Phase 2 session required at submit)
- Real payment (mock pay is Phase 3)

---

## Done when

- [x] Apply flow stores passport + docs in IndexDB immediately and resumes after refresh
- [x] No large binaries in `localStorage`
- [x] Submit-time upload helper writes to correct nested path on `local` / `s3` / `cloudinary`
- [x] Admin replace/delete removes previous cloud object (catalog path; nested keys supported)
- [ ] Applicant cannot mutate cloud docs after submit (enforced in Phase 3 UI + API)
