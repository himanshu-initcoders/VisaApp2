# Passport catalog (Fresh / Re-issue / Infant)

India-only passport products mirror the visa listing hub, but use separate tables.

## Tables
- `passport_listings` — unique `service_type` (`fresh` | `reissue` | `fresh_infant` | `reissue_infant`)
- `passport_listing_prices` — unique `(listing, scheme, booklet_pages)` for Normal/Tatkaal × 36/60
- `passport_form_steps` — admin-defined apply tabs
- `passport_additional_questions` — questions belong to a step
- `passport_components_required` — documents from global `document_types`
- `passport_faqs`
- `passport_form_versions` — published apply config JSON
- `passport_application_drafts` — logged-in draft payloads
- `passport_services` — applications (`fresh`/`reissue`/`fresh_infant`/`reissue_infant`, listing/price/form refs, answers, reference `PS` + 12 digits)

## Admin
`/admin/config/passport-listings` → hub → basic / tiers / forms / docs / content

## Public + apply
- `/passport` reads active listings for hero pricing, docs, FAQs
- Apply: `/passport/fresh/apply`, `/passport/reissue/apply`, `/passport/fresh_infant/apply`, `/passport/reissue_infant/apply`
- Wizard: form steps → documents → review → Razorpay pay / free submit

## Infant clones
- Migration `0052` adds enum values `fresh_infant` / `reissue_infant`.
- `0053` is a no-op placeholder (Drizzle runs pending migrations in **one transaction**; Postgres cannot use a newly added enum label until commit).
- Post-migrate seed: `npm run db:ensure-passport-infant` (`scripts/ensure-passport-infant-listings.ts`), also wired from `db:migrate` — clones prices, steps, questions, documents, FAQs.

## Related
- [[Database Schema Documentation]]
- [[🔧 Features Roadmap]]
