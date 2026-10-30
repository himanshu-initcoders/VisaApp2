# Viserv WhatsApp Templates — Names & Examples

## `viserv_user_welcome`

```
Dear {{1}},

We're delighted to welcome you to Viserv. Your account is ready, and you can now track visa applications and continue from where you left off.

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

**Sample:** `{{1}}` = Priya Sharma

---

## `viserv_reviewer_welcome` — DENIED (do not resubmit)

```
Dear {{1}},

Your Viserv reviewer account has been created. Please sign in with the email and password shared with you to begin reviewing visa applications.

For any assistance, please contact your Viserv administrator.

Thank you for choosing Viserv.
```

---

## `viserv_reviewer_access`

```
Dear {{1}},

Your Viserv staff access is ready. You can sign in with the credentials already shared with you by email to review assigned visa applications.

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

**Sample:** `{{1}}` = Rajesh Kumar

---

## `viserv_visa_submitted_applicant`

```
Dear {{1}},

We're delighted to confirm that we have received your visa application. Our team will review it shortly.

Destination: {{2}}
Visa: {{3}}
Reference: {{4}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

**Samples:** Priya Sharma / United Arab Emirates / Tourist Visa / a1b2c3d4-e5f6-7890-abcd-ef1234567890

---

## `viserv_visa_submitted_admin`

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

**Samples:** Priya Sharma / +919876543210 / United Arab Emirates / Tourist Visa / a1b2c3d4-e5f6-7890-abcd-ef1234567890

---

## `viserv_reviewer_assigned`

```
Dear {{1}},

A visa application has been assigned to you and is ready for review.

Applicant: {{2}}
Destination: {{3}}
Visa: {{4}}
Reference: {{5}}

Thank you for choosing Viserv.
```

**Samples:** Rajesh Kumar / Priya Sharma / United Arab Emirates / Tourist Visa / a1b2c3d4-e5f6-7890-abcd-ef1234567890

---

## `viserv_correction_requested`

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

**Samples:** Priya Sharma / Please re-upload a clearer passport bio page and correct your travel date. / United Arab Emirates / Tourist Visa / a1b2c3d4-e5f6-7890-abcd-ef1234567890

---

## `viserv_correction_resubmitted`

```
Dear {{1}},

{{2}} has submitted the requested updates for their visa application. The file is ready for your review.

Destination: {{3}}
Visa: {{4}}
Reference: {{5}}

Thank you for choosing Viserv.
```

**Samples:** Rajesh Kumar / Priya Sharma / United Arab Emirates / Tourist Visa / a1b2c3d4-e5f6-7890-abcd-ef1234567890

---

## `viserv_new_comment`

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

**Samples:** Priya Sharma / Rajesh Kumar / Please confirm your hotel booking dates match the travel form. / United Arab Emirates / Tourist Visa / a1b2c3d4-e5f6-7890-abcd-ef1234567890

Also: `viserv_new_comment_applicant` · `viserv_new_comment_staff` (same body, different button URL)

---

## `viserv_status_changed`

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

**Samples:** Priya Sharma / under review / Documents look good. We are reviewing your case. / United Arab Emirates / Tourist Visa / a1b2c3d4-e5f6-7890-abcd-ef1234567890

Also: `viserv_status_changed_applicant` · `viserv_status_changed_staff` (same body, different button URL)

---

## `viserv_status_under_review` (optional)

```
Dear {{1}},

We're writing to confirm that your {{2}} visa application for {{3}} is now under review.

Reference: {{4}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

**Samples:** Priya Sharma / Tourist Visa / United Arab Emirates / UUID

---

## `viserv_status_approved` (optional)

```
Dear {{1}},

We're delighted to confirm that your {{2}} visa application for {{3}} has been approved.

Reference: {{4}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv. Have a wonderful trip!
```

**Samples:** Priya Sharma / Tourist Visa / United Arab Emirates / UUID

---

## `viserv_status_rejected` (optional)

```
Dear {{1}},

We're writing to inform you that your {{2}} visa application for {{3}} was not approved.

{{4}}

Reference: {{5}}

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

**Samples:** Priya Sharma / Tourist Visa / United Arab Emirates / Please check the comments on your application for next steps. / UUID

---

## `viserv_login_otp`

```
Dear {{1}},

Your Viserv login verification code is {{2}}. This code is valid for 10 minutes. Please enter it on the sign-in screen to continue. Do not share this code with anyone.

For any assistance, please contact us through your Viserv account.

Thank you for choosing Viserv.
```

**Samples:** `{{1}}` = Priya Sharma · `{{2}}` = 48291
