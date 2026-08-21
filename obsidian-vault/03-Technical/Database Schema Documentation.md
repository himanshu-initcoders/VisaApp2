# Database Schema Documentation

**Date**: 2026-08-20  
**Status**: Live schema (post multi-price options)  
**ORM**: Drizzle ORM  
**Database**: PostgreSQL

---

## Overview

Our database schema supports visa and passport products for Indian travelers:

- Multiple visa process types (eTA, physical AFC, e-visa, appointment)
- Multiple price packages per listing (validity + stay + three INR fees)
- Multi-country visas
- Dynamic form fields (country-specific questions)
- Document validation (OCR + photo compliance)
- Indian documents (Aadhaar, PAN, ITR support)

**2026-08-20 change:** `entry_processes` was renamed to `visa_listings`. The legacy JSON CMS `visa_listings` table and `/admin/visas` were removed. The `service_fees` breakdown table was dropped. Competitor JSON importer (`atlysImporter`) was deleted.

**Later 2026-08-20:** Default/express `process_tiers` replaced by `visa_listing_prices`. Fees, entry validity, and stay duration moved off `visa_listings` onto each price option. Listing-level `standard_eta_*` remains on Basic Info.

---

## Schema Files

### 1. `schema.ts` (User & Application Data)
- `users`
- `visaApplications` (`visaListingId` FK)
- `passportServices`
- `documents`
- `payments` (INR)
- `statusHistory`

### 2. `schema-extended.ts` (Country & Listing Config)
- `countries`
- `visaListings` — metadata + listing-level ETA only (`standard_eta_*`)
- `visaListingPrices` — validity, stay, government / service / GST fees (INR), `sort_order`
- `multiTripCountries`
- `visaRisks`
- `additionalQuestions`
- `componentsRequired` (chargeable amounts INR)
- `occupationTypes`
- `passportOcrSettings`
- `photoValidationSettings`
- `faqs`
- `postCheckoutSteps`

Child tables use `visa_listing_id` (not `entry_process_id`).

---

## Fee model (INR only)

On `visa_listing_prices` (many per listing):
- `entry_validity_amount` / `entry_validity_unit`
- `entry_length_stay_amount` / `entry_length_stay_unit`
- `government_fee_amount`
- `service_fee_amount`
- `government_gst_fee_amount`
- `sort_order` — first option drives landing “from” price and days label

ETA stays on `visa_listings` (`standard_eta_duration` / `standard_eta_unit`).

Admin manages packages under Pricing (`/admin/config/visa-listings/[id]/tiers`). Public landing shows first package as e.g. `₹12,000 · 30 days`. Detail `PricingPanel` lists all options with fee breakdown for the selected package.

---

## Admin / public routes

- Countries: `/admin/config/countries`
- Visa listings: `/admin/config/visa-listings`
- Public product page: `/visa/[countryCode]/[listingId]`

---

## Historical note

Older daily notes and competitor-analysis docs may still say `entry_processes`, Atlys importer, or Standard/Express tiers. Those describe research history; the live product schema is above.
