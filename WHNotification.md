# Viserv — Twilio WhatsApp Notification Templates

Copy each block into **Twilio Console → Messaging → Content Template Builder** (or Content API) and submit for WhatsApp / Meta approval.

**Brand:** Viserv  
**Category (all):** `UTILITY`  
**Language:** `en`  
**Base URL:** replace `https://app.viserv.com` with your production `NEXTAUTH_URL` (no trailing slash)

### Approval tips
- Keep category **Utility** (transactional visa updates — not marketing).
- Do not start the body with a variable; put greeting text first.
- URL buttons can have **one** dynamic suffix only (`{{n}}` at the end of the path).
- Sample values below are required for approval — keep them realistic.
- After approval, map each `Template name` to the matching notify function in code.

| # | Template name | Maps to | Audience |
|---|---|---|---|
| 1 | `viserv_user_welcome` | `notifyUserWelcome` | Applicant |
| 2 | `viserv_reviewer_welcome` | `notifyReviewerWelcome` | Reviewer |
| 3 | `viserv_visa_submitted_applicant` | `notifyVisaSubmittedToApplicant` | Applicant |
| 4 | `viserv_visa_submitted_admin` | `notifyVisaSubmittedToAdmin` | Admin |
| 5 | `viserv_reviewer_assigned` | `notifyReviewerAssigned` | Reviewer |
| 6 | `viserv_correction_requested` | `notifyCorrectionRequested` | Applicant |
| 7 | `viserv_correction_resubmitted` | `notifyCorrectionResubmitted` | Reviewer / Admin |
| 8 | `viserv_new_comment` | `notifyNewComment` | Applicant or Staff |
| 9 | `viserv_status_changed` | `notifyStatusChanged` | Applicant + Staff |

---

## 1. User welcome

**Template name:** `viserv_user_welcome`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Registration → `notifyUserWelcome`

### Body (copy)
```
Hi {{1}}, welcome to Viserv. Your account is ready. Sign in to track visa applications and pick up where you left off.
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

## 2. Reviewer welcome

**Template name:** `viserv_reviewer_welcome`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Admin creates reviewer → `notifyReviewerWelcome`

### Body (copy)
```
Hi {{1}}, an admin created your Viserv reviewer account. Sign in with the email and password they shared to review visa applications.
```

### Variables
| Var | Meaning | Sample value |
|---|---|---|
| `{{1}}` | Reviewer name | Rajesh Kumar |

### Button (optional)
| Type | Text | URL |
|---|---|---|
| URL | Sign in | `https://app.viserv.com/login` |

---

## 3. Visa submitted — applicant

**Template name:** `viserv_visa_submitted_applicant`  
**Category:** Utility  
**Language:** English (`en`)  
**Maps to:** Submit application → `notifyVisaSubmittedToApplicant`

### Body (copy)
```
Hi {{1}}, we received your visa application and will review it shortly.

Destination: {{2}}
Visa: {{3}}
Reference: {{4}}
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
Hi {{1}}, we received your visa application and will review it shortly.

Destination: {{2}}
Visa: {{3}}
Reference: {{4}}
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
New visa request on Viserv.

Applicant: {{1}}
Phone: {{2}}
Destination: {{3}}
Visa: {{4}}
Reference: {{5}}
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
Hi {{1}}, a visa application is now on your Viserv queue.

Applicant: {{2}}
Destination: {{3}}
Visa: {{4}}
Reference: {{5}}
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
Hi {{1}}, we need a few updates before we can continue your visa application.

{{2}}

Destination: {{3}}
Visa: {{4}}
Reference: {{5}}
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
Hi {{1}}, {{2}} updated the items you asked for on Viserv.

Destination: {{3}}
Visa: {{4}}
Reference: {{5}}
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
Hi {{1}}, {{2}} commented on a visa application:

{{3}}

Destination: {{4}}
Visa: {{5}}
Reference: {{6}}
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
Hi {{1}}, your visa application status is now {{2}}.

{{3}}

Destination: {{4}}
Visa: {{5}}
Reference: {{6}}
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
Hi {{1}}, your {{2}} visa application for {{3}} is now under review. Reference: {{4}}.
```
Samples: Priya Sharma / Tourist Visa / United Arab Emirates / UUID  
Button: `https://app.viserv.com/applications/visa/{{4}}`

### 9d. `viserv_status_approved`
```
Hi {{1}}, your {{2}} visa application for {{3}} has been approved. Reference: {{4}}.
```
Samples: same pattern  
Button: `https://app.viserv.com/applications/visa/{{4}}`

### 9e. `viserv_status_rejected`
```
Hi {{1}}, your {{2}} visa application for {{3}} was not approved. {{4}} Reference: {{5}}.
```
| Var | Sample |
|---|---|
| `{{4}}` | Reason notes | Please check the comments on your application for next steps. |
| `{{5}}` | Application ID | UUID |

Button: `https://app.viserv.com/applications/visa/{{5}}`

---

## URL button note

WhatsApp / Meta URL buttons usually require:

1. Fixed prefix, e.g. `https://app.viserv.com/applications/visa/`
2. Exactly **one** dynamic path suffix variable, e.g. `{{1}}` → application UUID

In Twilio Content Template Builder:

- **Button type:** Visit website  
- **URL type:** Dynamic  
- **URL:** `https://app.viserv.com/applications/visa/{{1}}`  
- **Sample for `{{1}`:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

When the button URL uses `{{1}}`, body variables must still be numbered sequentially without gaps. Prefer putting the application id as the **last** body variable and reuse that index in the URL when the console allows; otherwise add a dedicated final URL-only variable.

---

## Quick copy checklist (submit in this order)

1. [ ] `viserv_user_welcome`
2. [ ] `viserv_reviewer_welcome`
3. [ ] `viserv_visa_submitted_applicant`
4. [ ] `viserv_visa_submitted_admin`
5. [ ] `viserv_reviewer_assigned`
6. [ ] `viserv_correction_requested`
7. [ ] `viserv_correction_resubmitted`
8. [ ] `viserv_new_comment_applicant` + `viserv_new_comment_staff`
9. [ ] `viserv_status_changed_applicant` + `viserv_status_changed_staff`  
   *(or optional 9c–9e if generic status is rejected)*

---

## Twilio send mapping (for later implementation)

| Event | Content SID / template name | To |
|---|---|---|
| User registers | `viserv_user_welcome` | Applicant phone |
| Reviewer created | `viserv_reviewer_welcome` | Reviewer phone |
| Visa submitted | `viserv_visa_submitted_applicant` | Applicant phone |
| Visa submitted | `viserv_visa_submitted_admin` | Admin WhatsApp |
| Reviewer assigned | `viserv_reviewer_assigned` | Reviewer phone |
| Correction requested | `viserv_correction_requested` | Applicant phone |
| Correction resubmitted | `viserv_correction_resubmitted` | Assigned reviewer (else admins) |
| New comment | `viserv_new_comment_*` | Opposite party |
| Status changed | `viserv_status_changed_*` | Applicant + staff audience |

Phone format for Twilio: `whatsapp:+91XXXXXXXXXX`

---

**Last updated:** 2026-10-19  
**Source of truth for copy:** `lib/email/notify.ts` + `lib/notifications.ts`
