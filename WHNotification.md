# Viserv — Twilio WhatsApp Notification Templates

Copy each block into **Twilio Console → Messaging → Content Template Builder** (or Content API) and submit for WhatsApp / Meta approval.

**Brand:** Viserv  
**Category (all):** `UTILITY`  
**Language:** `en`  
**Base URL:** replace `https://app.viserv.com` with your production `NEXTAUTH_URL` (no trailing slash)

### Voice (match TravelFirst-style client preference)

- Open with **Dear {{1}},** — never “Hi”, never “Dear User / Applicant”.
- Body: short, clear, transactional sentences.
- Close with **Thank you for choosing Viserv.** — never “Team Viserv”, never “Regards,”.
- Optional one-liner for help when useful: *For any assistance, please contact us through your Viserv account.*

### Approval tips
- Keep category **Utility** for transactional visa updates — not marketing.
- Login OTP: use full Utility sentences (`Dear {{1}},` … code is `{{2}}`). Do **not** submit a code-only body.
- Do not start a Utility body with a variable; put greeting text first (`Dear {{1}},` is fine).
- URL buttons can have **one** dynamic suffix only (`{{n}}` at the end of the path).
- Sample values below are required for approval — keep them realistic.
- After approval, map each `Template name` to the matching notify function in code.

| # | Template name | Maps to | Audience | Status |
|---|---|---|---|---|
| 1 | `viserv_user_welcome` | `notifyUserWelcome` | Applicant | Submit |
| 2a | `viserv_reviewer_welcome` | — | Reviewer | **Denied — do not resubmit** |
| 2b | `viserv_reviewer_access` | `notifyReviewerWelcome` · `TWILIO_WA_SID_REVIEWER_WELCOME` | Reviewer | **Submit (replacement)** |
| 3 | `viserv_visa_submitted_applicant` | `notifyVisaSubmittedToApplicant` | Applicant | Submit |
| 4 | `viserv_visa_submitted_admin` | `notifyVisaSubmittedToAdmin` | Admin | Submit |
| 5 | `viserv_reviewer_assigned` | `notifyReviewerAssigned` | Reviewer | Submit |
| 6 | `viserv_correction_requested` | `notifyCorrectionRequested` | Applicant | Submit |
| 7 | `viserv_correction_resubmitted` | `notifyCorrectionResubmitted` | Reviewer / Admin | Submit |
| 8 | `viserv_new_comment` | `notifyNewComment` | Applicant or Staff | Submit |
| 9 | `viserv_status_changed` | `notifyStatusChanged` | Applicant + Staff | Submit |
| 10 | `viserv_login_otp` | `requestOtp` (later) · `TWILIO_WA_SID_LOGIN_OTP` | Applicant | **Submit (Utility — full sentences)** |

---

## 1. User welcome

**Template name:** `viserv_user_welcome`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Registration → `notifyUserWelcome`

### Body (copy)

```
Dear {{1}},

We're delighted to welcome you to Viserv. Your account is ready, and you can now track visa applications and continue from where you left off.

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Applicant name | Priya Sharma |

### Button (optional)

| Type | Text | URL |
|---|---|---|
| URL | Sign in | `https://app.viserv.com/login` |

---

## 2a. Reviewer welcome — DENIED (do not resubmit)

**Template name:** `viserv_reviewer_welcome`  
**Status:** Denied by Meta — keep for history only. Use **2b** instead.

### Body (historical — rejected)

```
Dear {{1}},

Your Viserv reviewer account has been created. Please sign in with the email and password shared with you to begin reviewing visa applications.

For any assistance, please contact your Viserv administrator.

Thank you for choosing Viserv.
```

Likely denial triggers: “password shared with you”, soft invite-to-start language, “contact your Viserv administrator”.

---

## 2b. Reviewer access (replacement)

**Template name:** `viserv_reviewer_access`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Admin creates reviewer → `notifyReviewerWelcome`  
**Env after approval:** `TWILIO_WA_SID_REVIEWER_WELCOME` (reuse existing env key; no code rename)

### Body (copy)
```
Dear {{1}},

Your Viserv staff access is ready. You can sign in with the credentials already shared with you by email to review assigned visa applications.

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Reviewer name | Rajesh Kumar |

### Button
| Type | Text | URL |
|---|---|---|
| URL | Sign in | `https://app.viserv.com/login` |

**Why this should approve better:** no “password” in the WhatsApp body, no soft invite marketing, same Viserv Utility voice as approved templates.

---

## 3. Visa submitted — applicant

**Template name:** `viserv_visa_submitted_applicant`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Submit application → `notifyVisaSubmittedToApplicant`

### Body (copy)

```
Dear {{1}},

We're delighted to confirm that we have received your visa application. Our team will review it shortly.

Destination: {{2}}
Visa: {{3}}
Reference: {{4}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Applicant name | Priya Sharma |
| `{{2}}` | Country / destination | United Arab Emirates |
| `{{3}}` | Visa type | Tourist Visa |
| `{{4}}` | Application ID (UUID) | a1b2c3d4-e5f6-7890-abcd-ef1234567890 |

### Button

| Type | Text | URL |
|---|---|---|
| URL | View application | `https://app.viserv.com/applications/visa/{{4}}` |

> If Twilio/Meta only allow **one** dynamic URL variable and it must be the last path segment, use a dedicated URL var — see [URL button note](#url-button-note) at the bottom. Prefer keeping `{{4}}` as the application id in both body and URL when the builder allows it.

**Safer URL form (if builder requires a separate URL variable):**

### Body (alternate — use if URL var must be dedicated)

```
Dear {{1}},

We're delighted to confirm that we have received your visa application. Our team will review it shortly.

Destination: {{2}}
Visa: {{3}}
Reference: {{4}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

| Button URL | `https://app.viserv.com/applications/visa/{{5}}` |
| Sample `{{5}}` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

---

## 4. Visa submitted — admin

**Template name:** `viserv_visa_submitted_admin`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Submit application → `notifyVisaSubmittedToAdmin`  
**Recipient:** Admin WhatsApp number (same role as `ADMIN_NOTIFY_EMAIL`)

### Body (copy)

```
Dear Admin,

A new visa application has been submitted on Viserv and is ready for your attention.

Applicant: {{1}}
Phone: {{2}}
Destination: {{3}}
Visa: {{4}}
Reference: {{5}}

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Applicant name | Priya Sharma |
| `{{2}}` | Phone | +919876543210 |
| `{{3}}` | Country | United Arab Emirates |
| `{{4}}` | Visa type | Tourist Visa |
| `{{5}}` | Application ID | a1b2c3d4-e5f6-7890-abcd-ef1234567890 |

### Button

| Type | Text | URL |
|---|---|---|
| URL | Open in admin | `https://app.viserv.com/admin/applications/visa/{{5}}` |

**Safer URL form:** button `https://app.viserv.com/admin/applications/visa/{{6}}` with sample UUID matching `{{5}}`.

---

## 5. Reviewer assigned

**Template name:** `viserv_reviewer_assigned`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Assign reviewer → `notifyReviewerAssigned`

### Body (copy)

```
Dear {{1}},

A visa application has been assigned to you and is ready for review.

Applicant: {{2}}
Destination: {{3}}
Visa: {{4}}
Reference: {{5}}

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Reviewer name | Rajesh Kumar |
| `{{2}}` | Applicant name | Priya Sharma |
| `{{3}}` | Country | United Arab Emirates |
| `{{4}}` | Visa type | Tourist Visa |
| `{{5}}` | Application ID | a1b2c3d4-e5f6-7890-abcd-ef1234567890 |

### Button

| Type | Text | URL |
|---|---|---|
| URL | Open application | `https://app.viserv.com/admin/applications/visa/{{5}}` |

---

## 6. Correction requested (action needed)

**Template name:** `viserv_correction_requested`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Request correction → `notifyCorrectionRequested`  
**In-app type:** `correction_requested`

### Body (copy)

```
Dear {{1}},

We need a few updates before we can continue with your visa application. Please review the details below and submit the required corrections.

{{2}}

Destination: {{3}}
Visa: {{4}}
Reference: {{5}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Applicant name | Priya Sharma |
| `{{2}}` | Correction message from reviewer | Please re-upload a clearer passport bio page and correct your travel date. |
| `{{3}}` | Country | United Arab Emirates |
| `{{4}}` | Visa type | Tourist Visa |
| `{{5}}` | Application ID | a1b2c3d4-e5f6-7890-abcd-ef1234567890 |

### Button

| Type | Text | URL |
|---|---|---|
| URL | Fix now | `https://app.viserv.com/applications/visa/{{5}}/fix` |

**Safer URL form:**  
`https://app.viserv.com/applications/visa/{{6}}/fix`  
Sample `{{6}}`: same UUID as reference.

> Keep `{{2}}` under ~500 characters when sending so the full WhatsApp body stays readable.

---

## 7. Correction resubmitted

**Template name:** `viserv_correction_resubmitted`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Applicant sends updates → `notifyCorrectionResubmitted`  
**In-app type:** `correction_resubmitted`

### Body (copy)

```
Dear {{1}},

{{2}} has submitted the requested updates for their visa application. The file is ready for your review.

Destination: {{3}}
Visa: {{4}}
Reference: {{5}}

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Reviewer / admin name | Rajesh Kumar |
| `{{2}}` | Applicant name | Priya Sharma |
| `{{3}}` | Country | United Arab Emirates |
| `{{4}}` | Visa type | Tourist Visa |
| `{{5}}` | Application ID | a1b2c3d4-e5f6-7890-abcd-ef1234567890 |

### Button

| Type | Text | URL |
|---|---|---|
| URL | Review updates | `https://app.viserv.com/admin/applications/visa/{{5}}` |

---

## 8. New comment

**Template name:** `viserv_new_comment`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Comment posted → `notifyNewComment`  
**In-app types:** `staff_comment` / `applicant_comment`

Use the same template for applicant ↔ staff. Pass the correct deep link path segment in the URL variable.

### Body (copy)

```
Dear {{1}},

{{2}} has left a comment on a visa application:

{{3}}

Destination: {{4}}
Visa: {{5}}
Reference: {{6}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Recipient name | Priya Sharma |
| `{{2}}` | Author name | Rajesh Kumar |
| `{{3}}` | Comment excerpt (truncate ~280 chars in code) | Please confirm your hotel booking dates match the travel form. |
| `{{4}}` | Country | United Arab Emirates |
| `{{5}}` | Visa type | Tourist Visa |
| `{{6}}` | Application ID | a1b2c3d4-e5f6-7890-abcd-ef1234567890 |

### Buttons (pick one per send — or submit two templates)

**8a — to applicant** (`viserv_new_comment_applicant`)

| Type | Text | URL |
|---|---|---|
| URL | Open conversation | `https://app.viserv.com/applications/visa/{{6}}` |

**8b — to staff** (`viserv_new_comment_staff`)

| Type | Text | URL |
|---|---|---|
| URL | Open conversation | `https://app.viserv.com/admin/applications/visa/{{6}}` |

If you prefer **one** approved template only, omit the URL button and put the link in body as plain text is **not** allowed for utility CTA — better to submit **both** 8a and 8b with identical body.

---

## 9. Status changed

**Template name:** `viserv_status_changed`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Status update → `notifyStatusChanged`  
**In-app type:** `status_changed`  
**Fired only for:** `under_review`, `approved`, `rejected`

### Body (copy)

```
Dear {{1}},

We're writing to confirm that your visa application status is now {{2}}.

{{3}}

Destination: {{4}}
Visa: {{5}}
Reference: {{6}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

### Variables

| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Recipient name | Priya Sharma |
| `{{2}}` | Readable status | under review |
| `{{3}}` | Notes (or `—` if empty) | Documents look good. We are reviewing your case. |
| `{{4}}` | Country | United Arab Emirates |
| `{{5}}` | Visa type | Tourist Visa |
| `{{6}}` | Application ID | a1b2c3d4-e5f6-7890-abcd-ef1234567890 |

**Status sample values to list in approval notes:** `under review`, `approved`, `rejected`

### Buttons (submit two templates if needed)

**9a — to applicant** (`viserv_status_changed_applicant`)

| Type | Text | URL |
|---|---|---|
| URL | View application | `https://app.viserv.com/applications/visa/{{6}}` |

**9b — to staff** (`viserv_status_changed_staff`)

| Type | Text | URL |
|---|---|---|
| URL | View application | `https://app.viserv.com/admin/applications/visa/{{6}}` |

---

## Optional: status-specific templates (higher approval clarity)

If Meta rejects a generic status template, submit these three instead of #9.

### 9c. `viserv_status_under_review`

```
Dear {{1}},

We're writing to confirm that your {{2}} visa application for {{3}} is now under review.

Reference: {{4}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

Samples: Priya Sharma / Tourist Visa / United Arab Emirates / UUID  
Button: `https://app.viserv.com/applications/visa/{{4}}`

### 9d. `viserv_status_approved`

```
Dear {{1}},

We're delighted to confirm that your {{2}} visa application for {{3}} has been approved.

Reference: {{4}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv. Have a wonderful trip!
```

Samples: same pattern  
Button: `https://app.viserv.com/applications/visa/{{4}}`

### 9e. `viserv_status_rejected`

```
Dear {{1}},

We're writing to inform you that your {{2}} visa application for {{3}} was not approved.

{{4}}

Reference: {{5}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

| Var | Sample |
|---|---|
| `{{4}}` | Reason notes | Please check the comments on your application for next steps. |
| `{{5}}` | Application ID | UUID |

Button: `https://app.viserv.com/applications/visa/{{5}}`

---

## 10. Login OTP (applicant sign-in)

**Template name:** `viserv_login_otp`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Applicant OTP request → `requestOtp` (wire later)  
**Env after approval:** `TWILIO_WA_SID_LOGIN_OTP`

Submit as a normal **Utility** text template with full sentences — same voice as the other Viserv notices. Do **not** submit a code-only / bare-OTP body (Meta often rejects that). Put the OTP inside a clear sentence as `{{2}}`.

### Body (copy)

```
Dear {{1}},

Your Viserv login verification code is {{2}}. This code is valid for 10 minutes. Please enter it on the sign-in screen to continue. Do not share this code with anyone.

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

### Variables
| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Applicant name (or “Traveller” if name unknown) | Priya Sharma |
| `{{2}}` | 5-digit OTP (`mobileOtpSchema`) | 48291 |

### Button (optional)
| Type | Text | URL |
|---|---|---|
| URL | Sign in | `https://app.viserv.com/signin` |

### App note
Sending path today is **mock** in `lib/auth/otp.ts` (`AUTH_OTP_MODE=mock`). Real WhatsApp OTP send is a follow-up after Meta approves this template and `TWILIO_WA_SID_LOGIN_OTP` is set.

---

## URL button note

WhatsApp / Meta URL buttons usually require:

1. Fixed prefix, e.g. `https://app.viserv.com/applications/visa/`
2. Exactly **one** dynamic path suffix variable, e.g. `{{1}}` → application UUID

In Twilio Content Template Builder:

- **Button type:** Visit website  
- **URL type:** Dynamic  
- **URL:** `https://app.viserv.com/applications/visa/{{1}}`  
- **Sample for** `{{1}`**:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

When the button URL uses `{{1}}`, body variables must still be numbered sequentially without gaps. Prefer putting the application id as the **last** body variable and reuse that index in the URL when the console allows; otherwise add a dedicated final URL-only variable.

---

## Quick copy checklist (submit in this order)

1. [ ] `viserv_user_welcome`
2. [x] `viserv_reviewer_welcome` — **denied; do not resubmit**
2b. [ ] `viserv_reviewer_access` — **submit this instead**
3. [ ] `viserv_visa_submitted_applicant`
4. [ ] `viserv_visa_submitted_admin`
5. [ ] `viserv_reviewer_assigned`
6. [ ] `viserv_correction_requested`
7. [ ] `viserv_correction_resubmitted`
8. [ ] `viserv_new_comment_applicant` + `viserv_new_comment_staff`
9. [ ] `viserv_status_changed_applicant` + `viserv_status_changed_staff`  
   *(or optional 9c–9e if generic status is rejected)*
10. [ ] `viserv_login_otp` — Utility with full sentences (OTP as `{{2}}`, not code-only)

---

## Twilio send mapping (for later implementation)

| Event | Content SID / template name | Env | To |
|---|---|---|---|
| User registers | `viserv_user_welcome` | `TWILIO_WA_SID_USER_WELCOME` | Applicant phone |
| Reviewer created | `viserv_reviewer_access` | `TWILIO_WA_SID_REVIEWER_WELCOME` | Reviewer phone |
| Visa submitted | `viserv_visa_submitted_applicant` | `TWILIO_WA_SID_VISA_SUBMITTED_APPLICANT` | Applicant phone |
| Visa submitted | `viserv_visa_submitted_admin` | `TWILIO_WA_SID_VISA_SUBMITTED_ADMIN` | Admins with `users.phone` |
| Reviewer assigned | `viserv_reviewer_assigned` | `TWILIO_WA_SID_REVIEWER_ASSIGNED` | Reviewer phone |
| Correction requested | `viserv_correction_requested` | `TWILIO_WA_SID_CORRECTION_REQUESTED` | Applicant phone |
| Correction resubmitted | `viserv_correction_resubmitted` | `TWILIO_WA_SID_CORRECTION_RESUBMITTED` | Assigned reviewer (else admins) |
| New comment | `viserv_new_comment_*` | `TWILIO_WA_SID_NEW_COMMENT_*` | Opposite party |
| Status changed | `viserv_status_changed_*` | `TWILIO_WA_SID_STATUS_CHANGED_*` | Applicant + staff audience |
| Applicant login OTP | `viserv_login_otp` | `TWILIO_WA_SID_LOGIN_OTP` | Applicant phone (requested number) |

Phone format for Twilio: `whatsapp:+91XXXXXXXXXX`

---

**Last updated:** 2026-10-27  
**Voice reference:** TravelFirst booking confirmations (Dear / delighted to confirm / Thank you for choosing)  
**Source of truth for events:** `lib/email/notify.ts` + `lib/notifications.ts` + `lib/whatsapp/notify.ts`
