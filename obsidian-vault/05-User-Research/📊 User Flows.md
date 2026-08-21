# 📊 User Flows

← Back to [[🏠 Home]]

## Core User Flows

### 1. First-Time User Journey

#### Discovery → Sign Up
```mermaid
Landing Page
  → Hero CTA ("Get your visa in 3 steps")
  → Country/Visa Type Selection
  → Sign Up (create account)
  → Email Verification
  → Welcome Dashboard
```

**Key moments**:
- First impression: [[🎨 Design System Hub|Portrait design]] warmth
- Clear value proposition
- Low-friction sign up

---

### 2. Visa Application Flow

#### Start to Submission
```
Dashboard
  → "Apply for New Visa" CTA
  → Country Selection
  → Visa Type Selection (Tourist/Business/Student/etc.)
  → ↓
  Personal Information Form
  → Travel Information Form
  → Employment Information Form
  → ↓
  Document Upload
    → Passport Copy
    → Photo (with validation)
    → Supporting Docs
  → ↓
  Review & Confirm
  → Payment
  → Application Submitted
  → Confirmation + Tracking Number
```

**Design considerations**:
- Progress indicator at top
- Auto-save at each step
- Clear "Save & Continue Later" option
- [[🧩 Components Library#Photo Profile Card|Card components]] for document previews

**Validation points**:
- Email at sign up
- Phone number (OTP)
- Document quality check
- Photo specification check
- Payment verification

---

### 3. Passport Service Flow

#### New Passport Application
```
Dashboard
  → "Apply for Passport" CTA
  → Service Type Selection
    → New Passport
    → Passport Renewal
    → Update Details
  → ↓
  Personal Details Form
  → Address Proof Upload
  → Identity Proof Upload
  → Birth Certificate
  → ↓
  Police Verification Info
  → Appointment Slot Selection
  → ↓
  Review & Payment
  → Submission
  → Booking Confirmation
```

---

### 4. Application Tracking Flow

#### Checking Status
```
Dashboard
  → Applications List (all statuses visible)
  → Click Application Card
  → ↓
  Application Detail View
    → Timeline visualization
    → Current status
    → Next steps
    → Required actions (if any)
    → Document access
    → Support chat option
```

**Status stages**:
1. 🟡 Submitted
2. 🔵 Under Review
3. 🟢 Documents Verified
4. 🟣 Processing with Embassy
5. ✅ Approved / 🔴 Rejected
6. 📦 Documents Dispatched

---

### 5. Returning User Journey

#### Quick Re-Application
```
Login
  → Dashboard (sees past applications)
  → "Apply Again" button on previous application
  → ↓
  Pre-filled Form (from previous data)
  → Update only changed information
  → Upload current documents
  → Quick submission
```

**Time savings**: 70% reduction in form filling

---

### 6. Payment Flow

#### Checkout Process
```
Application Review Page
  → See Price Breakdown
    → Service Fee: ₹X
    → Government Fee: ₹Y
    → Rush Processing: ₹Z (optional)
    → Total: ₹Total
  → ↓
  Payment Method Selection
    → UPI
    → Card
    → Net Banking
  → ↓
  Payment Gateway
  → Payment Success
  → Invoice Generation
  → Return to Application Dashboard
```

---

## Secondary Flows

### Document Upload Sub-Flow
```
Upload Button
  → File Picker / Camera
  → Image Preview
  → Auto-validation
    → Size check
    → Format check
    → Quality check (for photos)
  → ↓
  [Pass] → Upload to S3 → Thumbnail in UI
  [Fail] → Error message → Re-upload option
```

### Support Request Flow
```
Help Button (anywhere in app)
  → Support Modal
    → FAQ Search
    → Live Chat
    → Email Support
    → Call Back Request
```

---

## Admin Flows

### Application Review (Admin)
```
Admin Dashboard
  → New Applications Queue
  → Select Application
  → ↓
  Review Documents
    → Verify each document
    → Mark as Valid/Invalid
    → Request additional documents
  → ↓
  Update Status
  → Add Internal Notes
  → Notify User
```

---

## Error & Edge Cases

### Document Rejection Flow
```
Admin marks document as invalid
  → System sends notification
  → User sees alert on dashboard
  → Click to view reason
  → Re-upload corrected document
  → Back to review queue
```

### Payment Failure Flow
```
Payment fails
  → User sees error message
  → Application saved as draft
  → "Retry Payment" option on dashboard
  → Can choose different payment method
```

### Application Expiry Flow
```
If incomplete after 30 days
  → Reminder email at day 25
  → Final reminder at day 29
  → Archive (not delete) at day 30
  → User can restore from archives
```

---

## Flow Diagrams

For visual flowcharts, create in:
- Excalidraw
- Mermaid (inline in Obsidian)
- Figma

---

## Related Notes
- [[👤 User Personas]]
- [[🔧 Features Roadmap]]
- [[🧩 Components Library]]
- [[⚙️ Technical Stack]]

---

**Tags**: #flows #ux #journey #user-experience #design
