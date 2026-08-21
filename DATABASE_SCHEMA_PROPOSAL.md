# 📊 Database Schema Proposal

**Status**: ✅ Ready for Implementation  
**Date**: 2026-08-17  
**ORM**: Drizzle ORM  
**Database**: PostgreSQL

---

## 🎯 Quick Summary

Based on deep analysis of **4 Atlys visa processes** (Thailand, Japan, Dubai, USA), I've designed a comprehensive database schema with:

- **24 tables total** (7 existing + 17 new)
- **57 occupation types** (embassy-approved)
- **4 visa process types** (eTA, AFC, visa, appointment)
- **Multi-country visa support** (1 visa for 7 countries)
- **Premium tier pricing** (Standard vs Priority)
- **Dynamic form system** (country-specific fields)
- **Document validation** (OCR + 16 photo checks)
- **Gamification** (user-voted awards)

---

## 📁 Files Created

### Schema Files:
1. **`lib/db/schema-extended.ts`** - 17 new tables (Atlys-inspired features)
2. **`lib/db/seeds/occupations.ts`** - 57 occupation types
3. **`lib/db/seeds/atlysCountries.ts`** - Import script for 4 countries
4. **`lib/db/utils/atlysImporter.ts`** - JSON transformer (Atlys → Our schema)

### Documentation:
5. **`obsidian-vault/03-Technical/Database Schema Documentation.md`** - Complete schema guide
6. **`DATABASE_SCHEMA_PROPOSAL.md`** - This file (executive summary)

---

## 🏗️ Schema Structure

### Existing Tables (7) - Keep As Is
```
users                   # User accounts
visaApplications        # User applications
passportServices        # Passport services
documents               # Document uploads
payments                # Payment transactions
statusHistory           # Status tracking
visaListings            # Visa products (CMS)
```

### New Tables (17) - Add These

#### Country & Process Configuration (8)
```
countries               # Destination countries (4 seeded: TH, JP, AE, US)
entryProcesses          # Visa process types
processTiers            # Standard vs Premium pricing
multiTripCountries      # 1 visa for 7 countries
serviceFees             # Transparent fee breakdown
visaRisks               # Pre-qualification checks
visaAwards              # Gamification badges
partners                # Trust badges (IATA, VFS)
```

#### Dynamic Form System (3)
```
additionalQuestions     # Country-specific fields
componentsRequired      # Document requirements (52 types)
addOns                  # Upsells (eSIM, insurance, concierge)
```

#### Validation & Help (5)
```
passportOcrSettings     # Passport OCR validation
photoValidationSettings # Photo compliance (16 checks)
faqs                    # Country-specific help
postCheckoutSteps       # Process timeline
occupationTypes         # 57 occupation options
```

---

## 🗂️ Key Features

### 1. **Multi-Country Visa Support**
```sql
-- Japan visa also valid for: KR, VN, MY, SG, JO, MN
SELECT e.process_name, array_agg(m.additional_country_code)
FROM entry_processes e
JOIN multi_trip_countries m ON m.entry_process_id = e.id
WHERE e.destination_country = 'JP'
GROUP BY e.id;

-- Result: "Japan Sticker" → ['KR', 'VN', 'MY', 'SG', 'JO', 'MN']
```

**Marketing**: "Get 1 visa, visit 7 countries!" 🌍

---

### 2. **Premium Tier Pricing**
```sql
-- USA: Standard vs Atlys Black
SELECT tier_name, price_amount, eta_duration, eta_unit
FROM process_tiers
WHERE entry_process_id = (SELECT id FROM entry_processes WHERE destination_country = 'US');

-- Results:
-- standard: ₹18,200, 366 days
-- priority:  ₹29,999, 56 days (85% faster, 63% more expensive)
```

---

### 3. **Dynamic Form Fields**
```sql
-- Dubai requires 57 occupation options
SELECT key, label, question_type, array_length(options, 1) as option_count
FROM additional_questions
WHERE entry_process_id = (SELECT id FROM entry_processes WHERE destination_country = 'AE');

-- Result: 'occupation', "What is the traveler's occupation?", 'dropdown', 57
```

---

### 4. **Transparent Fee Breakdown**
```sql
-- Dubai fee structure
SELECT 
  partner_fees,       -- ₹4,699 (VFS fees)
  compliance,         -- ₹0
  payment_processing, -- ₹0
  process_upkeep     -- ₹0
FROM service_fees
WHERE entry_process_id = (SELECT id FROM entry_processes WHERE destination_country = 'AE');
```

---

### 5. **Gamification (Visa Awards)**
```sql
-- Popular visas with user votes
SELECT c.name, va.title, va.category, va.votes
FROM visa_awards va
JOIN countries c ON c.id = va.country_id
ORDER BY va.votes DESC
LIMIT 3;

-- Results:
-- Japan, "Atlys Users' Choice", "Most Efficient Border Control", 912
-- Dubai, "Atlys Users' Choice", "Best Digital Visa Experience", 847
-- Dubai, "Voted", "Best Last-Minute Visa", 623
```

---

## 📦 Seed Data (After Import)

### 4 Countries:
| Country | ISO | Process Type | Price | ETA | Multi-Country |
|---------|-----|--------------|-------|-----|---------------|
| 🇹🇭 Thailand | TH | eTA (TDAC) | ₹0 | 30 mins | - |
| 🇯🇵 Japan | JP | AFC (Sticker) | ₹8,999 | 24 days | +6 countries |
| 🇦🇪 Dubai | AE | E-Visa | ₹4,699 | 48 hours | +5 countries |
| 🇺🇸 USA | US | Appointment | ₹18,200-₹29,999 | 56-366 days | - |

### Additional Data:
- ✅ 57 occupation types (Services, Engineer, Doctor, Manager, etc.)
- ✅ 12+ visa awards (user-voted badges)
- ✅ 100+ dynamic form questions
- ✅ 200+ document requirements
- ✅ 50+ add-ons (eSIM, insurance, concierge)
- ✅ OCR validation settings (blur, glare, fingers)
- ✅ Photo validation (16 ICAO compliance checks)
- ✅ FAQs and post-checkout steps

---

## 🚀 Implementation Steps

### Step 1: Review Files (30 mins)
```bash
# 1. Review schema
code lib/db/schema-extended.ts

# 2. Review seed data
code lib/db/seeds/occupations.ts
code lib/db/seeds/atlysCountries.ts

# 3. Review importer utility
code lib/db/utils/atlysImporter.ts
```

### Step 2: Generate Migration (5 mins)
```bash
# Generate SQL migration from schema
npx drizzle-kit generate:pg

# Review generated migration
code drizzle/0001_add_extended_schema.sql
```

### Step 3: Apply Migration (2 mins)
```bash
# Apply to database
npx drizzle-kit push:pg

# Verify tables created
psql $DATABASE_URL -c "\dt"
```

### Step 4: Run Seeds (5 mins)
```bash
# 1. Seed 57 occupation types
tsx lib/db/seeds/occupations.ts

# 2. Import 4 countries from Atlys JSON
tsx lib/db/seeds/atlysCountries.ts

# Output:
# 🌱 Starting Atlys data import...
# 📋 Seeding occupation types...
# ✅ Inserted 57 occupation types
#
# 🌍 Processing Thailand (atlsdata.json)...
#   ✅ Country: Thailand (TH)
#   ✅ Visa risks configured
#   ✅ Entry process: Thailand TDAC
#   ✅ 2 dynamic form questions
#   ✅ 32 document requirements
#   ✅ 3 FAQs
# ✅ Thailand import complete!
#
# [... Japan, Dubai, USA ...]
#
# 🎉 Atlys data import complete!
```

### Step 5: Integrate with App (Week 2)
```bash
# 1. Update DB exports
code lib/db/index.ts

# 2. Create query helpers
mkdir -p lib/db/queries
code lib/db/queries/visa.ts

# 3. Build API endpoints
code app/api/visa/listings/route.ts

# 4. Update UI components
code components/visa/CountryCard.tsx
```

---

## 📊 Query Examples

### Get all countries with processes:
```typescript
import { db } from '@/lib/db';
import { countries, entryProcesses } from '@/lib/db/schema-extended';

const visaListings = await db.query.countries.findMany({
  where: eq(countries.supported, true),
  with: {
    entryProcesses: {
      with: {
        processTiers: true,
        multiTripCountries: true,
        visaAwards: true
      }
    }
  }
});
```

### Get visa with multi-country support:
```typescript
const japanVisa = await db.query.entryProcesses.findFirst({
  where: eq(entryProcesses.destinationCountry, 'JP'),
  with: {
    country: true,
    multiTripCountries: true,
    processTiers: true,
    additionalQuestions: true,
    componentsRequired: true,
    addOns: true
  }
});

// Result includes:
// - Japan country details
// - 6 multi-trip countries (KR, VN, MY, SG, JO, MN)
// - Pricing tiers
// - Dynamic form questions
// - Document requirements
// - Add-on products
```

### Get premium tier comparison:
```typescript
const usaTiers = await db.query.processTiers.findMany({
  where: eq(processTiers.entryProcessId, usaProcessId),
  orderBy: [asc(processTiers.priceAmount)]
});

// Results:
// [
//   { tierName: 'standard', priceAmount: 18200, etaDuration: 366, etaUnit: 'days' },
//   { tierName: 'priority', priceAmount: 29999, etaDuration: 56, etaUnit: 'days' }
// ]
```

---

## 🎨 UI Integration Examples

### 1. **Multi-Country Badge**
```tsx
<Card>
  <h3>🇯🇵 Japan Tourist Visa</h3>
  <Badge variant="success">
    ✈️ Also valid for 6 countries
  </Badge>
  <p>Get 1 visa, visit 7 countries!</p>
  <CountryList>
    {multiTripCountries.map(c => <CountryFlag code={c} />)}
  </CountryList>
</Card>
```

### 2. **Premium Tier Toggle**
```tsx
<TierSelector>
  <TierOption tier="standard">
    <Price>₹18,200</Price>
    <ETA>366 days</ETA>
  </TierOption>
  <TierOption tier="priority" highlighted>
    <Price>₹29,999</Price>
    <ETA>56 days (85% faster)</ETA>
    <Badge>Priority Processing</Badge>
  </TierOption>
</TierSelector>
```

### 3. **Visa Award Badge**
```tsx
<AwardBadge>
  <Icon name={award.badge} /> {/* icon-border */}
  <Title>{award.title}</Title> {/* "Atlys Users' Choice" */}
  <Category>{award.category}</Category> {/* "Most Efficient" */}
  <Votes>{award.votes} votes</Votes> {/* 912 */}
</AwardBadge>
```

---

## 🔍 Schema Comparison

### Atlys Schema (Inferred):
- ✅ 15+ tables
- ✅ 50+ dev options (feature flags)
- ✅ Rich text editor (ProseMirror JSON)
- ✅ 100+ countries
- ⚠️ Over-engineered for MVP

### Our Schema (Proposed):
- ✅ 24 tables (7 existing + 17 new)
- ✅ 10 essential feature flags
- ✅ Markdown (simpler than rich text)
- ✅ 4 countries (focused launch)
- ✅ 80% features, 20% complexity

**Our Edge**: Simpler, faster to market, focused on India.

---

## 💡 Key Decisions

### ✅ What We're Copying:
1. Multi-country visa support
2. Premium tier pricing
3. 57 occupation types
4. Indian document validation
5. Transparent fee breakdown
6. Dynamic form system
7. Document validation (OCR + photo)
8. Gamification badges

### 🔄 What We're Simplifying:
1. Visa awards → Simple "Popular" badges (no voting initially)
2. 50+ dev options → 10 essential flags
3. Rich text → Markdown
4. 100+ countries → Top 20 for Indians
5. Atlys Black → Simple "Priority" tier

### ⏸️ What We're Skipping (For MVP):
1. B2B portal (focus B2C)
2. Physical visa workflows (digital only)
3. Concierge service (labor-intensive)
4. Native mobile apps (PWA enough)

---

## 📈 Expected Results

### After Migration & Seed:
- ✅ 24 tables in PostgreSQL
- ✅ 4 countries ready to sell
- ✅ 57 occupation types
- ✅ Premium pricing configured
- ✅ Multi-country support active
- ✅ Document validation ready
- ✅ FAQs populated

### Development Time:
- **Migration**: 1 hour
- **Seed data**: 30 mins
- **Testing**: 2 hours
- **Integration**: Week 2
- **Total**: ~1 week to production-ready

---

## ✅ Approval Checklist

Before proceeding:
- [ ] Review all schema files
- [ ] Verify Drizzle ORM setup
- [ ] Check PostgreSQL connection
- [ ] Review seed data sources (Cpompitator/*.json)
- [ ] Confirm 4 countries match requirements
- [ ] Approve 57 occupation types
- [ ] Agree on premium tier strategy
- [ ] Sign off on feature scope

---

## 📚 Documentation Links

Full documentation available in:
- **[Schema Extended](lib/db/schema-extended.ts)** - 17 new tables
- **[Occupations Seed](lib/db/seeds/occupations.ts)** - 57 types
- **[Countries Seed](lib/db/seeds/atlysCountries.ts)** - Import script
- **[Atlys Importer](lib/db/utils/atlysImporter.ts)** - JSON transformer
- **[Database Schema Documentation](obsidian-vault/03-Technical/Database%20Schema%20Documentation.md)** - Complete guide

Competitor analysis:
- **[📋 Executive Summary](obsidian-vault/06-Competitor-Analysis/📋%20Executive%20Summary%20-%20Start%20Here.md)** - 5-min overview
- **[Complete Analysis](obsidian-vault/06-Competitor-Analysis/Atlys%20Complete%20System%20Analysis%20-%20Final%20Report.md)** - Full report
- **[Comparison Matrix](obsidian-vault/06-Competitor-Analysis/Atlys%20vs%20Our%20Platform%20-%20Comparison%20Matrix.md)** - Feature comparison

---

## 🚀 Ready to Proceed?

```bash
# Quick start (3 commands):
npx drizzle-kit generate:pg       # Generate migration
npx drizzle-kit push:pg            # Apply to database
tsx lib/db/seeds/atlysCountries.ts # Import data

# Then build your app! 🎉
```

---

**Status**: ✅ **Ready for Implementation**  
**Next Step**: Review & approve → Generate migration → Apply → Seed → Build features  
**ETA**: 1 week to production-ready schema

---

**Questions?** Review the [Database Schema Documentation](obsidian-vault/03-Technical/Database%20Schema%20Documentation.md) for complete details.
