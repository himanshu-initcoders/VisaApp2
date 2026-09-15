# Feature: Add Country and Add Visa (Admin Config)

**Status**: Completed  
**Priority**: High  
**Estimated Effort**: 0.5 days  

---

## Overview

Admins can create destination countries and visa listings from the config UI instead of relying on manual SQL or deleted seed importers. Add Visa is a three-step wizard: basic info, pricing packages, then document requirements.

---

## User Stories

- As an admin, I want to add a destination country so I can offer visas for that country.
- As an admin, I want to add a visa listing for a country so I can configure prices, forms, and content.

---

## Requirements

### Functional
- [x] Add Country page with name, ISO2, enabled/supported
- [x] Reject duplicate ISO2 codes
- [x] Add Visa multi-step wizard: basic info → pricing → documents
- [x] Reject listings for unknown destination countries
- [x] Persist wizard progress via `?id=` + `?step=` URL params
- [x] Redirect to visa hub on Finish
- [x] Header + empty-state CTAs on list pages
- [x] Preselect country when opening Add Visa from `?country=`

### Non-Functional
- [x] Admin role required on pages and server actions
- [x] Zod validation client + server
- [x] Portrait form patterns (RHF + Input/Select/Checkbox/Button)

---

## Technical Implementation

### Database Changes
None — used existing `countries` and `visa_listings` tables.

### Server Actions
- `createCountry` in `app/(admin)/admin/config/countries/actions.ts`
- `createVisaListing` in `app/(admin)/admin/config/visa-listings/actions.ts`

### Routes
- `/admin/config/countries/new`
- `/admin/config/visa-listings/new`

### Components
- `CreateCountryForm.tsx`
- `CreateVisaListingWizard.tsx` (steps: basic / pricing / documents)
- Reuses `PriceOptionsManager` and `ComponentsManager`
- `ConfigEmptyState.tsx`

---

## Related Notes
- [[🔧 Features Roadmap]]
- [[⚙️ Technical Stack]]
- Form Builder questions use hardcoded categories from `lib/question-categories.ts` (`additional_questions.category`) and group fields on the apply Trip details tab
- Form Builder visibility: optional show-if equals rule stored in `additional_questions.visibility`

---

**Tags**: #feature #admin #config
