# SEO Metadata

Canonical public SEO for Viserv (`www.viserv.in`).

## Source of truth

| Module | Role |
|--------|------|
| `lib/seo/site.ts` | Brand name, default title/description, keywords, OG image, social `sameAs` |
| `lib/seo/pages.ts` | Unique title/description/keywords per static public route |
| `lib/seo/metadata.ts` | `buildPageMetadata()` + `NOINDEX_METADATA` |
| `lib/seo/jsonld.ts` | Organization, WebSite, WebPage, Service, FAQ, HowTo, CollectionPage/ItemList, BlogPosting, breadcrumbs |
| `lib/seo/howItWorksSteps.ts` | Shared 4-step copy for home, `/how-it-works`, HowTo schema |
| `lib/seo/siteFaqs.ts` | Sitewide FAQs for home + how-it-works |
| `lib/seo/countryHubFaqs.ts` | Generated FAQs + hub path helper for `/visa/{cc}` |
| `lib/seo/listingKeyFacts.ts` | Plain key facts for listing UI + Service `additionalProperty` |
| `lib/seo/llmsTxt.ts` | Generator for `/llms.txt` citation map |
| `app/sitemap.ts` | Indexable URLs (static + country hubs + visa listings + blogs); ISR 1h + purged on catalog/blog revalidate |
| `app/robots.ts` | Allow marketing + explicit AI bots; disallow admin/API/auth/apply |
| `app/llms.txt/route.ts` | AEO/GEO preferred-sources file |
| `lib/seo/legacyVisaListingRedirects.ts` | 301 map for retired/renamed listing slugs (wired in `next.config.ts`) |

## Rules

1. **One title brand suffix** — Root layout uses `title.template: "%s | Viserv"`. Page titles omit the brand. Home uses `absolute`.
2. **Unique descriptions** — Every indexable route has distinct copy in `SEO_PAGES` or listing/blog generators.
3. **Canonical** — Set via `alternates.canonical` on each public page (www `NEXT_PUBLIC_APP_URL=https://www.viserv.in`). Apex `viserv.in` 301s to www via Caddy.
4. **OG / Twitter** — Always include an image (`DEFAULT_OG_IMAGE` or page-specific).
5. **H1** — One H1 per public page (visible or `sr-only` when the hero is interactive-only).
6. **Noindex** — Auth, dashboard, and admin layouts export `NOINDEX_METADATA`. Apply funnels also set `robots: noindex`.
7. **Social** — Footer + Organization `sameAs` both read `SOCIAL_PROFILES` from `site.ts`.

## Indexable routes

- `/`, `/how-it-works`, `/passport`, `/blogs`, `/blogs/[slug]`
- `/visa/[country]` (country hub)
- `/visa/[country]/[listing]` (per listing)
- `/privacy`, `/terms`, `/refund`
- Discovery: `/sitemap.xml`, `/robots.txt`, `/llms.txt`

## Not indexed

- `/admin/*`, `/dashboard/*`, `/signin`, `/register`, `/*/apply`, most `/api/*` (except `/api/media`)

## Country vs listing SEO

- Country `seo.metaTitle` / `seo.metaDescription` / `headline` apply on **`/visa/{cc}` hubs only**.
- Listing pages always use listing-specific titles/descriptions (no country meta override).
- Empty listing FAQs fall back to `getDemoFaqs()` so FAQPage schema still ships.

## AEO / GEO (AI answer engines)

Goal: be **citable** in ChatGPT, Perplexity, Google AI Overviews — not keyword stuffing.

| Layer | Implementation |
|-------|----------------|
| Crawl policy | `robots.ts` allows `*` plus explicit GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, CCBot with the same public allow/disallow |
| Citation map | `/llms.txt` lists purpose, contact, hubs, listings; rebuilt from catalog; purged via `revalidatePath('/llms.txt')` |
| HowTo | Home + `/how-it-works` emit HowTo JSON-LD from shared steps |
| Hub FAQs | Sitewide FAQs on home/how-it-works; generated FAQs on country hubs |
| Answer facts | Listing **Key facts** strip (price, ETA, validity/stay, docs, audience) + Service `additionalProperty` |
| FAQ text | `buildFaqPageJsonLd` strips HTML/markdown noise for quotable answers |

## Listing slugs

- Canonical form: **lowercase** hyphenated words (`australia-tourism-visa`).
- Admin URL slug field + Zod `normalizeVisaListingSlug` force lowercase on type/save.
- `proxy.ts` 301s any mixed-case `/visa/{country}/{slug}` **and** `/visa/{country}` hub to lowercase.
- Migration `0051_visa_listing_slug_lowercase` lowercases existing rows.

## Listing slug moves

When a public listing slug is renamed or a listing is removed, add a row in `lib/seo/legacyVisaListingRedirects.ts` (source → current canonical). Admin Basic Info updates also call `revalidatePath('/sitemap.xml')` and `revalidatePath('/llms.txt')` via `revalidatePublicVisaCatalog`, so crawlers stop seeing stale listing URLs.

**Last updated**: 2026-11-26
