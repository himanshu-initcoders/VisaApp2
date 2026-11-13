# 🔧 Features Roadmap

← Back to [[🏠 Home]]

## Phase 0 - Project Setup ✅ COMPLETE

### Knowledge Base
- [x] Obsidian vault with 20+ interconnected notes
- [x] Design system documentation (Portrait)
- [x] User personas (6 detailed personas)
- [x] User flows (visa, passport, payment, tracking)
- [x] Competitor analysis framework (Atlys)
- [x] Security & compliance requirements
- [x] Technical stack documentation

### AI Context
- [x] CLAUDE.md - Complete project context
- [x] AI_AGENT.md - Detailed workflow instructions
- [x] Development checklists
- [x] Decision frameworks
- [x] Daily logging templates

### Next.js 16 Setup
- [x] Project initialized with App Router
- [x] TypeScript configured
- [x] Tailwind CSS with Portrait design system
- [x] Drizzle ORM with PostgreSQL
- [x] NextAuth.js v5 (beta) installed
- [x] AWS S3 SDK for file uploads
- [x] Form validation (Zod + React Hook Form)
- [x] Environment variables template
- [x] Comprehensive README

### Database Schema
- [x] Users table
- [x] Visa Applications table
- [x] Visa public `reference_number` (`VI` + 12 digits) for URLs, WhatsApp, admin filter
- [x] Passport Services table
- [x] Documents table
- [x] Payments table
- [x] Status History table

### UI Components
- [x] Button (primary, ghost variants)
- [x] Card (default, elevated variants)
- [x] Input (with label, error, helper text)
- [x] AnimatedTabs (Framer Motion sliding pill)
- [x] Utility functions (cn)

---

## MVP (Phase 1) 🚧 IN PROGRESS

### Core Authentication ✅ READY FOR TESTING
- [x] User registration (with validation)
- [x] Password strength indicator
- [x] Login/Logout with NextAuth v5
- [x] Protected routes (middleware)
- [x] Dashboard with user welcome
- [x] Session management (JWT)
- [ ] Email verification (TODO: send email)
- [ ] Password reset flow
- [ ] Profile management page

### Visa Application
- [x] Public listing page with travellers counter + pricing scale
- [x] Departure date modal (Fixed Dates / Flexible month)
- [x] Apply flow shell: Basic Information → Review → Checkout (no site navbar)
- [x] Apply step 1: name card, previous-profile carousel, in-field Next
- [x] Apply step 2: traveller profiles, passport-first fill, accordion review
- [x] Passport capture + Indian MRZ/OCR review (client-side)
- [x] Passport OCR hardened against real upload layouts (extra pages, rotations, visa pages, PIN-as-MRZ) — see [[Passport OCR]]
- [x] After passport scan, application form uses AnimatedTabs: General details / Trip details / Documents / Review & submit
- [x] Traveller form tab Continue flushes local draft + quiet server `application_drafts` sync (signed-in only; no login interrupt)
- [ ] **Submission finish line** — see [[📋 Upcoming Tasks Hub]]
  - [x] [[Phase 1 - Document Upload Module]] — IndexDB immediate; cloud key builder + submit helper ready
  - [x] [[Phase 2 - Mobile OTP Applicant Login]] — phone OTP; checkout lock until login
  - [ ] [[Phase 3 - Application Storage & Admin Inbox]] — mock pay = submit; form versions; admin filters/CSV/detail
- [ ] Real payment gateway (after mock pay)
- [ ] Form validation (client + server)

### Passport Services
- [x] India-only catalog: Fresh + Re-issue (`passport_listings` + admin hub)
- [x] Pricing matrix (Normal/Tatkaal × 36/60 pages) + public hero card from DB
- [x] Documents from shared document-types catalog + FAQs per product
- [x] Form builder with admin-defined steps/tabs + publish `passport_form_versions`
- [x] In-app apply wizard (`/passport/{fresh|reissue}/apply`) — steps → documents → review → pay/submit
- [x] Email/WhatsApp notifications on passport submit
- [ ] Staff draft-on-behalf for passport (parity with visa)

### Application Management
- [x] Dashboard with all applications (`/applications` list)
- [x] Application detail view-only (visa + passport; mirrors admin UI, no admin actions)
- [x] Application status tracking (customer-facing status history)
- [x] Document library with auto passenger profiles (`/documents`)
- [ ] Status notifications (email)

### Payments
- [x] Pricing calculation (server-side quote from listing prices)
- [x] Payment gateway integration (Razorpay Checkout + dual confirmation)
- [x] Webhook Phase 1: `payment.captured` / `payment.failed` / `order.paid` (money only; browser submits app)
- [x] Refunds: Payments-tab dialog (amount + reason) → `proceed` row → Razorpay → `refund.processed` / `refund.failed` webhook (status reject is status-only)
- [ ] Receipt generation
- [x] Payment history

### Admin Panel (Basic)
- [ ] View all applications
- [ ] Update application status
- [ ] Document verification
- [ ] User management
- [x] Add Country (admin config create flow)
- [x] Add Visa listing (admin config create flow)
- [x] Passport listings admin (basic, pricing, forms/steps, docs, FAQs)
- [x] Visa listing public URL slug (basic info, SEO paths)
- [x] Admin blogs (TinyMCE) under Configuration + public `/blog` SEO

---

## Phase 2 - Enhanced Features

### User Experience
- [ ] Application auto-save
- [ ] Smart form pre-fill
- [ ] Photo validation (AI-powered)
- [ ] Document quality checker
- [ ] Progress indicators

### Communication
- [ ] In-app notifications
- [ ] SMS notifications
- [ ] Real-time chat support
- [ ] Email templates

### Advanced Admin
- [ ] Application workflow automation
- [ ] Document verification tools
- [x] GTM / GA4 funnel event tracking (client dataLayer; GA tags configured in GTM)
- [x] JSON-LD structured data (Organization, WebSite, WebPage, Breadcrumb, Service, FAQ, BlogPosting)
- [x] Sitemap (`/sitemap.xml`) + robots (`/robots.txt`)
- [x] Blog index + post pages in sitemap, footer, header, `view_blog_post` analytics
- [ ] Analytics dashboard
- [ ] Reporting system

---

## Phase 3 - Advanced Features

### Intelligence
- [ ] AI-powered form assistance
- [ ] Visa eligibility checker
- [ ] Processing time predictions
- [ ] Success rate indicators

### Mobile
- [ ] Responsive design optimization
- [ ] PWA implementation
- [ ] Native mobile app (iOS/Android)

### Integrations
- [ ] Government portal integrations
- [ ] Third-party verification services
- [ ] CRM integration
- [ ] Accounting software integration

### Localization
- [ ] Multi-language support
- [ ] Regional payment methods
- [ ] Local currency support

### Visa correction loop
- [x] Staff can request specific document reuploads and field fixes, with a comment on each item
- [x] Applicant dashboard alert and email, then the same apply form with only those items enabled
- [x] Two-way conversation, in-app notifications, and email on comments, resubmits, and status changes
- [x] Passport services reuse the same correction tables (polymorphic `application_type`, nullable traveller)

### Passport ops parity (submitted apps)
- [x] Admin detail tabs: payments, call logs, notes, corrections, conversation
- [x] Reviewer assignment on `passport_services.assigned_reviewer_id` + reviewer-scoped list/detail
- [x] Request changes / action required + applicant `/applications/passport/[id]/fix`
- [x] Refunds via `initiatePassportRefund`

### Approved visa delivery documents
- [x] Optional per-traveller `visa_outcome` upload on approve (passenger-scoped storage path)
- [x] Post-approve attach modal for already-approved travellers
- [x] Optional send PDF on WhatsApp + email; skip plain applicant status WhatsApp when media send runs
- [x] Applicant detail card, sidebar label, and list “Document ready” hint
- [ ] Meta-approve `viserv_status_approved_with_document` and set `TWILIO_WA_SID_STATUS_APPROVED_WITH_DOCUMENT`

---

## Feature Details

### Application Flow
See: [[📊 User Flows#Visa Application|Visa Application Flow]]

### Document Requirements
See: [[📋 Document Requirements]] (to be created)

### Pricing Structure
See: [[💰 Pricing Model]] (to be created)

---

## Technical Considerations

Each feature must:
- Follow [[🎨 Design System Hub|Portrait design system]]
- Implement proper [[⚙️ Technical Stack#Form Handling|form validation]]
- Include [[⚙️ Technical Stack#Error Handling|error handling]]
- Be built with [[⚙️ Technical Stack#Component Architecture|reusable components]]
- Create [[⚙️ Technical Stack#Migration Workflow|database migrations]]

---

## Related Notes
- [[📋 Project Overview]]
- [[⚙️ Technical Stack]]
- [[🏆 Competitor Analysis]]
- [[👤 User Personas]]

---

**Tags**: #roadmap #features #planning #mvp #development
