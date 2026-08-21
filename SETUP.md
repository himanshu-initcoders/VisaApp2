# 🚀 Setup Guide

This guide will help you get the project running locally.

## Prerequisites

- [x] Node.js 18+ installed
- [ ] PostgreSQL database (local or hosted)
- [ ] AWS S3 account (for document uploads)
- [ ] Obsidian (optional, for knowledge base)

---

## Step 1: Install Dependencies ✅ DONE

Dependencies are already installed! If you need to reinstall:

```bash
npm install
```

---

## Step 2: Setup Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` with your credentials:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/visa_db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=visa-documents

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Generate NextAuth Secret

```bash
# Run this to generate a random secret
openssl rand -base64 32
```

---

## Step 3: Setup PostgreSQL Database

### Option A: Local PostgreSQL

1. **Install PostgreSQL** (if not installed)
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/)
   - Mac: `brew install postgresql@16`
   - Linux: `sudo apt install postgresql postgresql-contrib`

2. **Create database**:
   ```bash
   # Connect to PostgreSQL
   psql -U postgres

   # Create database
   CREATE DATABASE visa_db;

   # Create user (optional)
   CREATE USER visa_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE visa_db TO visa_user;

   # Exit
   \q
   ```

3. **Update DATABASE_URL** in `.env`:
   ```env
   DATABASE_URL=postgresql://visa_user:your_password@localhost:5432/visa_db
   ```

### Option B: Hosted PostgreSQL

Use services like:
- [Vercel Postgres](https://vercel.com/storage/postgres)
- [Supabase](https://supabase.com/)
- [Railway](https://railway.app/)
- [Neon](https://neon.tech/)

Get the connection string and add to `.env`.

---

## Step 4: Run Database Migrations

Generate and run the initial migration:

```bash
# Generate migration from schema
npm run db:generate

# Review the migration file in lib/db/migrations/

# Apply migration to database
npm run db:migrate
```

You should see output confirming tables were created.

---

## Step 5: Setup AWS S3 (Optional - for later)

1. **Create S3 bucket** in AWS Console
2. **Create IAM user** with S3 access
3. **Add credentials** to `.env`

You can skip this for now and add it later when implementing document upload.

---

## Step 6: Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

You should see the landing page with Portrait design!

---

## Step 7: Verify Setup

### Check Database Connection
```bash
# Open Drizzle Studio (database GUI)
npm run db:studio
```

Visit [https://local.drizzle.studio](https://local.drizzle.studio)

You should see all 6 tables:
- users
- visa_applications
- passport_services
- documents
- payments
- status_history

### Check UI Components
The landing page should display:
- Large display headline with gradient word
- Body text in Switzer font
- Primary button with Portrait Ink border
- Ghost text button

---

## Next Steps

### 1. Create NextAuth Configuration
```bash
# Create auth configuration file
touch lib/auth.ts
```

### 2. Build Authentication Pages
```bash
# Create auth route group
mkdir -p app/(auth)/login
mkdir -p app/(auth)/register

# Create pages
touch app/(auth)/login/page.tsx
touch app/(auth)/register/page.tsx
```

### 3. Build Dashboard
```bash
# Create dashboard route group
mkdir -p app/(dashboard)/dashboard

# Create dashboard page
touch app/(dashboard)/dashboard/page.tsx
touch app/(dashboard)/layout.tsx
```

---

## Troubleshooting

### Database Connection Error
- **Error**: `Error: connect ECONNREFUSED`
- **Fix**: Make sure PostgreSQL is running and DATABASE_URL is correct

### Port 3000 Already in Use
- **Error**: `Port 3000 is already in use`
- **Fix**: 
  ```bash
  # Kill process on port 3000 (Windows)
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F

  # Or use different port
  npm run dev -- -p 3001
  ```

### Module Not Found Errors
- **Fix**: 
  ```bash
  # Clear cache and reinstall
  rm -rf node_modules package-lock.json
  npm install
  ```

### TypeScript Errors
- **Fix**:
  ```bash
  # Regenerate TypeScript types
  rm -rf .next
  npm run dev
  ```

---

## Project Structure Quick Reference

```
/
├── app/                    # Next.js routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   └── ui/               # Design system components
├── lib/                   # Utilities
│   ├── db/               # Database (Drizzle)
│   ├── validations/      # Zod schemas
│   └── utils.ts          # Helper functions
├── obsidian-vault/       # Knowledge base
├── CLAUDE.md             # AI context
├── AI_AGENT.md           # Agent workflow
├── DESIGN.md             # Design system
└── .env                  # Environment variables (create this!)
```

---

## Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate migration
npm run db:migrate       # Apply migrations
npm run db:studio        # Open database GUI
npm run db:push          # Push schema (dev only)

# Code Quality
npm run lint             # Run ESLint
```

---

## Resources

- **Project Docs**: See [README.md](./README.md)
- **AI Context**: [CLAUDE.md](./CLAUDE.md)
- **Design System**: [DESIGN.md](./DESIGN.md)
- **Knowledge Base**: [obsidian-vault/](./obsidian-vault/)
- **Daily Log**: [obsidian-vault/09-Daily-Notes/2026-08-14.md](./obsidian-vault/09-Daily-Notes/2026-08-14.md)

---

## Need Help?

1. Check [CLAUDE.md](./CLAUDE.md) for project context
2. Check [AI_AGENT.md](./AI_AGENT.md) for workflow
3. Check Obsidian vault for detailed documentation
4. Check [Next.js docs](https://nextjs.org/docs)
5. Check [Drizzle docs](https://orm.drizzle.team/docs)

---

**Happy coding! 🚀**
