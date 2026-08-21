# AI Agent Instructions

> Specialized instructions for AI agents working on this visa and passport service platform.

## Your Role

You are an AI development assistant for a Next.js 16 visa and passport service platform targeting Indian citizens. Your primary responsibilities:

1. **Write high-quality code** following Portrait design system
2. **Maintain knowledge base** in Obsidian vault
3. **Log all work** in daily notes
4. **Ask questions** when unclear
5. **Research best practices** before implementing

## Critical: Read These First

Before doing ANYTHING:
1. Read [CLAUDE.md](./CLAUDE.md) for complete project context
2. Read [DESIGN.md](./DESIGN.md) for design system
3. Read [RULES.md](./RULES.md) for tech stack rules

## Workflow for Every Task

### 1. Understand (ALWAYS START HERE)

```markdown
Questions to answer before coding:
- What is the user goal? (Check user personas)
- What does the design require? (Check design system)
- What data is needed? (Check DB schema)
- What validation is needed? (Define Zod schemas)
- What security concerns exist? (Check security docs)
- Is this unclear? (ASK QUESTIONS)
```

**Read relevant Obsidian notes**:
```bash
# For features
obsidian-vault/04-Features/🔧 Features Roadmap.md

# For design
obsidian-vault/02-Design-System/🎨 Design System Hub.md

# For users
obsidian-vault/05-User-Research/👤 User Personas.md
obsidian-vault/05-User-Research/📊 User Flows.md

# For tech
obsidian-vault/03-Technical/⚙️ Technical Stack.md
```

### 2. Create/Update Daily Note

**Location**: `obsidian-vault/09-Daily-Notes/YYYY-MM-DD.md`  
**Template**: `obsidian-vault/08-Templates/📅 Daily Note Template.md`

```markdown
# 2026-08-14 - Daily Note

## 🎯 Today's Focus
- [ ] Task you're about to work on

## ✅ Completed
(Update as you complete tasks)

## 💡 Ideas & Notes
(Document decisions as you make them)

## 🐛 Bugs Found
(Log any bugs discovered)

## 🚧 Blockers
(Note anything blocking progress)

## 📚 Learnings
(Document what you learned)
```

### 3. Plan Implementation

Before writing code, create mental plan:

```markdown
1. Files to create/modify: [list files]
2. Components needed: [list components]
3. Validation schemas: [list Zod schemas]
4. DB changes: [yes/no - if yes, need migration]
5. S3 upload: [yes/no]
6. Auth required: [yes/no]
7. Design components: [list Portrait components]
```

### 4. Implement Code

#### Code Quality Standards

**Every file must have**:
- TypeScript types (no `any` unless absolutely necessary)
- Proper error handling
- Validation (client + server)
- Security checks
- Portrait design system compliance

**Component Structure**:
```typescript
// components/ui/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-[28px] px-4 py-2.5 font-switzer font-medium text-base',
          variant === 'primary' && 
            'bg-transparent border-[1.5px] border-gradient text-portrait-ink',
          variant === 'ghost' && 
            'bg-transparent text-portrait-ink hover:opacity-80',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**Form Pattern**:
```typescript
// app/(dashboard)/applications/new/page.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const visaSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  country: z.string().min(1, 'Please select a country'),
});

type VisaFormData = z.infer<typeof visaSchema>;

export default function NewVisaApplication() {
  const { register, handleSubmit, formState: { errors } } = useForm<VisaFormData>({
    resolver: zodResolver(visaSchema),
  });

  const onSubmit = async (data: VisaFormData) => {
    try {
      const response = await fetch('/api/visa/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to submit application');
      }

      // Handle success
    } catch (error) {
      // Handle error
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Form fields following Portrait design */}
    </form>
  );
}
```

**Server Action Pattern**:
```typescript
// app/actions/visa.ts
'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { visaApplications } from '@/lib/db/schema';

const visaSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  country: z.string(),
});

export async function submitVisaApplication(data: unknown) {
  // 1. Check authentication
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  // 2. Validate input
  const parsed = visaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: 'Invalid data', details: parsed.error.flatten() };
  }

  // 3. Database operation
  try {
    const [application] = await db.insert(visaApplications).values({
      userId: session.user.id,
      ...parsed.data,
      status: 'submitted',
      submittedAt: new Date(),
    }).returning();

    return { success: true, applicationId: application.id };
  } catch (error) {
    console.error('Failed to create application:', error);
    return { error: 'Failed to submit application' };
  }
}
```

#### Database Migration Pattern

**When schema changes**:

```bash
# 1. Update schema
# lib/db/schema.ts

# 2. Generate migration
npm run db:generate

# 3. Review migration file in lib/db/migrations/

# 4. Apply migration
npm run db:migrate

# 5. Commit both schema.ts AND migration files
```

**Schema Example**:
```typescript
// lib/db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  emailVerified: timestamp('email_verified'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const visaApplications = pgTable('visa_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  country: varchar('country', { length: 100 }).notNull(),
  visaType: varchar('visa_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  personalInfo: jsonb('personal_info'),
  travelInfo: jsonb('travel_info'),
  documents: jsonb('documents'),
  paymentId: uuid('payment_id'),
  submittedAt: timestamp('submitted_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 5. Update Knowledge Base

**After implementing a feature**, update relevant Obsidian notes:

#### Feature Completion
```markdown
File: obsidian-vault/04-Features/🔧 Features Roadmap.md

Update status from [ ] to [x]:
- [x] User registration ← Mark complete
```

#### New Design Component
```markdown
File: obsidian-vault/02-Design-System/🧩 Components Library.md

Add new component documentation:
### Component Name
**Role**: What it does
**Specs**: Technical details
**Usage**: When to use it
```

#### Technical Decision
```markdown
File: obsidian-vault/03-Technical/⚙️ Technical Stack.md

Document new library or pattern:
### Library Name
**Purpose**: Why we added it
**Usage**: How to use it
```

#### User Flow
```markdown
File: obsidian-vault/05-User-Research/📊 User Flows.md

Add or update flow:
### Flow Name
```
Step 1 → Step 2 → Step 3
```
```

### 6. Log Daily Work

**Before ending session**, update daily note:

```markdown
# 2026-08-14 - Daily Note

## ✅ Completed
- [x] Created user registration form
- [x] Implemented email validation
- [x] Added NextAuth configuration
- [x] Created users table migration

## 💡 Ideas & Notes
- Decided to use NextAuth Credentials provider for now
- Email verification will be added in Phase 2
- Using bcrypt with 12 rounds for password hashing

## 📚 Learnings
- Next.js 16 Server Actions are great for form handling
- Drizzle migration workflow is smooth
- Portrait design system makes components beautiful

## 🔗 Links & References
- [[⚙️ Technical Stack#NextAuth]]
- [[🔧 Features Roadmap#MVP]]
```

## Design System Compliance

### Every Component Must:

1. **Use correct colors**:
   ```typescript
   // Primary text: Portrait Ink
   className="text-portrait-ink"
   
   // Secondary text: Slate Helper
   className="text-slate-helper"
   
   // Background: White Canvas
   className="bg-white"
   
   // Pastel surfaces: Mint/Sky/Peach Wash
   className="bg-sky-wash"
   ```

2. **Use correct border radius**:
   ```typescript
   // Cards: 24px
   className="rounded-[24px]"
   
   // Buttons: 28px
   className="rounded-[28px]"
   
   // Inputs: 16px
   className="rounded-[16px]"
   
   // Tags: Full pill
   className="rounded-full"
   ```

3. **Use correct typography**:
   ```typescript
   // Body text: Switzer
   className="font-switzer text-base leading-[1.5]"
   
   // Headlines: Basier Circle
   className="font-basier text-heading leading-[1.08]"
   
   // Button text: Switzer 500
   className="font-switzer font-medium"
   ```

4. **Use correct spacing**:
   ```typescript
   // Card padding: 16px
   className="p-4"
   
   // Section gap: 80px
   className="space-y-20"
   
   // Element gap: 16px
   className="gap-4"
   ```

### Rainbow Gradient Usage

**ONLY use rainbow gradient for**:
1. Primary CTA button border (Sign up button)
2. One italicized word per headline
3. Small decorative accents

**NEVER use rainbow for**:
- Button backgrounds (transparent only)
- Full text gradients
- Multiple CTAs on same page

```typescript
// Correct: Rainbow outline button
<button className="rounded-[28px] bg-transparent border-[1.5px] border-gradient-rainbow">
  Sign up
</button>

// Wrong: Rainbow background
<button className="bg-gradient-rainbow"> ❌ NO
```

## Security Checklist

### For Every Feature:

- [ ] **Authentication checked** on protected routes
- [ ] **Authorization verified** (user can only access their data)
- [ ] **Input validated** on client AND server
- [ ] **SQL injection prevented** (using Drizzle parameterized queries)
- [ ] **XSS prevented** (React auto-escaping + no dangerouslySetInnerHTML)
- [ ] **CSRF protected** (Next.js handles this)
- [ ] **Sensitive data encrypted** (passwords hashed, S3 encrypted)
- [ ] **File upload secured** (type validation, size limits)
- [ ] **No secrets in code** (use environment variables)
- [ ] **Error messages safe** (don't leak sensitive info)

## Common Pitfalls to Avoid

### ❌ DON'T

1. **Skip validation**: Always validate client + server
2. **Trust user input**: Sanitize and validate everything
3. **Forget migrations**: Always create when schema changes
4. **Hardcode secrets**: Use environment variables
5. **Skip error handling**: Handle all error cases
6. **Forget knowledge base**: Update Obsidian after changes
7. **Skip daily log**: Document work at end of session
8. **Mix design systems**: Follow Portrait design exactly
9. **Use `any` type**: Proper TypeScript types always
10. **Store passwords plainly**: Hash with bcrypt

### ✅ DO

1. **Ask questions** when unclear
2. **Research best practices** before implementing
3. **Follow Portrait design system** precisely
4. **Create reusable components** in `/components/ui`
5. **Validate everywhere** (client + server)
6. **Handle errors gracefully** with user-friendly messages
7. **Log all work** in daily notes
8. **Update knowledge base** after changes
9. **Test both happy path and errors**
10. **Think about user personas** when designing UX

## Quick Commands

```bash
# Development
npm run dev                 # Start dev server

# Database
npm run db:generate        # Generate migration
npm run db:migrate         # Apply migrations
npm run db:studio          # Open Drizzle Studio

# Knowledge Base
cd obsidian-vault          # Navigate to vault
# Open in Obsidian to view/edit

# Daily Note
# Create: obsidian-vault/09-Daily-Notes/YYYY-MM-DD.md
# Use template: obsidian-vault/08-Templates/📅 Daily Note Template.md
```

## Decision Framework

When making technical decisions:

1. **Check user personas**: How does this affect Priya (first-timer) vs Rajesh (power user)?
2. **Check design system**: Does this match Portrait aesthetic?
3. **Check security**: Does this introduce vulnerabilities?
4. **Check competitor**: How does Atlys handle this?
5. **Document decision**: Log in Obsidian with rationale

## Communication Protocol

### When You Need Input:

```markdown
## Question: [Clear, specific question]

**Context**: [Why you need this information]

**Options considered**:
1. Option A - [pros/cons]
2. Option B - [pros/cons]

**Recommendation**: [Your suggested approach with reasoning]

**Related docs**:
- [[Relevant Obsidian Note]]
- [External link if applicable]
```

### When Reporting Progress:

```markdown
## Progress Update: [Feature/Task Name]

**Status**: [In Progress / Completed / Blocked]

**Completed**:
- [x] Task 1
- [x] Task 2

**In Progress**:
- [ ] Task 3 (60% done)

**Next Steps**:
- [ ] Task 4
- [ ] Task 5

**Files Changed**:
- `path/to/file1.ts`
- `path/to/file2.tsx`

**Knowledge Base Updates**:
- Updated [[Note Name]]
- Logged in [[Daily Note]]

**Questions/Blockers**:
- [Any blockers or questions]
```

## Knowledge Base Maintenance

### Weekly Review (Do Every Friday):

1. **Review roadmap**: Update feature statuses
2. **Review daily notes**: Consolidate insights
3. **Update personas**: Add new user insights
4. **Review competitor**: Check for Atlys changes
5. **Update tech docs**: Document new patterns

### When Starting New Features:

1. Create feature note from template
2. Link to user personas
3. Link to design components
4. Link to technical requirements
5. Log start in daily note

### When Completing Features:

1. Mark complete in roadmap
2. Update feature note with final details
3. Document learnings in daily note
4. Update relevant technical docs
5. Create demo/screenshots if UI feature

---

## Final Checklist Before Any Commit

- [ ] Code follows Portrait design system
- [ ] Validation on client + server
- [ ] Error handling implemented
- [ ] TypeScript types defined (no `any`)
- [ ] Security checks passed
- [ ] Migration created if schema changed
- [ ] Components are reusable
- [ ] Knowledge base updated
- [ ] Daily note updated
- [ ] No console.logs left
- [ ] No TODOs left (create proper tasks instead)
- [ ] No secrets in code

---

**Remember**: You're building for real users (Priya, Rajesh, Meera, Arjun). Every decision should make their experience better. When in doubt, ask questions!

**Last Updated**: 2026-08-14  
**Version**: 1.0
