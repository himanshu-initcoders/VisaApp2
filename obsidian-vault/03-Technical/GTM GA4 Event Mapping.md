# GTM → GA4 event mapping checklist

Viserv pushes custom events to `window.dataLayer` via `lib/analytics/gtm.ts`. GTM container `NEXT_PUBLIC_GTM_ID` already loads sitewide. GA4 is attached inside GTM — configure tags/triggers here.

## Setup steps (Tag Manager UI)

1. Confirm GA4 Configuration tag fires on All Pages (or Initialization).
2. For each event below, create a **Custom Event** trigger where Event name equals the `event` key.
3. Create a **GA4 Event** tag using that trigger; Event Name = same string (or map GA4 recommended names).
4. Register Event Parameters in GA4 (Admin → Custom definitions) for params you want in reports.
5. Mark `purchase` as a key event / conversion in GA4.
6. Use GTM Preview + GA4 DebugView to verify.

## Event catalog

| dataLayer `event` | When | Key params |
|---|---|---|
| `page_view` | App Router navigations (non-admin) | `page_path`, `page_title` |
| `view_item` | Visa listing viewed | `item_id`, `item_name`, `country_code`, `listing_id`, `value`, `currency` |
| `visa_apply_start_click` | Start apply CTA | `country_code`, `listing_id`, `travellers`, `price_option_id` |
| `visa_apply_login_prompt` | OTP gate shown | `source` (`listing_cta` \| `save_draft` \| `proxy_redirect`) |
| `visa_apply_enter` | Apply wizard ready | `listing_id`, `listing_slug`, `resume`, `travellers` |
| `visa_wizard_step_view` | Wizard step change | `step`, `traveller_count`, `filled_count` |
| `visa_basic_info_complete` | Basic info continue | `traveller_count` |
| `visa_traveller_complete` | Traveller form finished | `document_slot_count` |
| `visa_review_proceed_checkout` | Review → pay | `filled_count`, `total_travellers` |
| `visa_passport_scan_complete` | OCR success | `confidence`, `warnings_count` |
| `visa_passport_scan_failed` | OCR fail / India-gate | `error_code` |
| `visa_document_upload_success` | Doc saved to IDB | `slot_key`, `storage`, `mime_type` |
| `visa_document_upload_error` | Doc save fail | `slot_key`, `error_message` |
| `begin_checkout` | Quote loaded on pay step | `value`, `currency`, `traveller_count`, `items` |
| `visa_payment_order_created` | Checkout order created | `kind`, `amount` |
| `visa_payment_failed` | Razorpay failure | `error_description`, `submit_id` |
| `visa_payment_dismissed` | Razorpay modal closed | `submit_id` |
| `purchase` | Application submitted | `transaction_id`, `value`, `currency`, `items`, `traveller_count` |
| `visa_application_submitted` | Same conversion (custom) | `application_id`, `listing_id`, `free` |
| `auth_otp_requested` | OTP SMS requested | `context` |
| `login` | Phone OTP success | `method`, `context` |
| `login_failed` | Phone OTP fail | `error_code`, `context` |
| `visa_submission_confirmation_view` | Dashboard `?submitted=` | `application_id` |
| `visa_correction_started` | Fix flow opened | `application_id`, `item_count` |
| `visa_correction_submitted` | Correction sent | `fields_changed_count`, `files_count` |

## Policy

- No PII in payloads (no name, phone, email, passport numbers).
- Skip `/admin/*`, `/login`, `/register`.
- Primary conversion: `purchase` (+ optional `visa_application_submitted`).

## Code entry points

- Helpers: `lib/analytics/gtm.ts`, `lib/analytics/events.ts`
- SPA page views: `components/analytics/GtmRouteListener.tsx`
- GTM bootstrap: `app/layout.tsx` (`NEXT_PUBLIC_GTM_ID`)

---

**Tags**: #analytics #gtm #ga4
