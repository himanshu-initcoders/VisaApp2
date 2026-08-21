# AI Context - Visa & Passport Service Platform

> This file provides comprehensive context for AI assistants working on this project.

## Project Overview

**Name**: Visa & Passport Service Platform  
**Target Market**: Indian citizens only  
**Services**: Visa applications + Passport services (new, renewal, updates)  
**Primary Competitor**: [Atlys.com](https://www.atlys.com/en-IN)  
**Goal**: Better UI/UX than Atlys with warm, personal design

## Critical Rules - READ FIRST

### Tech Stack (Non-Negotiable)
- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS (implementing Portrait design system)
- **Authentication**: NextAuth.js
- **File Upload**: AWS S3
- **Frontend**: Next.js 16 with React Server Components
- **Backend**: Next.js 16 API routes + Server Actions

### Development Workflow

#### Before Writing Any Code
1. **Ask questions** if instructions are unclear
2. **Research best practices** - always look up current solutions
3. **Check design system** - verify component matches Portrait style
4. **Review user personas** - ensure feature fits user needs

#### When Writing Code
1. **Always create migration files** when changing DB schema
2. **Implement proper form validation** (client + server)
3. **Add error handling** at all boundaries
4. **Build reusable components** in `/components`
5. **Follow Portrait design system** exactly
6. **Never skip authentication checks**
7. **Never store sensitive data insecurely**

#### After Writing Code
1. **Update Obsidian knowledge base** - document decisions
2. **Log daily work** in `obsidian-vault/09-Daily-Notes/`
3. **Update feature status** in roadmap
4. **Create migration** if schema changed
5. **Test the feature** - don't just assume it works

### Knowledge Base Integration

#### Always Update These Files When:
- **Feature added** → Update `04-Features/🔧 Features Roadmap.md`
- **Design decision** → Update relevant `02-Design-System/` file
- **Technical change** → Update `03-Technical/⚙️ Technical Stack.md`
- **User insight** → Update `05-User-Research/` files
- **Competitor learning** → Update `06-Competitor-Analysis/🏆 Competitor Analysis.md`
- **Security change** → Update `01-Project-Overview/🔐 Security & Compliance.md`

#### Daily Logging (REQUIRED)
At the end of each work session, create/update daily note:
```bash
File: obsidian-vault/09-Daily-Notes/YYYY-MM-DD.md
Template: obsidian-vault/08-Templates/📅 Daily Note Template.md

Log:
- Tasks completed
- Decisions made
- Problems encountered
- Questions for next session
```

## Design System - Portrait

### Core Principles
1. **Warm & Personal** - scrapbook aesthetic, Polaroid-style cards
2. **Restrained Color** - Deep navy ink + single rainbow gradient
3. **Generous Rounding** - Cards 24px, Buttons 28px, Tags 9999px
4. **Soft Elevation** - Max 8% opacity, 3-6 layered shadows

### Key Colors
```css
Portrait Ink: #08304c (primary text, all structural lines)
Nautical Teal: #084e72 (secondary brand ink)
Rainbow Gradient: linear-gradient(90deg, rgb(38,192,255), rgb(230,0,194) 20%, ...)
White Canvas: #ffffff (page background)
Mint Wash: #d7ffe2 (pastel surface)
Sky Wash: #e8f1ff (pastel surface)
Peach Wash: #ffebd6 (pastel surface)
```

### Typography
- **Body/UI**: Switzer (10-24px) - use for buttons, nav, paragraphs
- **Headlines**: Basier Circle (31px+) - use for hero, large headings
- **Negative tracking** on headlines: -4.25px at 76px

### Component Rules
- **Primary CTA**: Rainbow outline button (1.5px gradient border, transparent fill)
- **Secondary actions**: Ghost text buttons (no background/border)
- **Cards**: 24px radius, 1px oklab outline, white background
- **Navigation**: Floating pill, 28px radius, soft shadow
- **Forms**: 16px radius inputs, clear validation messages

**Full Design Spec**: [DESIGN.md](./DESIGN.md)  
**Obsidian Docs**: `obsidian-vault/02-Design-System/`

## File Structure

```
/
├── app/                          # Next.js 16 App Router
│   ├── (auth)/                  # Auth routes group
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   ├── (dashboard)/             # Protected routes
│   │   ├── dashboard/
│   │   ├── applications/
│   │   └── layout.tsx
│   ├── api/                     # API routes
│   │   ├── auth/[...nextauth]/ # NextAuth
│   │   ├── visa/
│   │   ├── passport/
│   │   └── upload/
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Landing page
├── components/                   # React components
│   ├── ui/                      # Design system components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── forms/                   # Form components
│   ├── layout/                  # Layout components
│   └── shared/                  # Shared components
├── lib/                         # Utilities
│   ├── db/                      # Database
│   │   ├── schema.ts           # Drizzle schema
│   │   ├── migrations/         # Migration files
│   │   └── index.ts            # DB connection
│   ├── auth.ts                 # NextAuth config
│   ├── s3.ts                   # S3 utilities
│   ├── validations/            # Zod schemas
│   └── utils.ts                # Helper functions
├── public/                      # Static assets
├── obsidian-vault/             # Knowledge base
├── DESIGN.md                    # Design system spec
├── RULES.md                     # Development rules
├── CLAUDE.md                    # This file - AI context
└── AI_AGENT.md                 # Agent-specific instructions
```

## Database Schema (Core Entities)

### Users
- id, email, password_hash, name, phone
- created_at, updated_at
- email_verified, phone_verified

### VisaApplications
- id, user_id, country, visa_type, status
- personal_info (JSON), travel_info (JSON)
- documents (JSON array of S3 keys)
- payment_id, submitted_at, updated_at

### PassportServices
- id, user_id, service_type (NEW/RENEWAL/UPDATE)
- personal_info (JSON), address_info (JSON)
- documents (JSON array of S3 keys)
- appointment_date, status
- payment_id, submitted_at, updated_at

### Documents
- id, application_id, type, s3_key, filename
- verified, verification_notes
- uploaded_at

### Payments
- id, user_id, application_id, amount, status
- payment_method, transaction_id
- created_at, completed_at

**Always create migrations** when schema changes:
```bash
npm run db:generate  # Generate migration
npm run db:migrate   # Apply migration
```

## Security Requirements

### Authentication
- Use NextAuth.js with Credentials provider + email provider
- Hash passwords with bcrypt (12+ rounds)
- Implement email verification
- Session tokens in httpOnly cookies

### Authorization
- Check auth on ALL protected routes
- Implement RBAC (User, Admin, Reviewer)
- Users can only access their own data
- Admins need separate permission checks

### File Upload
- Validate file type (whitelist: jpg, jpeg, png, pdf)
- Limit file size (5MB for images, 10MB for PDFs)
- Generate unique S3 keys (UUID-based)
- Use presigned URLs with 1-hour expiry
- Never expose S3 keys to client

### Validation
- Validate ALL inputs (client + server)
- Use Zod schemas for type-safe validation
- Sanitize user inputs before display
- Parameterized queries only (Drizzle handles this)

### OWASP Protection
- ✅ SQL Injection: Drizzle parameterized queries
- ✅ XSS: React auto-escaping + CSP headers
- ✅ CSRF: Next.js built-in protection
- ⚠️ Broken Auth: Implement strong NextAuth config
- ⚠️ Sensitive Data: Encrypt at rest, HTTPS in transit
- ⚠️ Access Control: Implement proper RBAC

**Full Security Spec**: `obsidian-vault/01-Project-Overview/🔐 Security & Compliance.md`

## User Personas (Design For)

1. **Priya (First-Timer)** - Needs hand-holding, clear instructions
2. **Rajesh (Frequent)** - Values speed, wants auto-fill
3. **Meera (Family)** - Needs bulk application, simple UI
4. **Arjun (Student)** - Budget-conscious, deadline pressure

**Full Personas**: `obsidian-vault/05-User-Research/👤 User Personas.md`

## Common Patterns

### Form Validation Pattern
```typescript
// 1. Define Zod schema
const visaFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  // ...
});

// 2. Client-side validation (React Hook Form + Zod)
const form = useForm({
  resolver: zodResolver(visaFormSchema),
});

// 3. Server-side validation (Server Action)
export async function submitVisaApplication(data: unknown) {
  const parsed = visaFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }
  // Process valid data
}
```

### S3 Upload Pattern
```typescript
// 1. Client requests presigned URL
const { url, key } = await fetch('/api/upload/presign', {
  method: 'POST',
  body: JSON.stringify({ fileType: 'image/jpeg' }),
});

// 2. Client uploads directly to S3
await fetch(url, { method: 'PUT', body: file });

// 3. Client sends S3 key to server
await submitForm({ ...data, documentKey: key });
```

### Protected Route Pattern
```typescript
// app/(dashboard)/dashboard/page.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  
  // Render protected content
}
```

## Competitor: Atlys.com

**What to analyze**:
- User flow (how many steps to apply?)
- Form fields (what do they ask for?)
- UI patterns (how do they present info?)
- Pricing structure (how transparent?)
- Document upload UX
- Application tracking

**Our advantages**:
- Warmer, more personal design (Portrait vs their corporate look)
- Clearer user guidance
- Better document validation
- More transparent pricing
- Focus on Indian market specifically

**Analysis Doc**: `obsidian-vault/06-Competitor-Analysis/🏆 Competitor Analysis.md`

## Development Checklist

### For Every Feature
- [ ] Read user persona - who is this for?
- [ ] Check design system - what components to use?
- [ ] Define Zod schema for validation
- [ ] Build reusable UI components
- [ ] Implement client-side validation
- [ ] Implement server-side validation
- [ ] Add error handling
- [ ] Create/update DB schema if needed
- [ ] Generate migration if schema changed
- [ ] Test happy path
- [ ] Test error cases
- [ ] Update Obsidian knowledge base
- [ ] Log work in daily note

### Before Pushing Code
- [ ] No console.logs left
- [ ] No TODO comments (create proper tasks)
- [ ] No sensitive data in code
- [ ] Migration files included
- [ ] Components follow Portrait design
- [ ] Validation on client + server
- [ ] Error handling implemented
- [ ] Knowledge base updated

## AI Behavior Guidelines

### When Given a Task

1. **Understand First**
   - Read relevant Obsidian notes
   - Check design system requirements
   - Review user personas
   - Ask clarifying questions if unclear

2. **Plan**
   - Break down into steps
   - Identify files to create/modify
   - Check if migration needed
   - Determine components required

3. **Implement**
   - Follow Portrait design system
   - Use reusable components
   - Add validation (client + server)
   - Handle errors gracefully
   - Create migration if needed

4. **Document**
   - Update relevant Obsidian notes
   - Log work in daily note
   - Add code comments for complex logic only
   - Update feature status

5. **Verify**
   - Does it match Portrait design?
   - Is validation complete?
   - Are errors handled?
   - Is it secure?
   - Is knowledge base updated?

### When Uncertain
- **Always ask questions** rather than making assumptions
- Reference Obsidian vault for decisions
- Check competitor analysis for inspiration
- Review user personas for user needs

### Obsidian Integration
- Create daily note at start of session
- Update feature notes as you work
- Link related concepts with [[WikiLinks]]
- Log decisions and rationale

## Quick Reference

- **Design System**: [DESIGN.md](./DESIGN.md) + `obsidian-vault/02-Design-System/`
- **Tech Rules**: [RULES.md](./RULES.md)
- **Project Overview**: `obsidian-vault/01-Project-Overview/📋 Project Overview.md`
- **Features Roadmap**: `obsidian-vault/04-Features/🔧 Features Roadmap.md`
- **User Flows**: `obsidian-vault/05-User-Research/📊 User Flows.md`
- **Security**: `obsidian-vault/01-Project-Overview/🔐 Security & Compliance.md`

## Environment Variables (Required)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/visa_db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-random-secret-here

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=visa-documents

# Email (for verification)
EMAIL_SERVER=smtp://user:password@smtp.example.com:587
EMAIL_FROM=noreply@yourapp.com
```

---

**Last Updated**: 2026-08-14  
**Version**: 1.0  
**Maintained By**: Development team + AI assistants

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
