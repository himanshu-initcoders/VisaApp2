# Visa & Passport Service Platform

A comprehensive visa and passport service platform for Indian citizens, built with Next.js 16, PostgreSQL, and the Portrait design system.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- AWS S3 account (for document storage)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and AWS credentials

# Generate initial database migration
npm run db:generate

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

### Project Documentation
- **AI Context**: [CLAUDE.md](./CLAUDE.md) - Complete project context for AI assistants
- **Agent Instructions**: [AI_AGENT.md](./AI_AGENT.md) - Detailed workflow for AI agents
- **Design System**: [DESIGN.md](./DESIGN.md) - Portrait design language specification
- **Tech Rules**: [RULES.md](./RULES.md) - Development rules and standards

### Knowledge Base
Comprehensive Obsidian vault in `obsidian-vault/` directory:
- Start here: [🏠 Home](./obsidian-vault/00-Index/🏠%20Home.md)
- Quick start: [QUICK-START.md](./obsidian-vault/QUICK-START.md)
- Full guide: [README.md](./obsidian-vault/README.md)

## 🏗️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: NextAuth.js v5
- **Styling**: Tailwind CSS (Portrait design system)
- **Forms**: React Hook Form + Zod
- **File Storage**: AWS S3
- **Language**: TypeScript

## 📁 Project Structure

```
/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication routes
│   ├── (dashboard)/         # Protected dashboard routes
│   ├── api/                 # API routes
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── components/              # React components
│   ├── ui/                  # Design system components
│   ├── forms/               # Form components
│   ├── layout/              # Layout components
│   └── shared/              # Shared components
├── lib/                     # Utilities and configurations
│   ├── db/                  # Database (Drizzle)
│   │   ├── schema.ts       # DB schema
│   │   └── migrations/     # Migration files
│   ├── validations/        # Zod validation schemas
│   └── utils.ts            # Helper functions
├── obsidian-vault/         # Knowledge base
├── public/                  # Static assets
├── CLAUDE.md               # AI context
├── AI_AGENT.md             # Agent instructions
├── DESIGN.md               # Design system
└── RULES.md                # Development rules
```

## 🎨 Design System

This project uses the **Portrait** design system:
- **Theme**: Light, warm, personal scrapbook aesthetic
- **Colors**: Deep navy ink + rainbow gradient accent
- **Typography**: Switzer (body) + Basier Circle (headlines)
- **Spacing**: 4px base unit, comfortable density
- **Components**: Generous rounding (24px cards, 28px buttons)

See [DESIGN.md](./DESIGN.md) for complete specifications.

## 🔐 Security

- Passwords hashed with bcrypt (12 rounds)
- SQL injection prevention via Drizzle parameterized queries
- XSS prevention via React auto-escaping
- CSRF protection via Next.js
- File upload validation (type, size)
- S3 presigned URLs with expiry
- Environment-based secrets

See `obsidian-vault/01-Project-Overview/🔐 Security & Compliance.md` for details.

## 🗄️ Database

### Schema
- Users (authentication and profiles)
- Visa Applications
- Passport Services
- Documents (S3 references)
- Payments
- Status History (audit trail)

### Migrations

```bash
# Generate migration after schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Open Drizzle Studio (GUI)
npm run db:studio
```

## 📝 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:generate  # Generate database migration
npm run db:migrate   # Apply database migrations
npm run db:studio    # Open Drizzle Studio
npm run db:push      # Push schema to DB (dev only)
```

## 🧪 Development Workflow

1. **Read documentation** in [CLAUDE.md](./CLAUDE.md) and [AI_AGENT.md](./AI_AGENT.md)
2. **Check design system** in [DESIGN.md](./DESIGN.md)
3. **Review user personas** in `obsidian-vault/05-User-Research/`
4. **Create daily note** from template
5. **Build feature** following Portrait design
6. **Update knowledge base** in Obsidian vault
7. **Log work** in daily note

See [AI_AGENT.md](./AI_AGENT.md) for detailed workflow.

## 📊 User Personas

We design for:
1. **Priya** (First-Time Traveler) - Needs guidance
2. **Rajesh** (Frequent Traveler) - Values speed
3. **Meera** (Family Coordinator) - Needs simplicity
4. **Arjun** (Student) - Budget-conscious

See `obsidian-vault/05-User-Research/👤 User Personas.md`

## 🏆 Competitor Analysis

Primary competitor: [Atlys.com](https://www.atlys.com/en-IN)

Our advantages:
- Warmer, more personal design (Portrait system)
- Clearer user guidance
- Better document validation
- More transparent pricing
- Indian market focus

See `obsidian-vault/06-Competitor-Analysis/🏆 Competitor Analysis.md`

## 🔄 Roadmap

### MVP (Phase 1)
- [x] Project setup
- [ ] Authentication (NextAuth)
- [ ] User dashboard
- [ ] Visa application flow
- [ ] Passport service flow
- [ ] Document upload (S3)
- [ ] Payment integration
- [ ] Admin panel

See `obsidian-vault/04-Features/🔧 Features Roadmap.md` for details.

## 🤝 Contributing

1. Read [CLAUDE.md](./CLAUDE.md) for project context
2. Read [AI_AGENT.md](./AI_AGENT.md) for workflow
3. Follow [DESIGN.md](./DESIGN.md) design system
4. Create features using templates in `obsidian-vault/08-Templates/`
5. Update knowledge base after changes
6. Log work in daily notes

## 📄 License

ISC

## 🆘 Support

- Documentation: See `obsidian-vault/` knowledge base
- Design System: [DESIGN.md](./DESIGN.md)
- AI Context: [CLAUDE.md](./CLAUDE.md)
- Agent Guide: [AI_AGENT.md](./AI_AGENT.md)

---

**Built with ❤️ for Indian travelers**
