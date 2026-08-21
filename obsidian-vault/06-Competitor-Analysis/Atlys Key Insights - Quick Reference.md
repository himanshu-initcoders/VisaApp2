# Atlys Key Insights - Quick Reference

**Date**: 2026-08-17  
**Status**: Active Development Reference

---

## 🎯 Top 10 Features to Copy

### 1. **Component-Based Document Collection**
Instead of hardcoded forms, use flexible components:
```typescript
interface DocumentComponent {
  key: string; // 'passport', 'photo', 'pan_card'
  attributes: string[]; // ['validity_required', 'image_required']
  family_enabled: boolean;
  only_b2b: boolean;
  only_b2c: boolean;
}
```

**Why**: Reusable across multiple visa types.

---

### 2. **Dynamic Additional Questions**
Country-specific form fields:
```typescript
interface AdditionalQuestion {
  key: string; // 'flight_number', 'hotel'
  label: string;
  description: string;
  question_type: 'text' | 'date' | 'select' | 'file_upload';
  required: boolean;
  family_enabled: boolean;
}
```

**Example**: Thailand requires flight number + hotel name.

---

### 3. **ETA Calculation Engine**
```typescript
interface ETASettings {
  standard: { duration: number; unit: 'minutes' | 'hours' | 'days' };
  b2b: { duration: number; unit: string }; // Longer for bulk
  dynamic: { duration: number; unit: string }; // AI-adjusted
  fusion: Array<{
    duration: number;
    unit: string;
    on_event: 'post_checkout' | 'pre_travel';
  }>;
}
```

**Key**: Show realistic timelines, build trust.

---

### 4. **Fee Transparency**
```typescript
interface FeeStructure {
  government_fee: number;
  service_fees: {
    partner_fees: number;
    compliance: number;
    payment_processing: number;
    process_upkeep: number;
  };
  total: number;
}
```

**Display**: Itemized breakdown, no hidden fees.

---

### 5. **Add-On Ecosystem**
```typescript
interface AddOn {
  key: string;
  name: string;
  description: string;
  fee_amount: number;
  enabled: boolean;
  primary: boolean; // Featured add-on
}
```

**Types**:
- eSIM (1GB, 3GB, 5GB, 10GB)
- Travel insurance
- Itinerary generation
- Concierge service

---

### 6. **Passport OCR Settings**
```typescript
interface PassportOCRSettings {
  skip_blur_detection: boolean;
  skip_glare_detection: boolean;
  skip_fingers_detection: boolean;
  use_strict_fingers_detection_model: boolean;
  enable_travel_doc_check: boolean;
}
```

**Tech**: OpenCV + Tesseract OCR.

---

### 7. **Photo Validation (ICAO Compliance)**
```typescript
interface PhotoValidation {
  restrict_invalid_photo: boolean;
  restrict_multiple_faces: boolean;
  restrict_face_outside_of_frame: boolean;
  restrict_closed_eyes: boolean;
  restrict_glasses: boolean;
  restrict_teeth_visibility: boolean;
  restrict_hair_in_front: boolean;
}
```

**Purpose**: Embassy-compliant biometric photos.

---

### 8. **Visa Risk Factors**
```typescript
interface VisaRisks {
  expired_passport: boolean;
  insufficient_funds: boolean;
  criminal_record: boolean;
  previous_visa_violations: boolean;
  invalid_insurance: boolean;
}
```

**Use**: Pre-qualification checks, show rejection probability.

---

### 9. **Family Application Support**
```typescript
interface Component {
  family_enabled: boolean; // Allow batch input
}
```

**UX**: Fill once, apply to all family members.

---

### 10. **Multi-Tenant (B2B/B2C)**
```typescript
interface DevOptions {
  only_b2b: boolean; // Travel agents
  only_b2c: boolean; // Direct consumers
  b2e_enabled: boolean; // Enterprise
}
```

**Future**: Build B2B portal for travel agents.

---

## 📊 Core Tables (Simplified)

### Essential Schema
```
countries
├── entry_processes
│   ├── additional_questions
│   ├── components_required
│   ├── add_ons
│   ├── fee_structure
│   ├── eta_settings
│   ├── dev_options
│   ├── passport_ocr_settings
│   └── photo_validation_settings
├── visa_risks
├── partners
└── faqs
```

---

## 🔑 Key Data Structures

### Country
```json
{
  "name": "Thailand",
  "iso2_code": "TH",
  "supported": true,
  "currency": "INR",
  "hero_image": {
    "url": "https://media.atlys.com/...",
    "dimensions": { "width": 4896, "height": 3029 }
  }
}
```

### Entry Process
```json
{
  "process_name": "Thailand TDAC",
  "destination_country": "TH",
  "purpose": "tourism",
  "process_type": "electronic_travel_authorisation",
  "process_type_label": "TDAC",
  "process_physical": false,
  "entry_validity": { "amount": 90, "units": "days" },
  "entry_length_stay": { "amount": 30, "units": "days" }
}
```

### Component Required
```json
{
  "key": "passport",
  "attributes": ["validity_required", "image_required"],
  "family_enabled": true,
  "only_b2b": true,
  "toggle": true
}
```

---

## 🚀 Implementation Priority

### MVP (Phase 1)
1. **Countries table** with ISO codes
2. **Entry processes** (5-10 popular destinations)
3. **Components required** (passport, photo, basic docs)
4. **Fee structure** (transparent breakdown)
5. **Simple ETA** (fixed durations)

### Phase 2
1. **Additional questions** (dynamic forms)
2. **Passport OCR** (basic blur/glare detection)
3. **Photo validation** (face detection)
4. **Add-ons** (eSIM integration)

### Phase 3
1. **Family applications**
2. **Risk scoring** (rejection probability)
3. **Dynamic ETA** (AI-adjusted)
4. **B2B portal**

---

## 💡 Our Competitive Advantages

### What We'll Do Better:
1. **Simpler Data Model** → Faster development
2. **Portrait Design** → Warm, personal UX
3. **India-First** → Aadhaar, PAN, ITR support
4. **Transparent Pricing** → No hidden VFS fees
5. **Clearer UX** → Less decision fatigue

### What We'll Skip (For Now):
1. **50+ dev_options** → Start with 10 essential flags
2. **100+ countries** → Focus on top 20 Indian destinations
3. **B2E** → Start with B2C, add B2B later
4. **Complex assortment** → Single-country visas first

---

## 🛠️ Tech Stack Comparison

| Feature | Atlys | Our Approach |
|---------|-------|--------------|
| **Framework** | React/Next.js | Next.js 16 App Router |
| **Database** | PostgreSQL | PostgreSQL |
| **ORM** | Prisma/TypeORM | **Drizzle ORM** (simpler) |
| **Styling** | Styled Components? | **Tailwind + Portrait** |
| **Auth** | Custom? | **NextAuth.js** |
| **File Upload** | Cloudinary | **AWS S3** (cost-effective) |
| **OCR** | Custom ML | **AWS Textract** (faster) |
| **Payment** | Razorpay + Stripe | **Razorpay** (India-first) |

---

## 📝 Database Schema Starter

### Minimal Viable Schema
```sql
-- Core tables
CREATE TABLE countries (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  iso2_code CHAR(2) UNIQUE,
  supported BOOLEAN DEFAULT TRUE
);

CREATE TABLE entry_processes (
  id UUID PRIMARY KEY,
  country_id UUID REFERENCES countries(id),
  process_name VARCHAR(100),
  process_type VARCHAR(50),
  purpose VARCHAR(50) DEFAULT 'tourism',
  entry_validity_days INTEGER,
  entry_length_stay_days INTEGER,
  government_fee DECIMAL(10,2),
  service_fee DECIMAL(10,2),
  eta_hours INTEGER,
  family_enabled BOOLEAN DEFAULT FALSE
);

CREATE TABLE components_required (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  component_key VARCHAR(50), -- 'passport', 'photo', 'pan_card'
  required BOOLEAN DEFAULT TRUE,
  family_enabled BOOLEAN DEFAULT FALSE
);

CREATE TABLE additional_questions (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  question_key VARCHAR(50),
  label TEXT,
  question_type VARCHAR(50),
  required BOOLEAN DEFAULT FALSE
);

CREATE TABLE add_ons (
  id UUID PRIMARY KEY,
  entry_process_id UUID REFERENCES entry_processes(id),
  addon_key VARCHAR(50),
  name VARCHAR(100),
  description TEXT,
  price DECIMAL(10,2),
  enabled BOOLEAN DEFAULT FALSE
);
```

---

## 🎨 UX Improvements Over Atlys

### 1. **Clearer Process Steps**
Atlys: 5-7 steps with confusing navigation  
**Us**: 3 clear steps with progress bar

### 2. **Fewer Form Fields**
Atlys: 20+ fields per application  
**Us**: 12-15 essential fields, auto-fill rest

### 3. **Visual Document Upload**
Atlys: Plain upload buttons  
**Us**: Polaroid-style preview cards (Portrait design)

### 4. **Transparent Pricing**
Atlys: Hidden fees mentioned in FAQ  
**Us**: Upfront breakdown on first screen

### 5. **Personal Guidance**
Atlys: Corporate tone  
**Us**: Friendly, helpful copy (Priya's first visa journey)

---

## 🔍 Questions to Research

1. **What OCR service does Atlys use?**
   - Custom model or AWS/Google?
   - Accuracy rates?

2. **How do they handle family applications?**
   - Separate applications or batch?
   - Pricing model?

3. **What's their rejection rate?**
   - Risk scoring accuracy?
   - Insurance claim rate?

4. **eSIM provider?**
   - Airalo? Direct carrier deals?
   - Margin on eSIM sales?

5. **B2B pricing model?**
   - Commission structure?
   - API access?

---

## 📅 Next Steps

### This Week:
- [ ] Create Drizzle schema based on this analysis
- [ ] Set up countries + entry_processes tables
- [ ] Build component system (passport, photo)
- [ ] Design fee structure UI

### Next Week:
- [ ] Passport OCR research (AWS Textract vs custom)
- [ ] Photo validation service (AWS Rekognition)
- [ ] eSIM provider research (Airalo API)

### This Month:
- [ ] MVP with 5 countries (Thailand, Dubai, Singapore, UK, USA)
- [ ] Basic document upload
- [ ] Transparent pricing
- [ ] Simple ETA display

---

**Last Updated**: 2026-08-17  
**Owner**: Development Team  
**Review**: Weekly
