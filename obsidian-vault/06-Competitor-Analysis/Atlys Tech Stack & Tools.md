# Atlys Tech Stack & Tools

**Date**: 2026-08-17  
**Source**: Reverse-engineered from atlsdata.json

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  React/Next.js App                                          │
│  ├── B2C Portal (atlys.com)                                │
│  ├── B2B Portal (portal.atlys.com)                         │
│  └── B2E Dashboard (enterprise.atlys.com)                  │
│                                                              │
│  Components:                                                 │
│  ├── ProseMirror/TipTap (Rich Text Editor)                 │
│  ├── React Hook Form (Form Validation)                     │
│  ├── Cloudinary SDK (Image Upload)                         │
│  └── Stripe/Razorpay SDK (Payments)                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       API LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  Next.js API Routes / Express                               │
│  ├── REST API (JSON responses)                             │
│  ├── GraphQL? (unconfirmed)                                │
│  └── Webhook handlers                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  ├── Visa Processing Engine                                │
│  ├── ETA Calculation Service (ML-based)                    │
│  ├── Risk Scoring Algorithm                                │
│  ├── Fee Calculation Engine                                │
│  ├── Document Validation Service                           │
│  └── Notification Service                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL (Primary Database)                              │
│  ├── Countries & Entry Processes                           │
│  ├── User Applications                                      │
│  ├── Document Metadata                                      │
│  └── Payment Records                                        │
│                                                              │
│  Redis (Caching)                                            │
│  ├── Session storage                                        │
│  ├── ETA calculations                                       │
│  └── Rate limiting                                          │
│                                                              │
│  Elasticsearch (Search)                                     │
│  └── Country/Visa search                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                       │
├─────────────────────────────────────────────────────────────┤
│  ML/AI Services:                                            │
│  ├── Passport OCR (OpenCV + Tesseract)                     │
│  ├── Face Recognition (AWS Rekognition?)                   │
│  ├── Risk Scoring Model (TensorFlow?)                      │
│  └── Dynamic ETA Prediction (Custom ML)                    │
│                                                              │
│  Third-Party APIs:                                          │
│  ├── Stripe (Global Payments)                              │
│  ├── Razorpay (India Payments)                             │
│  ├── eSIM Provider (Airalo?)                               │
│  ├── Travel Insurance API                                   │
│  ├── Cloudinary (Image CDN)                                │
│  ├── Cloudflare Images (Alternative CDN)                   │
│  ├── Embassy APIs (Thailand, UAE, etc.)                    │
│  ├── VFS Global API                                        │
│  ├── SendGrid/AWS SES (Email)                              │
│  └── Twilio (SMS)                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Development Tools

### Frontend
| Tool | Purpose | Evidence |
|------|---------|----------|
| **React** | UI Framework | Component-based structure |
| **Next.js** | SSR/SSG | URL structure, API routes |
| **TypeScript** | Type Safety | Strict JSON schemas |
| **TipTap/ProseMirror** | Rich Text | FAQ answer format (JSON) |
| **React Hook Form** | Forms | Complex validation logic |
| **Zod** | Schema Validation | Type-safe JSON structures |
| **Tailwind CSS** | Styling | (Assumed - modern stack) |

### Backend
| Tool | Purpose | Evidence |
|------|---------|----------|
| **Node.js** | Runtime | Next.js/Express |
| **PostgreSQL** | Database | UUID PKs, JSONB columns |
| **Prisma/TypeORM** | ORM | Complex relations |
| **Redis** | Caching | (Inferred - ETA caching) |
| **Elasticsearch** | Search | (Inferred - country search) |

### ML/AI
| Tool | Purpose | Evidence |
|------|---------|----------|
| **OpenCV** | Image Processing | Blur/glare detection |
| **Tesseract OCR** | Text Extraction | Passport scanning |
| **TensorFlow** | ML Models | Risk scoring, ETA prediction |
| **AWS Rekognition** | Face Detection | Photo validation (15+ checks) |
| **Custom Models** | Domain-Specific | Rejection probability |

### DevOps
| Tool | Purpose | Evidence |
|------|---------|----------|
| **AWS/GCP** | Hosting | (Assumed - scale) |
| **Docker** | Containerization | (Standard for scale) |
| **GitHub Actions** | CI/CD | (Standard) |
| **Sentry** | Error Tracking | `last_edited_by` email tracking |
| **Mixpanel/Amplitude** | Analytics | (Inferred - A/B testing) |

### Infrastructure
| Tool | Purpose | Evidence |
|------|---------|----------|
| **Cloudinary** | Image CDN | `media.atlys.com` URLs |
| **Cloudflare** | CDN + DDoS | `imagedelivery.net` |
| **AWS S3** | Document Storage | (Standard for file uploads) |
| **AWS CloudFront** | CDN | (Likely) |
| **Let's Encrypt** | SSL | (Standard) |

---

## 🔍 Key Technologies Identified

### 1. **Cloudinary (Image CDN)**
```
URL Pattern: https://media.atlys.com/image/upload/f_auto,w_800/country_thumbnails/TH
```

**Features Used**:
- `f_auto`: Automatic format (WebP, AVIF)
- `w_800`: Resize to 800px width
- `country_thumbnails/`: Organized folders

**Cost**: ~$89/month (Advanced plan)

---

### 2. **Cloudflare Images**
```
URL Pattern: https://imagedelivery.net/W3Iz4WACAy2J0qT0cCT3xA/didi/articles/...
```

**Alternative CDN**: Lower cost, faster delivery in some regions.

---

### 3. **Passport OCR Engine**
```json
{
  "skip_blur_detection": false,
  "skip_glare_detection": false,
  "skip_fingers_detection": false,
  "use_strict_fingers_detection_model": true,
  "enable_travel_doc_check": false
}
```

**Likely Stack**:
- **OpenCV**: Image preprocessing
- **Tesseract OCR**: Text extraction
- **Custom TensorFlow Model**: Fingers detection

---

### 4. **Face Recognition (Photo Validation)**
```json
{
  "restrict_glasses": true,
  "restrict_closed_eyes": true,
  "restrict_teeth_visibility": true,
  "restrict_hair_in_front": true
}
```

**15 Validation Checks**:
1. Invalid photo
2. Multiple faces
3. Face outside frame
4. Covered face
5. Closed eyes
6. Glasses
7. Headcover
8. Not centered
9. Not straight
10. Improper lighting
11. Too close
12. Too far
13. Teeth visibility
14. Hair in front
15. Ears not visible

**Likely Service**: AWS Rekognition or Azure Face API

---

### 5. **Rich Text Editor (FAQs)**
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "attrs": { "textAlign": "left" },
      "content": [
        { "text": "Bold text", "marks": [{ "type": "bold" }] }
      ]
    }
  ]
}
```

**Tool**: TipTap or ProseMirror (ProseMirror JSON schema)

---

### 6. **Payment Processing**
**Indian Market**:
- **Razorpay**: Primary (UPI, Netbanking, Cards)
- **Currency**: INR pricing

**Global Market**:
- **Stripe**: Multi-currency support

---

### 7. **eSIM Integration**
```json
{
  "key": "esim_ten_gb",
  "currency": "INR",
  "fee_amount": 1065.1,
  "name": "10GB"
}
```

**Likely Provider**: Airalo API (largest eSIM marketplace)

---

### 8. **Email System**
```json
{
  "last_edited_by": "sameer@atlys.com"
}
```

**Evidence of Internal Team**:
- Email-based user tracking
- Likely using SendGrid or AWS SES

---

## 📊 Database Technology

### PostgreSQL Features Used:
```sql
-- UUID Primary Keys
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- JSONB Columns (flexible schemas)
dev_options JSONB DEFAULT '{}'
attributes JSONB DEFAULT '[]'

-- Array Columns
multi_trip_countries TEXT[]
days_off DATE[]

-- Enum Types (inferred)
process_type VARCHAR(50) -- Should be ENUM
question_type VARCHAR(50) -- Should be ENUM
```

**Why PostgreSQL**:
1. **JSONB support**: Flexible dev_options, attributes
2. **UUID support**: Distributed system-friendly
3. **Full-text search**: (Likely using ts_vector)
4. **Performance**: Handles 100+ countries × 50+ fields

---

## 🎯 Our Tech Stack (Comparison)

| Component | Atlys | Our Choice | Reason |
|-----------|-------|------------|--------|
| **Framework** | React/Next.js | **Next.js 16** | Latest features |
| **Database** | PostgreSQL | **PostgreSQL** | Same power |
| **ORM** | Prisma | **Drizzle ORM** | Simpler, faster |
| **Styling** | CSS-in-JS? | **Tailwind** | Faster dev |
| **Auth** | Custom | **NextAuth.js** | Battle-tested |
| **Images** | Cloudinary | **AWS S3** | Cost-effective |
| **OCR** | Custom ML | **AWS Textract** | Managed service |
| **Face API** | Custom? | **AWS Rekognition** | Easy integration |
| **Payments** | Razorpay+Stripe | **Razorpay** | India-first |
| **Email** | SendGrid? | **AWS SES** | Cheaper at scale |
| **Rich Text** | ProseMirror | **Markdown** | Simpler (initially) |

---

## 🚀 What We'll Build Differently

### 1. **Simpler Data Model**
**Atlys**: 15 tables, 50+ JSONB columns  
**Us**: 8-10 tables, minimal JSON

### 2. **Managed Services Over Custom ML**
**Atlys**: Custom OCR, face recognition  
**Us**: AWS Textract, Rekognition (faster to market)

### 3. **Drizzle ORM Over Prisma**
**Why**:
- Simpler migrations
- Better TypeScript integration
- Faster queries (raw SQL when needed)

### 4. **Tailwind Over CSS-in-JS**
**Why**:
- Faster development
- Portrait design system in utility classes
- Smaller bundle size

### 5. **Markdown Over Rich Text Editor**
**Why** (for MVP):
- Simpler content management
- No ProseMirror complexity
- Can upgrade later

---

## 💰 Cost Comparison (Estimated)

| Service | Atlys (Estimated) | Our Budget | Savings |
|---------|-------------------|------------|---------|
| **Cloudinary** | $89/month | AWS S3: $10/month | $79 |
| **Custom ML** | $500/month (servers) | AWS Rekognition: $50/month | $450 |
| **Elasticsearch** | $200/month | PostgreSQL FTS: $0 | $200 |
| **Redis** | $50/month | Skip initially | $50 |
| **Total** | ~$839/month | ~$60/month | **$779** |

**Key**: Use managed services, PostgreSQL built-ins, skip unnecessary complexity.

---

## 🔐 Security Tools (Inferred)

1. **SSL/TLS**: Let's Encrypt (free)
2. **DDoS Protection**: Cloudflare
3. **WAF**: Cloudflare WAF
4. **Rate Limiting**: Redis + Cloudflare
5. **Secrets Management**: AWS Secrets Manager?
6. **Compliance**: PCI DSS (Stripe/Razorpay handle this)

---

## 📱 Mobile Apps

**Evidence**:
```json
{
  "ios_min_version": "2.5.0",
  "android_min_version": 25
}
```

**Tech Stack** (Inferred):
- **React Native**: Cross-platform
- **Expo**: Rapid development
- **Deep Linking**: For email notifications

**Our Approach**: PWA first, native apps later.

---

## 🎓 Key Learnings

### What Impressed Us:
1. **Comprehensive data model** - Every edge case covered
2. **ML-powered validation** - Reduces rejections
3. **Feature flags everywhere** - Safe rollout
4. **Multi-tenant from day 1** - B2B/B2C/B2E
5. **Dynamic ETA** - AI-adjusted timelines

### What We'll Avoid:
1. **Over-engineering** - 50+ dev options is too much
2. **Custom ML too early** - Use managed services first
3. **Complex rich text** - Markdown is enough for MVP
4. **100+ countries** - Focus on top 20
5. **Redis dependency** - PostgreSQL can handle initial scale

---

## 📚 Resources to Explore

### APIs to Integrate:
1. **AWS Textract**: Passport OCR
2. **AWS Rekognition**: Face validation
3. **Razorpay**: Payments
4. **Airalo API**: eSIM
5. **VFS Global API**: Embassy integration (if available)

### Tools to Try:
1. **Drizzle ORM**: Database migrations
2. **NextAuth.js**: Authentication
3. **React Hook Form**: Form validation
4. **Zod**: Schema validation
5. **Sentry**: Error tracking

---

## 🎯 Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Next.js 16 setup
- [ ] PostgreSQL + Drizzle
- [ ] NextAuth.js
- [ ] Basic UI (Portrait design)

### Phase 2: Document Upload (Week 3-4)
- [ ] AWS S3 integration
- [ ] Passport OCR (AWS Textract)
- [ ] Photo validation (AWS Rekognition)

### Phase 3: Payment Integration (Week 5-6)
- [ ] Razorpay setup
- [ ] Fee calculation engine
- [ ] Order management

### Phase 4: Add-Ons (Week 7-8)
- [ ] eSIM integration (Airalo)
- [ ] Travel insurance API
- [ ] Itinerary generator (simple version)

---

**Last Updated**: 2026-08-17  
**Analyzed By**: Claude + Development Team  
**Next Review**: Post-MVP launch
