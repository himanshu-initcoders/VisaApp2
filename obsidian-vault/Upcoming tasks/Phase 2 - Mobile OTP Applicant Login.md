# Phase 2 - Mobile OTP Applicant Login

← [[📋 Upcoming Tasks Hub]]

**Status**: 🟢 Phase 2 code complete (mock OTP; real SMS later)  
**Priority**: High  
**Depends on**: Soft dependency on Phase 1 IndexDB drafts (resume UX)  
**Unlocks**: Phase 3 submit (must be logged in before pay)

---

## Goal

Applicants authenticate with **mobile number + OTP only** (no email required).

- Reuse / extract the existing UI from [[MobileOtpSignIn]] (`components/auth/MobileOtpSignIn.tsx`) into a shared component used on:
  - Root / marketing entry (as product needs)
  - `/signin`
  - Apply **checkout** step (before mock pay) — locked / blurry until logged in
- Keep **`/login` email + password for admins only**
- Same **`users`** table as admins; applicants get `role = 'user'`
- After login: **sync IndexDB draft → server draft** so the user can continue on another device

---

## How it works

### Applicant journey at checkout

```
Apply filled (IndexDB) → Checkout step
        │
        ▼
Not logged in? → Show Mobile OTP panel (blur/lock pay + submit)
        │
        ▼
Enter +91 mobile → Request OTP → Enter OTP
        │
        ▼
Mock OTP accepts (always pass until real SMS provider)
        │
        ▼
Find or create users row by phone → NextAuth session (JWT)
        │
        ▼
Sync IndexDB draft → server draft (listing-scoped)
        │
        ▼
Unlock Mock Pay (Phase 3 = submit)
```

### Auth split

| Audience | Entry | Method |
|----------|--------|--------|
| Applicant | `/signin`, checkout embed, optional root CTA | Mobile OTP |
| Admin / reviewer | `/login` only | Email + password |

Middleware:

- `/admin/**` — `admin` | `reviewer` (email session)
- Applicant routes — optional session until checkout; **checkout requires session**
- `/login` — if already applicant session, do not send them into admin; if admin session, redirect `/admin`

### OTP behaviour (locked for now)

- **Mock OTP always passes** (dev and until SMS vendor is chosen).
- Still run client Zod validation (`indianMobileSchema`, `mobileOtpSchema`) so UI and rate-limit plumbing stay real.
- When SMS is added later: swap provider behind `requestOtp` / `verifyOtp`; keep the same UI.

### User identity

- **Phone is primary key for applicants** (E.164 or normalized `10-digit IN` + country code stored consistently).
- Same number later → **same `users` row**; new applications link via `userId`.
- Admins continue to use **email + password**; they should also have mobile on the record when provisioned, but **admin login stays email/password** (not OTP).

### Roles

| Role | Meaning |
|------|---------|
| `user` | Applicant |
| `admin` | Admin (includes “superadmin” for now — no separate role) |
| `reviewer` | Ops reviewer |

---

## Component extraction

Today `/signin` mounts `MobileOtpSignIn` with no real `onOtpComplete`.

**Target:**

1. Keep `MobileOtpSignIn` as the **pure UI + local step state** component.
2. Add thin wrappers / props:
   - `onVerified({ phone, userId })`
   - `redirectTo?`
   - `variant?: 'page' | 'checkout-embed'`
3. Wire real verify in:
   - `app/(auth)/signin/page.tsx`
   - Checkout section inside `ApplyVisaWizard` pay step
   - Optional root entry CTA

---

## Server draft sync (after login)

Purpose: continue on another device after OTP.

Proposed shape:

- Table or JSON column: `application_drafts`  
  `{ userId, listingId, payload, updatedAt }` unique `(userId, listingId)`
- On login at checkout: merge strategy
  1. Push IndexDB → server if server empty or older
  2. If server newer → prompt “Restore cloud draft?” or auto-merge travellers by id
- Files: either embed as deferred uploads (keys pointing at IndexDB) or re-upload binaries to a **private draft** area — prefer **keep binaries in IndexDB until submit** and sync **metadata + traveller JSON** only; on new device, user re-uploads missing files unless we later add draft cloud storage.

**v1 recommendation:** sync **structured draft JSON** after login; **files remain IndexDB-only until submit**. On new device, show “Documents missing — please re-upload” per slot. (Document this UX; avoids unpaid cloud storage.)

---

## Implementation checklist

- [x] NextAuth Credentials (or custom) provider for `phone` + mock OTP verify
- [x] Session includes `id`, `phone`, `role`, `name?` (email optional for applicants)
- [x] `users.phone` unique where used for applicants; normalize before write
- [x] APIs: `requestOtp`, `verifyOtp` (mock accept)
- [x] Extract/confirm shared `MobileOtpSignIn`; embed on checkout with lock UI
- [x] Middleware: protect checkout progression; keep `/login` for admin
- [x] Server draft upsert + pull after login
- [x] Sign-out clears applicant session without wiping IndexDB (optional “clear draft” action)

---

## Edge cases

1. **Admin phone equals applicant phone** — provisioning must not create two rows; role elevation is admin-only operation. Prefer: admins created via seed/admin UI with email; if phone collides, block applicant OTP into that account or force admin path only.
2. **OTP spam** — even in mock mode, rate-limit by phone + IP (e.g. 5/min).
3. **Session on shared device** — clear messaging; short idle warning optional later.
4. **User abandons after OTP before pay** — session exists; draft on server; no `visa_application` row yet (created on submit only).
5. **Checkout without completing travellers** — keep existing wizard gates; login alone must not skip incomplete passengers.
6. **Applicant visits `/login`** — show link to `/signin` instead of email form (or hide email form for non-staff).
7. **Applicant visits `/admin`** — middleware reject (role `user`).
8. **Mock OTP in production** — acceptable only until SMS provider; track as known risk in [[🔐 Security & Compliance]]; feature-flag `AUTH_OTP_MODE=mock|sms`.
9. **Draft merge conflict** — two devices edit; use `updatedAt` + last-write-wins with toast.
10. **Phone change** — out of scope v1; user keeps number as identity.

---

## Out of scope

- Real SMS (MSG91 / Twilio)
- Email verification for applicants
- Password login for applicants
- Creating submitted applications (Phase 3)

---

## Done when

- [x] Applicant can complete mock OTP on `/signin` and at checkout
- [x] Session is phone-based `user` role
- [x] Pay controls stay locked until authenticated
- [x] `/login` remains admin email/password
- [x] Post-login server draft sync works for JSON payload (files IndexDB until submit)
