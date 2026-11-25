# SEO Metadata

Canonical public SEO for Viserv (`viserv.in`).

## Source of truth

| Module | Role |
|--------|------|
| `lib/seo/site.ts` | Brand name, default title/description, keywords, OG image, social `sameAs` |
| `lib/seo/pages.ts` | Unique title/description/keywords per static public route |
| `lib/seo/metadata.ts` | `buildPageMetadata()` + `NOINDEX_METADATA` |
| `lib/seo/jsonld.ts` | Organization, WebSite, WebPage, Service, FAQ, BlogPosting, breadcrumbs |
| `app/sitemap.ts` | Indexable URLs (static + visa listings + blogs); ISR 1h + purged on catalog/blog revalidate |
| `app/robots.ts` | Allow marketing; disallow admin/API/auth/apply |
| `lib/seo/legacyVisaListingRedirects.ts` | 301 map for retired/renamed listing slugs (wired in `next.config.ts`) |

## Rules

1. **One title brand suffix** — Root layout uses `title.template: "%s | Viserv"`. Page titles omit the brand. Home uses `absolute`.
2. **Unique descriptions** — Every indexable route has distinct copy in `SEO_PAGES` or listing/blog generators.
3. **Canonical** — Set via `alternates.canonical` on each public page (apex `NEXT_PUBLIC_APP_URL`).
4. **OG / Twitter** — Always include an image (`DEFAULT_OG_IMAGE` or page-specific).
5. **H1** — One H1 per public page (visible or `sr-only` when the hero is interactive-only).
6. **Noindex** — Auth, dashboard, and admin layouts export `NOINDEX_METADATA`. Apply funnels also set `robots: noindex`.
7. **Social** — Footer + Organization `sameAs` both read `SOCIAL_PROFILES` from `site.ts`.

## Indexable routes

- `/`, `/how-it-works`, `/passport`, `/blogs`, `/blogs/[slug]`
- `/visa/[country]/[listing]` (per listing)
- `/privacy`, `/terms`, `/refund`

## Not indexed

- `/admin/*`, `/dashboard/*`, `/signin`, `/register`, `/*/apply`, most `/api/*` (except `/api/media`)

## Listing SEO overrides

Country `seo.metaTitle` / `seo.metaDescription` (admin) override the generated listing title/description when set.

## Listing slug moves

When a public listing slug is renamed or a listing is removed, add a row in `lib/seo/legacyVisaListingRedirects.ts` (source → current canonical). Admin Basic Info updates also call `revalidatePath('/sitemap.xml')` via `revalidatePublicVisaCatalog`, so crawlers stop seeing stale listing URLs.

**Last updated**: 2026-11-25
