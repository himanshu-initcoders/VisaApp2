# Stitch AI Prompt — Visa & Passport Application Platform

Copy everything below into Stitch AI as your project brief.

---

## 1. PROJECT SUMMARY

Design a modern, trust-first web platform for applying to tourist visas, e-visas, and digital arrival cards (like Thailand's TDAC, Dubai/UAE visa, Malaysia MDAC, Sri Lanka ETA) for Indian travelers. The product should feel like a premium fintech/travel hybrid — as trustworthy as a banking app, as fast and delightful as a modern consumer app. Benchmark: Atlys (atlys.com) — match its information architecture but exceed it in visual polish, motion design, pricing clarity, and perceived speed. Do not clone its look; create a distinct visual identity that feels more premium, calmer, and more confident.

**Core user goal:** land on a country-specific visa/arrival-card page from an ad or search, understand price + timeline + requirements in under 10 seconds, and start an application with minimal friction.

---

## 2. INFORMATION ARCHITECTURE (pages/screens to design)

1. **Homepage** — country/destination search + popular visas grid
2. **Country/Product Landing Page** — two variants:
   - Free instant arrival card (e.g., Thailand TDAC) — simple, no payment
   - Paid visa (e.g., Dubai/UAE) — pricing, government relations, guarantee
3. **Application Flow** — multi-step form (traveler details → passport upload → flight/hotel details → photo upload → review → payment/submit)
4. **Application Status / Dashboard** — real-time tracking timeline for submitted applications
5. **FAQ / Help Center** (can be a modal/drawer pattern instead of full page)
6. **Footer** shared across all pages

Design all of these as connected screens in one Stitch project so the design system stays consistent.

---

## 3. DESIGN SYSTEM

**Tone:** confident, calm, official-but-friendly. Avoid neon/gimmicky travel-brand clichés. Think "Linear meets Wise meets a boutique travel concierge."

- **Color palette:** a deep ink/navy (#0B1220-ish) as the primary dark tone for hero sections and premium banners, a single confident accent color (pick one — emerald green or a warm coral/amber — not both) for CTAs and success states, a neutral warm-gray scale for backgrounds/cards, and a soft off-white (not pure white) for page background to reduce glare.
- **Typography:** pair a refined serif or high-contrast display serif for large headlines (evokes "official document" trust, similar to what Atlys does with its serif headline treatment) with a clean geometric sans-serif for body/UI text. Establish a clear type scale: Display (48–64px), H1 (36px), H2 (28px), H3 (20px), Body (16px), Caption (13px).
- **Spacing/grid:** 8px base unit, generous whitespace, 12-column responsive grid, max content width ~1200px, section vertical rhythm of 96–120px on desktop.
- **Corner radius:** consistent — 16px for cards, 12px for buttons/inputs, full-round for pills/badges.
- **Elevation:** soft, warm-toned shadows (not harsh gray) — cards should feel like they're resting on the page, not stuck to it.
- **Iconography:** single consistent icon set (rounded line icons, 1.5px stroke), never mix filled and outline styles.
- **Imagery:** full-bleed destination photography with a subtle dark gradient overlay in heroes; avoid stock-photo staginess — treat images as editorial/documentary.

---

## 4. SECTION-BY-SECTION SPEC (with explicit upgrades over the reference screenshots)

### 4.1 Header
- Logo left, primary nav center-left (Destinations, How it works, Track application), search field, and a persistent trust badge ("Approvals guaranteed on time" or similar) that stays visible but doesn't compete with the logo.
- On scroll, header compresses to a slim sticky bar with the CTA button always visible.

### 4.2 Hero (country landing page)
- Full-bleed destination image with a cinematic gradient (darker at bottom for text legibility, lighter at top).
- Eyebrow/kicker line ("Official Thailand Digital Arrival Card"), then a two-line headline where the second line is the key differentiator in the accent color ("free and instant" / "in exactly 2 days").
- Three stat pills below the headline (Validity / Purpose / Max stay or Entry type) — style them as subtle glass/blur pill chips, not plain text columns, so they read as data at a glance.
- Primary CTA button: high-contrast, slightly larger than typical, with a subtle animated icon (arrow slides right on hover).
- **Upgrade over reference:** add a small live-activity microcopy under the CTA (e.g., "1,204 travelers applied this week") to build momentum/social proof immediately — the reference screenshots don't do this.

### 4.3 Sticky sub-navigation tabs
- Tabs: Overview/Info, Requirements/Documents, Process, Reviews (paid visas only), FAQs.
- Underline indicator that slides smoothly between tabs (spring easing, ~250ms).
- Becomes sticky under the header once the hero scrolls out, with a subtle shadow appearing only when stuck.

### 4.4 Trust/partner strip
- Thin horizontal strip: "Trusted by leading travel brands" + grayscale partner logos that gain color on hover.
- Keep it understated — single row, no card container, just logos on the page background.

### 4.5 Product overview block
- Left: headline + 2–3 sentence plain-English explanation of what this document/visa is and who needs it.
- Right: a **redesigned product visual** — instead of a flat mock "card" graphic, show a subtle 3D/parallax tilt card (passport-card style) that gently reacts to cursor movement on desktop, with a "100% Free" or price badge pinned to a corner.
- Below: 3 stat cards (Price, Processing time, Max stay) with icon, label, and value — hover state lifts the card slightly with a soft shadow bloom.

### 4.6 Requirements section ("Required to apply")
- Grid of icon cards (Passport, Flight details, Hotel details, Photo, etc.) — each card should be interactive: on hover, reveal a one-line micro-explanation ("Must be valid 6+ months") that isn't visible by default. This keeps the grid clean while still being informative — an upgrade on the reference, which shows static labels only.
- Include a small checklist-style progress indicator style even at this stage ("2 of 3 ready") if the user has an account/session — optional smart personalization.

### 4.7 Pricing panel (paid-visa pages like Dubai)
- Redesign the reference's pricing card into a clearer visual hierarchy: government fee and platform fee should be visually distinguished (e.g., government fee in neutral text, platform fee in a subtly highlighted row), with the total in large bold type and a one-line reassurance ("No hidden charges — pay government fee now, service fee only on approval").
- Traveler count stepper should have a satisfying tactile feel — number rolls/counts up or down with a small animation when incremented.
- Sticky/floating on scroll on desktop (becomes a condensed price bar) so the CTA and price are always visible while the user reads further down the page — this is a meaningful UX upgrade over the reference, which loses the price context once you scroll past it.

### 4.8 Countdown/urgency banner
- Dark full-width banner: "Get your visa by [date, time]" with a live countdown or clock icon.
- Keep copy honest and non-manipulative — no fake urgency, just a genuine ETA commitment. Add a subtle pulsing dot next to "on time" to signal it's a live/real commitment, not decorative.

### 4.9 Process timeline ("The visa process")
- Replace the reference's illustrated winding "road" graphic with a **cleaner, more modern animated stepper**: 4–5 steps laid out as a horizontal (desktop) / vertical (mobile) connected timeline with numbered nodes. As the user scrolls this section into view, each node should sequentially animate in (fade + slight rise) with the connecting line "drawing" itself between nodes (SVG stroke-dashoffset animation). This reads as significantly more premium and "alive" than a static illustration.
- Each step: icon, short title, one-line description.

### 4.10 Comparison table ("Atlys vs Others")
- Keep the two-column comparison concept but redesign as a card-based table with clear ✓ (accent color, filled circle) vs ✕ (muted gray, outline) — avoid literal red X icons, which feel harsh; use a neutral "—" or soft gray X instead so the competitor isn't unnecessarily vilified.
- Highlight the "our platform" column with a very subtle background tint and a slightly raised card, no heavy borders.

### 4.11 Guarantee banner
- Full-width dark section, large centered statement ("Not on time? You don't pay a cent.") with the guarantee phrase in the accent color. Add a small shield/check icon above the headline for reassurance without looking like a legal disclaimer.

### 4.12 Reviews / social proof
- Aggregate rating headline (e.g., "4.6 rating across platforms") with platform logo tabs (Trustpilot/App Store/Google Play) that filter the carousel below.
- Redesign review cards to feel more human: reviewer initials in a soft colored avatar circle (if no photo), star rating, relative date, review excerpt with a "read more" that expands inline rather than navigating away.
- Carousel should support touch/drag on desktop too (not just arrow buttons), with momentum-based easing.

### 4.13 Government relations / trust section
- Photo grid of officials/partnerships plus a row of government/partner seals.
- **Upgrade:** add a one-line caption under each photo explaining the relationship, since in the reference this section reads as decorative without context.

### 4.14 FAQ accordion
- Single-open accordion (opening one closes the previous) with a smooth height-animated expand/collapse (200–250ms ease), plus-to-cross icon rotation on toggle.
- Add a small search/filter input at the top of the FAQ list for pages with 12+ questions (both reference pages have long FAQ lists that currently require manual scanning).

### 4.15 "Explore more" rail
- Horizontal scroll-snap card rail of other destinations, each with flag, name, processing badge ("Instant" / "Within 24 Hours") in a colored pill.
- Add subtle edge-fade gradients on both sides to signal scrollability, and momentum/snap scrolling.

### 4.16 Footer
- Multi-column (Company, Products, Offices, Legal), app store badges, social proof mark ("20K+ reviews"), copyright.
- Keep visually quiet — dark or muted background, smaller type, clear separation from the vibrant page above.

---

## 5. APPLICATION FLOW (new — not fully shown in reference screenshots, but essential)

Design a clean multi-step form experience:
- Persistent top progress bar (steps: Traveler Info → Documents → Flight/Hotel → Photo → Review & Pay).
- One focused question/group per screen, large touch targets, autosave indication ("Saved" microcopy with a checkmark fade-in).
- Passport/photo upload steps should show a live preview thumbnail with a subtle scan-line or checkmark animation on successful upload to reinforce "your document was received correctly."
- Final review screen: clear summary card + total price breakdown before payment, matching the pricing panel style from the landing page for consistency.

---

## 6. MOTION & MICROINTERACTION PRINCIPLES

- Use easing curves that feel physical (ease-out for entrances, spring for toggles/tabs), never linear.
- Section reveal-on-scroll: fade + 12–16px rise, staggered by ~60ms per child element, triggered once per section (not on every scroll pass).
- Buttons: subtle scale-down (0.97) on press, color/shadow shift on hover, never abrupt color snaps.
- Numbers (price, countdowns, stats) should animate/count up when they first enter view.
- Loading/processing states (e.g., "checking documents") should use a tasteful skeleton or progress shimmer, never a generic spinner alone.
- Respect `prefers-reduced-motion` — provide a reduced-motion fallback (opacity-only transitions).

---

## 7. UX IMPROVEMENTS OVER THE REFERENCE SITE (explicitly design for these)

1. Sticky/condensed pricing bar while scrolling on paid-visa pages (reference loses price context after the hero).
2. Hover-reveal micro-explanations on requirement icons instead of static unexplained labels.
3. Animated, self-drawing process timeline instead of a static illustrated road graphic.
4. Searchable FAQ for long question lists.
5. Honest, non-manipulative urgency messaging (live ETA, not fake scarcity).
6. Clear application progress/autosave feedback during the multi-step form (not shown at all in the reference screenshots).
7. Softer, less adversarial comparison-table styling (no harsh red X against competitors).

---

## 8. RESPONSIVE & ACCESSIBILITY

- Design mobile-first breakpoints (mobile, tablet, desktop). On mobile, stat pills wrap to a horizontal scroll row, the process timeline goes vertical, and the pricing panel becomes a bottom sheet that can expand.
- Maintain WCAG AA contrast, especially for text over hero imagery (use gradient overlays generously).
- All interactive elements need visible focus states, not just hover states.

---

## 9. DELIVERABLES TO GENERATE IN STITCH

- Homepage
- Country landing page — free arrival card variant (Thailand-style)
- Country landing page — paid visa variant (Dubai-style)
- Application flow (5 steps)
- Application status/tracking screen
- Component library screen: buttons, cards, pills, accordion, tabs, form inputs, pricing card, timeline step, review card — all states (default/hover/active/disabled)

Generate desktop and mobile versions of each screen.