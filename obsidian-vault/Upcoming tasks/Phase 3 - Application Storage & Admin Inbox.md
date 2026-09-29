# Phase 3 - Application Storage & Admin Inbox

← [[📋 Upcoming Tasks Hub]]

**Status**: ✅ Implemented (2026-09-23)  
**Priority**: High  
**Depends on**: [[Phase 1 - Document Upload Module]] + [[Phase 2 - Mobile OTP Applicant Login]]  
**Replaces**: Placeholder checkout; wires apply wizard → DB + admin list/detail

---

## Goal

On **mock pay success** (= **submit**):

1. Create one `visa_application` row (status `submitted`) owned by the logged-in user.
2. Upload all IndexDB files to cloud under the locked path.
3. Freeze **form version pointer + full config snapshot** so admin always sees what the user filled, even if the listing form changes later.
4. Give **admin / reviewer** a filterable, paginated applications inbox + CSV export + detail page (per-passenger data, documents, append-only call logs & notes).

**Skip `payments` table** until a real gateway is wired. Mock pay does not insert payment rows.

---

## End-to-end submit flow

```
Checkout (session required — Phase 2)
        │
        ▼
Mock Pay button → always succeeds
        │
        ▼
Server action submitApplication:
  1. Validate session + draft completeness
  2. Resolve published form_version for listing (or fail if none)
  3. INSERT visa_application (
       userId, listingId, countryCode, status=submitted,
       formVersionId, formSnapshot JSON,
       travellers JSON, …
     )
  4. For each passenger/slot: read IndexDB blob (client sends File/Blob
     or server receives multipart) → upload to cloud key path
  5. Attach document keys onto travellers JSON and/or documents table
  6. Mark server draft submitted / delete draft
  7. Clear IndexDB draft on client
        │
        ▼
Success UI → user dashboard / confirmation
        │
        ▼
Admin sees row in /admin/applications
```

**UI rule (locked):** Submit / pay CTA is clear after login; if not logged in, control is **blurred / locked** (“Login to continue”). Successful mock payment **is** submission — no separate unpaid “submit” after pay.

---

## Data model

### Application (one row per submission)

Multi-passenger: **single row**, `travellers` JSON array.

Each traveller element (conceptual):

```json
{
  "passengerId": "uuid",
  "name": "…",
  "passportData": { },
  "tripDetails": { },
  "documents": [
    { "slotKey": "passport-front", "key": "applications/…", "url": "…", "mimeType": "…" }
  ]
}
```

Denormalized columns for filters (recommended):

- `applicantName` (primary traveller / account name)
- `applicantPhone` (copy from user at submit — stable for search)
- `countryCode`, `visaListingId`
- `passengerNames` (tsvector or cached string for ILIKE)
- `status`, `submittedAt`, `formVersionId`
- `formSnapshot` (jsonb) — frozen config

### Form versioning (locked: Both)

1. **Explicit Publish** in admin listing forms/docs UI → creates immutable `form_versions` row:
   - `id`, `listingId`, `version` (monotonic int), `publishedAt`, `publishedBy`
   - `config` jsonb = output of `buildApplyFormConfig` (+ raw questions/components as needed)
2. On submit: store `formVersionId` **and** copy `config` into `formSnapshot` (safety if version row is ever purged).

Admin detail renderer **must** use `formSnapshot` (not live listing config) to label extra questions and document slots.

### Statuses

`draft` (server draft only — optional, not a submitted application) · `submitted` · `under_review` · `approved` · `rejected`

New applications from mock pay start at **`submitted`**.

### Call logs & notes (append-only)

| Entity | Fields |
|--------|--------|
| Call log | `applicationId`, `phone`, `note`, `adminUserId`, `adminName`, `createdAt` |
| Note | `applicationId`, `body` (textarea), `adminUserId`, `adminName`, `createdAt` |

No edit/delete in v1 (append-only). Show newest first on detail page.

---

## Admin inbox

### List page (`/admin/applications`)

**Filters (all combinable):**

- User / applicant name
- Country
- Mobile number
- Application date (from / to)
- Passenger name(s)
- Status
- **Reset filters** button (clears query params)

**Pagination:** page size default 20; total count; URL query params as source of truth  
(`?status=&country=&q=&phone=&passenger=&from=&to=&page=`)

**Results:** same list driven by query params (shareable URL).

**Export:** CSV for v1 (current filter set, capped e.g. 5k rows with warning).

### Detail page (new tab / route)

`/admin/applications/visa/[id]` (extend existing)

Show:

- Meta: applicant, phone, country, listing, submittedAt, status, form version #
- **Per passenger** sections: general/passport, trip, additional answers (from snapshot), documents with preview/download
- Status actions (existing transitions)
- **Call logs** panel (add phone + note)
- **Notes** panel (textarea)

Documents: signed/public URL per provider; admin replace uses Phase 1 delete-old-on-replace.

---

## Implementation checklist

### Schema / migrations

- [x] `form_versions` table + Publish action on listing config
- [x] Enrich `visa_applications` (snapshot, version id, denormalized filter fields, travellers jsonb)
- [x] `application_call_logs`, `application_notes` tables
- [x] Optional `application_drafts` (from Phase 2)
- [x] Generate Drizzle migration (`0007_phase3_applications` + `scripts/apply-phase3-schema.ts`)

### Apply / submit

- [x] Checkout: lock until session; Mock Pay → `submitApplication`
- [x] Batch cloud upload from IndexDB (Phase 1 helper)
- [x] No payments row
- [x] Idempotency key (client submit id) to prevent double-submit duplicates

### Admin

- [x] List filters + pagination + reset + CSV
- [x] Detail passenger-wise UI from snapshot
- [x] Call log + notes APIs (admin/reviewer only)
- [x] Document preview using stored keys

---

## Edge cases

1. **Double-click mock pay** — idempotency token; second call returns existing application id.
2. **Upload fails mid-batch** — do not leave `submitted` without docs; rollback application or status `submit_failed` + cleanup uploaded keys (Phase 1 compensating delete).
3. **No published form version** — block submit with “Listing form not published”.
4. **Listing unpublished / deleted after draft** — submit still allowed if version snapshot publish exists; otherwise fail clearly.
5. **User tries to edit after submit** — API 403; UI shows read-only confirmation.
6. **Admin opens old application after form redesign** — render from `formSnapshot`; missing keys show raw key + value.
7. **Filter with empty result** — empty state + reset CTA.
8. **CSV export too large** — hard cap + message to narrow filters.
9. **Passenger name search** — normalize case/spacing; search inside travellers JSON or denormalized column.
10. **Phone filter** — match last 10 digits regardless of `+91` formatting.
11. **Reviewer vs admin** — both can view apps, call logs, notes, status; user role management stays admin-only.
12. **Orphan IndexDB after success** — client clears on confirmation; leftover drafts ignored if server marks listing draft submitted.
13. **Timezone on application date filter** — store `submittedAt` timestamptz; filter in IST for admin UX (document choice).
14. **Status transition invalid** — reuse `isValidStatusTransition` from auth-utils.

---

## Out of scope

- Real Razorpay / payment rows
- Applicant post-submit document replace
- Excel export (CSV only v1)
- Editable/deletable notes
- Automatic SMS on status change

---

## Done when

- [x] Mock pay creates one submitted application with travellers JSON + cloud docs
- [x] Form version publish + snapshot used on admin detail
- [x] Admin list filters, reset, pagination, CSV work with empty/error edge cases
- [x] Detail page shows all filled fields + documents per passenger
- [x] Call logs and notes are append-only with admin name + timestamp
- [x] Applicant cannot mutate application after submit (no applicant edit APIs; draft cleared)
