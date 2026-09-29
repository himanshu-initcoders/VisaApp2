# 📋 Upcoming Tasks Hub

← Back to [[🏠 Home]]

> Finish the visa **form submission pipeline** in three sequential phases.  
> Decisions locked: 2026-09-23 (planning session).

## Phases (build order)

| # | Phase | Doc | Depends on |
|---|--------|-----|------------|
| 1 | Document upload (IndexDB → cloud on submit) | [[Phase 1 - Document Upload Module]] | Existing `lib/upload` — **implemented 2026-09-23** |
| 2 | Mobile OTP applicant login | [[Phase 2 - Mobile OTP Applicant Login]] | Phase 1 IndexDB draft helpers — **implemented 2026-09-23** |
| 3 | Persist applications + admin inbox | [[Phase 3 - Application Storage & Admin Inbox]] | Phase 1 + Phase 2 — **implemented 2026-09-23** |

## Locked product decisions (summary)

1. **Files during apply** live in **IndexedDB** (resume on device). **Cloud (S3 or Cloudinary via `UPLOAD_PROVIDER`)** only after successful **mock pay = submit**.
2. **Cloud key shape:**  
   `applications/{countryCode}/{listingId}/{userId}/{applicationId}/passengers/{passengerId}/{slotKey}.{ext}`
3. **Replace/delete before submit:** IndexDB only. **After submit:** applicants read-only; **admin only** may replace, and must **delete the old cloud object**.
4. **Applicants:** mobile OTP only (`/signin` + checkout embed). **Admins:** email + password on `/login`. Same `users` table; role `user` for applicants. `superadmin` ≡ `admin` for now.
5. **OTP:** keep **mock that always passes** until a real SMS provider is chosen.
6. **After login:** optional **server draft** sync (IndexDB → DB) so user can continue on another device.
7. **DB `visa_application` row** created **on mock pay / submit** (not earlier). Skip `payments` table until real gateway.
8. **Form versioning:** explicit **Publish form version** + store **version pointer + full config snapshot** on the application.
9. **Multi-passenger:** one application row, **JSON travellers array**.
10. **Admin list:** filters (name, country, mobile, date, passenger names, status) + reset + pagination + CSV export. Detail page: filled data + docs + call logs + notes (append-only).

## Suggested implementation order inside each phase

See each phase doc for checklists, edge cases, and file touch-points.

## Related existing code

- Upload providers: `lib/upload/` (`UPLOAD_PROVIDER=local|s3|cloudinary`)
- Apply wizard (client-only today): `components/apply/ApplyVisaWizard.tsx`
- Documents UI: `components/apply/form/DocumentsTab.tsx`
- Mock OTP UI: `components/auth/MobileOtpSignIn.tsx`
- Submit: `lib/apply/submitApplication.ts` + `CheckoutPayStep` mock pay
- Admin applications: `app/(admin)/admin/applications/` (filters, CSV, traveller detail, notes/call logs)
- Schema: `lib/db/schema.ts` (`visaApplications`, `formVersions`, `applicationNotes`, `applicationCallLogs`, `documents`, `users`)
