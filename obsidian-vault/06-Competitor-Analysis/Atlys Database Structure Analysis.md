# Atlys Database Structure - Deep Analysis

**Date**: 2026-08-17  
**Source**: atlsdata.json  
**Purpose**: Reverse-engineer competitor database schema and feature set

---

## Executive Summary

Atlys uses a **highly normalized, feature-flag driven architecture** with:
- **Multi-tenant support** (B2B, B2C, B2E)
- **Dynamic pricing** with currency conversion
- **Component-based document collection**
- **Advanced ML/AI validation** (OCR, photo validation)
- **Flexible add-on system** (eSIM, insurance, itinerary)
- **ETA calculation engine** with dynamic adjustments
- **Process-driven workflows** (tourism, business, etc.)

---

## Core Database Tables (Inferred)

### 1. **countries**
Primary table for destination countries.

```sql
CREATE TABLE countries (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  iso2_code CHAR(2) UNIQUE NOT NULL,
  supported BOOLEAN DEFAULT TRUE,
  show_authorization_tag BOOLEAN DEFAULT FALSE,
  currency CHAR(3) DEFAULT 'USD',
  hero_image_url TEXT,
  hero_image_alt TEXT,
  hero_image_width INTEGER,
  hero_image_height INTEGER,
  headline TEXT,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Fields**:
- `iso2_code`: ISO 3166-1 alpha-2 (TH, US, UK, etc.)
- `supported`: Feature flag for active countries
- `hero_image`: High-res hero images (~4896x3029px, hosted on Cloudinary)

---

### 2. **visa_risks**
Risk factors for visa applications (per country).

```sql
CREATE TABLE visa_risks (
  id UUID PRIMARY KEY,
  country_id UUID REFERENCES countries(id),
  risk_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  severity ENUM('low', 'medium', 'high'),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Risk Types Identified**:
- `expired_passport`
- `insufficient_funds`
- `criminal_record`
- `previous_visa_violations`
- `invalid_insurance`

**Purpose**: Pre-qualification checks, rejection probability calculation.

---

### 3. **entry_processes**
Core table for visa/entry processes (EVISA, TDAC, VOA, etc.).

```sql
CREATE TABLE entry_processes (
  id UUID PRIMARY KEY,
  process_name VARCHAR(100) NOT NULL,
  destination_country CHAR(2) REFERENCES countries(iso2_code),
  purpose VARCHAR(50) DEFAULT 'tourism',
  process_type VARCHAR(50) NOT NULL,
  process_type_label VARCHAR(50),
  process_physical BOOLEAN DEFAULT FALSE,
  source_url TEXT,
  last_edited_by VARCHAR(100),
  
  -- Entry details
  entry_type VARCHAR(50),
  entry_validity_amount INTEGER,
  entry_validity_units VARCHAR(20),
  entry_length_stay_amount INTEGER,
  entry_length_stay_units VARCHAR(20),
  
  -- Support status
  family_enabled BOOLEAN DEFAULT FALSE,
  unsupported BOOLEAN DEFAULT FALSE,
  visa_on_arrival BOOLEAN DEFAULT FALSE,
  visa_free BOOLEAN DEFAULT FALSE,
  
  -- Feature flags (stored as JSONB)
  dev_options JSONB DEFAULT '{}',
  
  -- Timestamps
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Process Types**:
- `electronic_travel_authorisation` (eTA/TDAC)
- `evisa`
- `visa_on_arrival`
- `sticker_visa` (physical)
- `visa_free`

**Key Insight**: Multi-trip support via `multi_trip_countries` array.

---

### 4. **additional_questions**
Dynamic form fields per entry process.

```sql
CREATE TABLE additional_questions (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  key VARCHAR(50) NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  question_type VARCHAR(50) NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  family_enabled BOOLEAN DEFAULT FALSE,
  only_b2b BOOLEAN DEFAULT FALSE,
  only_b2c BOOLEAN DEFAULT FALSE,
  extra_info TEXT,
  required_doc VARCHAR(100),
  source_url TEXT,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Question Types**:
- `text`
- `date`
- `select`
- `file_upload`
- `boolean`

**Examples**:
- `flight_number`: "Enter arrival flight number to Thailand"
- `hotel`: "Enter the Hotel Name in Thailand"
- `Departure_Flight`: B2B only
- `Departure_Date`: Date picker

---

### 5. **components_required**
Document/data requirements (passport, photo, bank statements).

```sql
CREATE TABLE components_required (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  key VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  currency CHAR(3) DEFAULT 'USD',
  chargable BOOLEAN DEFAULT FALSE,
  family_enabled BOOLEAN DEFAULT FALSE,
  only_b2b BOOLEAN DEFAULT FALSE,
  only_b2c BOOLEAN DEFAULT FALSE,
  toggle BOOLEAN DEFAULT FALSE,
  attributes JSONB DEFAULT '[]',
  source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Component Keys** (52 types found):
- **Identity Documents**: `passport`, `passport_back`, `photo`, `identity`
- **Indian Documents**: `india_aadhaar`, `india_itr`, `pan_card`
- **Regional Documents**: `emirates_id_front`, `brp_front`, `uk_share_code`
- **Financial**: `us_bank_statements`, `portugal_bank_account`
- **Travel**: `flight_hotel_details`, `travel_itinerary`, `travel_insurance`
- **Special**: `covid_vaccine`, `fbi_background_check`, `notary`

**Attributes** (array of strings):
- `validity_required`: Passport expiry check
- `image_required`: Photo upload required
- `use_surfer`: Use AI itinerary generator

---

### 6. **add_ons**
Upsell products (eSIM, insurance, itinerary generation).

```sql
CREATE TABLE add_ons (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  fee_amount DECIMAL(10,2) DEFAULT 0,
  currency CHAR(3) DEFAULT 'INR',
  enabled BOOLEAN DEFAULT FALSE,
  primary_addon BOOLEAN DEFAULT FALSE,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Add-On Types**:
1. **eSIM Data Plans**:
   - `esim_one_gb`: ₹443.79
   - `esim_three_gb`: ₹0 (promotional?)
   - `esim_five_gb`: ₹0
   - `esim_ten_gb`: ₹1,065.1

2. **Services**:
   - `Ite` (Generate Itineraries): Flight/hotel temporary bookings
   - `All` (All Paperwork): Full concierge service
   - `Ins` (Mandatory Insurance): Embassy-compliant insurance
   - `expert_assistance`: E-Sim for trip

3. **Premium Tiers**:
   - `premium_pro_plan`: ₹200
   - `premium_pro_max_plan`: ₹500

4. **Location Services**:
   - `us_appt_city_selection`: US Visa city preference

---

### 7. **fee_structure**
Government fees + service fees.

```sql
CREATE TABLE fee_structure (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  
  -- Government fees
  government_fee_amount DECIMAL(10,2) DEFAULT 0,
  government_fee_currency CHAR(3) DEFAULT 'USD',
  
  -- Service fees breakdown
  service_fee_amount DECIMAL(10,2) DEFAULT 0,
  service_fee_currency CHAR(3) DEFAULT 'INR',
  partner_fees DECIMAL(10,2) DEFAULT 0,
  compliance_fees DECIMAL(10,2) DEFAULT 0,
  payment_processing_fees DECIMAL(10,2) DEFAULT 0,
  process_upkeep_fees DECIMAL(10,2) DEFAULT 0,
  
  -- Discounts
  discount_per_additional_purchase DECIMAL(10,2) DEFAULT 0,
  india_skip_gst_charges BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Fee Distribution**:
- `partner_fees`: Third-party VFS/embassy fees
- `compliance`: Legal/regulatory
- `payment_processing`: Stripe/Razorpay
- `process_upkeep`: Maintenance

---

### 8. **eta_settings**
ETA (Estimated Time to Approval) calculation engine.

```sql
CREATE TABLE eta_settings (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  
  -- Standard ETA
  standard_duration INTEGER NOT NULL,
  standard_unit VARCHAR(20) NOT NULL,
  
  -- B2B ETA (longer)
  b2b_duration INTEGER,
  b2b_unit VARCHAR(20),
  
  -- Dynamic ETA (AI-adjusted)
  dynamic_duration INTEGER,
  dynamic_unit VARCHAR(20),
  
  -- Fusion settings (multi-stage)
  eta_fusion JSONB DEFAULT '[]',
  eta_fusion_b2b JSONB DEFAULT '[]',
  dynamic_eta_fusion JSONB DEFAULT '[]',
  
  -- Config
  ignore_holidays BOOLEAN DEFAULT FALSE,
  b2c_dynamic_eta_disabled BOOLEAN DEFAULT FALSE,
  b2c_dynamic_eta_force_shutdown BOOLEAN DEFAULT FALSE,
  ignore_eta_changes_if_additional_docs_were_asked BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**ETA Fusion Events**:
```json
[
  {
    "duration": 30,
    "unit": "minutes",
    "on_event": "post_checkout"
  },
  {
    "duration": 60,
    "unit": "hours",
    "on_event": "pre_travel"
  }
]
```

**Key Insight**: Dynamic ETA adjusts based on:
- Current processing times
- Document upload delays
- Holiday schedules

---

### 9. **passport_ocr_settings**
AI-powered passport scanning validation.

```sql
CREATE TABLE passport_ocr_settings (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  
  -- Detection toggles
  skip_blur_detection BOOLEAN DEFAULT FALSE,
  skip_glare_detection BOOLEAN DEFAULT FALSE,
  skip_fingers_detection BOOLEAN DEFAULT FALSE,
  use_strict_fingers_detection_model BOOLEAN DEFAULT TRUE,
  enable_travel_doc_check BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Validations**:
- Blur detection (document clarity)
- Glare detection (lighting)
- Fingers detection (hand obstruction)
- Travel document check (valid passport vs ID)

---

### 10. **photo_validation_settings**
Biometric photo compliance checks.

```sql
CREATE TABLE photo_validation_settings (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  setting_type VARCHAR(50) NOT NULL, -- 'live_capture' or 'upload'
  
  -- Restrictions (all BOOLEAN)
  restrict_invalid_photo BOOLEAN DEFAULT TRUE,
  restrict_multiple_faces BOOLEAN DEFAULT TRUE,
  restrict_face_outside_of_frame BOOLEAN DEFAULT TRUE,
  restrict_covered_face BOOLEAN DEFAULT TRUE,
  restrict_closed_eyes BOOLEAN DEFAULT TRUE,
  restrict_glasses BOOLEAN DEFAULT TRUE,
  restrict_headcover BOOLEAN DEFAULT FALSE,
  restrict_not_centered_face BOOLEAN DEFAULT FALSE,
  restrict_not_straight_face BOOLEAN DEFAULT FALSE,
  restrict_improper_light_conditions BOOLEAN DEFAULT FALSE,
  restrict_too_close_face BOOLEAN DEFAULT FALSE,
  restrict_too_far_face BOOLEAN DEFAULT FALSE,
  restrict_teeth_visibility BOOLEAN DEFAULT TRUE,
  restrict_hair_in_front BOOLEAN DEFAULT TRUE,
  restrict_ears_are_not_visible BOOLEAN DEFAULT FALSE,
  restrict_shoulders_to_be_visible BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Embassy-compliant photo validation (ICAO standards).

---

### 11. **dev_options**
Feature flags for progressive rollout.

```sql
CREATE TABLE dev_options (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  
  -- Platform controls
  only_b2b BOOLEAN DEFAULT FALSE,
  only_b2c BOOLEAN DEFAULT FALSE,
  b2e_enabled BOOLEAN DEFAULT FALSE,
  b2c_expose_on_clp BOOLEAN DEFAULT FALSE,
  
  -- Minimum versions
  ios_min_version VARCHAR(20),
  android_min_version INTEGER DEFAULT 0,
  
  -- Operational
  days_off JSONB DEFAULT '[]', -- ["2026-12-25", "2026-01-01"]
  posting_time_start TIME,
  posting_time_end TIME,
  
  -- Feature toggles
  use_afc_doxie BOOLEAN DEFAULT FALSE,
  disable_eta_tasks BOOLEAN DEFAULT FALSE,
  disable_eta_tasks_b2b BOOLEAN DEFAULT FALSE,
  b2c_enable_notarize BOOLEAN DEFAULT FALSE,
  b2c_enable_checkout_pwon BOOLEAN DEFAULT FALSE,
  b2c_exact_travel_dates_required BOOLEAN DEFAULT FALSE,
  b2c_enable_rejected_visa_insurance BOOLEAN DEFAULT FALSE,
  b2c_enable_absconding_visa_insurance BOOLEAN DEFAULT FALSE,
  b2b_enable_absconding_visa_insurance BOOLEAN DEFAULT FALSE,
  b2b_enable_insurance_bundling BOOLEAN DEFAULT FALSE,
  allow_insurance_on_b2b_portal BOOLEAN DEFAULT FALSE,
  
  -- Age restrictions
  main_traveler_min_age INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 12. **faqs**
Country-specific FAQ content.

```sql
CREATE TABLE faqs (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  question TEXT NOT NULL,
  answer JSONB NOT NULL, -- Rich text (ProseMirror/TipTap format)
  category VARCHAR(100),
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Answer Format** (Rich Text JSON):
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "attrs": { "textAlign": "left" },
      "content": [
        {
          "text": "Indian citizens",
          "type": "text",
          "marks": [{ "type": "bold" }]
        }
      ]
    }
  ]
}
```

---

### 13. **partners**
Logos for trust badges (IATA, VFS, etc.).

```sql
CREATE TABLE partners (
  id UUID PRIMARY KEY,
  country_id UUID REFERENCES countries(id),
  logo_url TEXT NOT NULL,
  logo_alt TEXT,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Examples**:
- IATA (International Air Transport Association)
- VFS Global
- Embassy partners

---

### 14. **entry_documents**
Post-checkout process documentation.

```sql
CREATE TABLE entry_documents (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  heading TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 15. **post_checkout_steps**
Process timeline (what happens after payment).

```sql
CREATE TABLE post_checkout_steps (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  heading TEXT NOT NULL,
  subheading TEXT,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Steps**:
1. "Atlys automatically compiles your application"
2. "Your visa is submitted to authorities"
3. "Track your application status"

---

## Advanced Features (JSON Columns)

### 1. **Atlys Protect Settings**
Insurance for rejected visas.

```json
{
  "b2c_enabled": false,
  "b2c_refund_settings": {
    "government_fees": {
      "when_delayed": false,
      "when_rejected": true
    },
    "service_fees": {
      "when_delayed": false,
      "when_rejected": true
    }
  }
}
```

---

### 2. **Pay When Ready Settings**
Deferred payment option.

```json
{
  "b2c_enabled": false
}
```

---

### 3. **Group Discount Settings**
Family/group pricing.

```json
{
  "enabled": false,
  "discount_per_additional_purchase_amount": 0
}
```

---

### 4. **Rejection Probability Settings**
AI-powered risk scoring.

```json
{
  "rejection_probability_rate": 0.15 // 15% risk
}
```

---

### 5. **Assortment Settings**
Multi-country visa bundles.

```json
{
  "enabled": false
}
```

---

## Technology Stack (Inferred)

### Frontend
- **Framework**: React/Next.js (likely)
- **Rich Text**: ProseMirror or TipTap (JSON-based)
- **Image CDN**: Cloudinary (`media.atlys.com`)
- **Alternative CDN**: `imagedelivery.net` (Cloudflare Images?)

### Backend
- **API**: RESTful (JSON responses)
- **Database**: PostgreSQL (UUID primary keys, JSONB columns)
- **ORM**: Likely Prisma or TypeORM
- **Email System**: Identified by `last_edited_by: "sameer@atlys.com"`

### ML/AI
- **OCR Engine**: Passport scanning (blur, glare, finger detection)
- **Face Recognition**: Photo validation (ICAO compliance)
- **Risk Scoring**: Rejection probability algorithm
- **Dynamic ETA**: Machine learning for processing time prediction

### Integrations
- **Payment**: Razorpay (India), Stripe (Global)
- **eSIM**: Third-party provider (Airalo?)
- **Insurance**: Travel insurance API
- **Itinerary**: "Surfer" AI itinerary generator
- **Embassy APIs**: Direct integration with official portals

---

## Key Differentiators

### 1. **Multi-Tenant Architecture**
- **B2C**: Direct consumers (Atlys.com)
- **B2B**: Travel agents/agencies (portal.atlys.com)
- **B2E**: Enterprise (corporate travel)

### 2. **Component-Based Document Collection**
Instead of hardcoded forms, they use a flexible component system:
```json
{
  "key": "passport",
  "attributes": ["validity_required", "image_required"],
  "family_enabled": true
}
```

### 3. **Family/Group Support**
`family_enabled` flag allows batch applications with auto-fill.

### 4. **Dynamic Pricing**
Currency conversion + country-specific pricing:
```json
{
  "amount": 1065.1,
  "currency": "INR"
}
```

### 5. **Progressive Web App**
Min version requirements suggest PWA/mobile apps:
```json
{
  "ios_min_version": "2.5.0",
  "android_min_version": 25
}
```

---

## Competitive Advantages

### What Atlys Does Well:
1. **Highly granular feature flags** → A/B testing, gradual rollout
2. **ML-powered validation** → Reduce rejections
3. **Rich upsell ecosystem** → eSIM, insurance, concierge
4. **Multi-country support** → 100+ countries
5. **Transparent fee breakdown** → Trust building
6. **Dynamic ETA** → Realistic expectations

### Weaknesses (Opportunities for Us):
1. **Complex data model** → Harder to maintain
2. **Too many options** → Decision fatigue
3. **Corporate UI** → Lacks warmth (our Portrait design wins)
4. **Overwhelming feature flags** → 50+ dev_options
5. **Hidden fees?** → VFS charges mentioned in FAQ

---

## Our Implementation Strategy

### Phase 1: Core Features
- [ ] Countries table with ISO codes
- [ ] Entry processes (EVISA, VOA)
- [ ] Components required (passport, photo)
- [ ] Basic fee structure
- [ ] Simple ETA calculation

### Phase 2: Document Validation
- [ ] Passport OCR (blur, glare detection)
- [ ] Photo validation (ICAO compliance)
- [ ] Document upload with S3

### Phase 3: Add-Ons
- [ ] eSIM integration
- [ ] Travel insurance
- [ ] Itinerary generator (simpler than "Surfer")

### Phase 4: Advanced
- [ ] Family applications
- [ ] Dynamic ETA
- [ ] Risk scoring
- [ ] B2B portal

---

## Database Schema Recommendations

### Simplify Their Model:
1. **Merge `fee_structure` into `entry_processes`**
   - Less joins, simpler queries

2. **Use enum types instead of strings**
   ```sql
   CREATE TYPE process_type AS ENUM ('evisa', 'eta', 'voa', 'sticker', 'visa_free');
   ```

3. **Avoid over-normalization**
   - Store `photo_validation_settings` as JSONB in `entry_processes`

4. **Use Drizzle ORM advantages**
   - Type-safe queries
   - Simpler migrations
   - Better TypeScript integration

---

## Action Items

### Immediate:
1. **Create simplified schema** based on this analysis
2. **Focus on Indian market** (Aadhaar, PAN, ITR support)
3. **Build warmth into UX** (Portrait design)
4. **Transparent pricing** (no hidden VFS fees)

### Next Sprint:
1. **OCR integration** (passport scanning)
2. **Photo validation** (face detection)
3. **eSIM partnership** (Airalo or similar)

### Future:
1. **Family applications** (batch processing)
2. **Risk scoring** (ML model)
3. **B2B portal** (travel agent dashboard)

---

## Tools Used by Atlys

### Development:
- **TypeScript**: Type-safe JSON structures
- **React**: Component-based UI
- **Next.js**: SSR + API routes
- **Prisma/TypeORM**: Database ORM
- **PostgreSQL**: Primary database

### AI/ML:
- **OpenCV/TensorFlow**: Image validation
- **Tesseract OCR**: Passport scanning
- **Face Recognition API**: Biometric validation
- **Custom ML models**: Risk scoring, ETA prediction

### Infrastructure:
- **AWS/GCP**: Hosting
- **Cloudinary**: Image CDN
- **Cloudflare**: CDN + Images
- **Redis**: Caching (inferred)
- **Elasticsearch**: Search (inferred)

### Monitoring:
- **Sentry**: Error tracking (likely)
- **Mixpanel/Amplitude**: Analytics
- **Stripe/Razorpay**: Payment processing

---

## Conclusion

Atlys has built a **feature-rich, enterprise-grade platform** with:
- 50+ document types
- 100+ countries
- ML-powered validation
- Multi-tenant support
- Rich upsell ecosystem

**Our Edge**: Simpler, warmer, India-focused with better UX.

**Key Takeaway**: Don't copy their complexity. Build 80% of features with 20% of complexity.

---

**Last Updated**: 2026-08-17  
**Analyzed By**: Claude + Development Team  
**Next Review**: After MVP launch
