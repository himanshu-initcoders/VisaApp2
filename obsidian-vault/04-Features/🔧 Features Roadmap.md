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
- [x] Apply flow shell: Travelers → Documents → Pay (no site navbar)
- [x] Passport capture + Indian MRZ/OCR review (client-side)
- [ ] Persist application to DB + real S3 upload
- [ ] Payment gateway on Pay step
- [ ] Form validation (client + server)
- [ ] Application submission

### Passport Services
- [ ] Service type selection (New, Renewal, Update)
- [ ] Application form
- [ ] Document upload
- [ ] Form validation
- [ ] Service submission

### Application Management
- [ ] Dashboard with all applications
- [ ] Application status tracking
- [ ] Document management
- [ ] Status notifications (email)

### Payments
- [ ] Pricing calculation
- [ ] Payment gateway integration
- [ ] Receipt generation
- [ ] Payment history

### Admin Panel (Basic)
- [ ] View all applications
- [ ] Update application status
- [ ] Document verification
- [ ] User management
- [x] Add Country (admin config create flow)
- [x] Add Visa listing (admin config create flow)

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
