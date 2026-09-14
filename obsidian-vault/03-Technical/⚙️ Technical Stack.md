# ⚙️ Technical Stack

← Back to [[🏠 Home]]

## Overview
Full-stack Next.js 16 application with PostgreSQL database, built for visa and passport service management.

Passport upload on apply is read client-side (Tesseract.js + pdf.js). Layout handling and the sample-corpus harness live in [[Passport OCR]].

---

## Frontend

### Next.js 16
- **Type**: Full-stack React framework
- **Rendering**: App Router with Server Components
- **Features**:
  - File-based routing
  - Server actions
  - API routes
  - Streaming SSR

### Tailwind CSS
**Implementation of [[🎨 Design System Hub|Portrait Design System]]**

**Config Requirements**:
```js
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // See [[🎨 Colors]]
        'portrait-ink': '#08304c',
        'nautical-teal': '#084e72',
        // ... full palette
      },
      fontFamily: {
        switzer: ['Switzer', 'Inter', 'sans-serif'],
        basier: ['Basier Circle', 'Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        'nav': '28px',
        'card': '24px',
        'button': '28px',
        'input': '16px',
        'tag': '9999px',
      },
    },
  },
}
```

---

## Backend

### Next.js 16 API Routes
- Server-side logic
- API endpoints
- Server actions for mutations

### PostgreSQL
- **Type**: Relational database
- **Hosting**: TBD (consider Vercel Postgres, Supabase, or Railway)
- **Features**:
  - ACID compliance
  - Complex queries for visa applications
  - User authentication data

### Drizzle ORM
**Why Drizzle**:
- Type-safe SQL queries
- Zero-cost abstractions
- Automatic migrations
- Better DX than Prisma for complex queries

**Core product tables** (see [[Database Schema Documentation]]):
- `countries` + `visa_listings` (renamed from `entry_processes`, 2026-08-20)
- Fees on listings are INR-only: government / service / government GST
- Admin: `/admin/config/visa-listings`

**Setup**:
```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

**Always create migration files** when modifying schema

---

## File Upload

### AWS S3
**Purpose**: Document storage for visa/passport applications

**Use cases**:
- Passport photos
- Identity documents
- Supporting documents
- Visa application attachments

**Implementation**:
```bash
npm install @aws-sdk/client-s3
npm install @aws-sdk/s3-request-presigner
```

---

## Component Architecture

### Reusable Components
**Required structure**:
```
/components
  /ui              # Base Portrait design system components
    Button.tsx
    Card.tsx
    Input.tsx
    Badge.tsx
  /forms           # Form components with validation
    VisaForm.tsx
    PassportForm.tsx
  /layout          # Layout components
    FloatingNav.tsx
    HeroSection.tsx
```

**Principles**:
- Every component follows [[🎨 Design System Hub|Portrait design system]]
- Proper TypeScript types
- Reusable and composable
- Accessible (ARIA labels, keyboard nav)

---

## Form Handling

### Validation
- **Library**: React Hook Form or Zod
- **Where**: Client-side + server-side validation
- **Rules**: Validate at form boundaries (user input, external APIs)

### Error Handling
- User-friendly error messages
- Form field-level errors
- Global error boundaries
- Toast notifications for async operations

---

## Authentication
**TBD** - Options:
1. NextAuth.js
2. Clerk
3. Auth0
4. Custom JWT implementation

Related: [[🔐 Security & Compliance]]

---

## Database Schema Planning

Key entities:
- Users
- Visa Applications
- Passport Services
- Documents
- Payments
- Application Status History

See: [[📊 Database Schema]] (to be created)

---

## Development Workflow

### Always Ask for Clarification
When instructions are unclear or need more context for better implementation, ALWAYS ask questions before proceeding.

### Migration Workflow
1. Update schema in `/db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Apply migration: `npm run db:migrate`
4. **Always commit migration files**

### Research-First Approach
Before implementing complex features, research best practices and current solutions.

---

## Related Notes
- [[🔧 Features Roadmap]]
- [[🎨 Design System Hub]]
- [[🔐 Security & Compliance]]
- [[📊 Database Schema]]

---

**Source**: `d:/Visa/RULES.md`

**Tags**: #technical #stack #nextjs #postgres #architecture
