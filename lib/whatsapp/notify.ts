import 'server-only';

import {
  sendWhatsAppContent,
  toWhatsAppAddress,
} from '@/lib/whatsapp/client';
import {
  recipientFromUserPhone,
  resolveAdminWhatsAppRecipients,
  resolveUserWhatsApp,
  type WhatsAppRecipient,
} from '@/lib/whatsapp/resolve';

function sid(envKey: string): string {
  return process.env[envKey]?.trim() ?? '';
}

function vars(values: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  values.forEach((value, index) => {
    out[String(index + 1)] = value;
  });
  return out;
}

async function sendToRecipient(
  recipient: WhatsAppRecipient,
  contentSid: string,
  variables: string[],
  label: string
): Promise<void> {
  await sendWhatsAppContent({
    to: recipient.to,
    contentSid,
    variables: vars(variables),
    label,
  });
}

async function sendSafely(task: Promise<void>, label: string): Promise<void> {
  try {
    await task;
  } catch (error) {
    console.error(`[whatsapp] ${label} failed`, error);
  }
}

export async function notifyUserWelcomeWhatsApp(input: {
  userId: string;
  name: string;
  phone?: string | null;
}): Promise<void> {
  const recipient =
    recipientFromUserPhone({
      userId: input.userId,
      name: input.name,
      phone: input.phone,
    }) ?? (await resolveUserWhatsApp(input.userId));
  if (!recipient) return;

  await sendSafely(
    sendToRecipient(
      recipient,
      sid('TWILIO_WA_SID_USER_WELCOME'),
      [recipient.name],
      'user welcome'
    ),
    'user welcome'
  );
}

export async function notifyReviewerWelcomeWhatsApp(input: {
  userId?: string;
  name: string;
  phone: string;
}): Promise<void> {
  const recipient = recipientFromUserPhone({
    userId: input.userId ?? 'reviewer',
    name: input.name,
    phone: input.phone,
  });
  if (!recipient) return;

  await sendSafely(
    sendToRecipient(
      recipient,
      sid('TWILIO_WA_SID_REVIEWER_WELCOME'),
      [recipient.name],
      'reviewer welcome'
    ),
    'reviewer welcome'
  );
}

export async function notifyVisaSubmittedToApplicantWhatsApp(input: {
  userId: string;
  applicantName: string;
  phone?: string | null;
  country: string;
  visaType: string;
  applicationId: string;
}): Promise<void> {
  const recipient =
    recipientFromUserPhone({
      userId: input.userId,
      name: input.applicantName,
      phone: input.phone,
    }) ?? (await resolveUserWhatsApp(input.userId));
  if (!recipient) return;

  await sendSafely(
    sendToRecipient(
      recipient,
      sid('TWILIO_WA_SID_VISA_SUBMITTED_APPLICANT'),
      [
        input.applicantName,
        input.country,
        input.visaType,
        input.applicationId,
      ],
      'visa submitted applicant'
    ),
    'visa submitted applicant'
  );
}

export async function notifyVisaSubmittedToAdminWhatsApp(input: {
  applicantName: string;
  /** Applicant users.phone for display in the template body */
  phone?: string | null;
  country: string;
  visaType: string;
  applicationId: string;
}): Promise<void> {
  const admins = await resolveAdminWhatsAppRecipients();
  if (admins.length === 0) {
    console.warn(
      '[whatsapp] No admin users with phone; skipping visa submitted admin notice'
    );
    return;
  }

  const phoneDisplay = input.phone?.trim()
    ? recipientFromUserPhone({
        userId: 'applicant',
        name: input.applicantName,
        phone: input.phone,
      })?.phoneDisplay ?? input.phone.trim()
    : '—';

  await Promise.all(
    admins.map((admin) =>
      sendSafely(
        sendToRecipient(
          admin,
          sid('TWILIO_WA_SID_VISA_SUBMITTED_ADMIN'),
          [
            input.applicantName,
            phoneDisplay,
            input.country,
            input.visaType,
            input.applicationId,
          ],
          'visa submitted admin'
        ),
        'visa submitted admin'
      )
    )
  );
}

export async function notifyReviewerAssignedWhatsApp(input: {
  reviewerUserId: string;
  reviewerName: string;
  applicantName: string;
  country: string;
  visaType: string;
  applicationId: string;
}): Promise<void> {
  const recipient = await resolveUserWhatsApp(input.reviewerUserId);
  if (!recipient) return;

  await sendSafely(
    sendToRecipient(
      recipient,
      sid('TWILIO_WA_SID_REVIEWER_ASSIGNED'),
      [
        input.reviewerName || recipient.name,
        input.applicantName,
        input.country,
        input.visaType,
        input.applicationId,
      ],
      'reviewer assigned'
    ),
    'reviewer assigned'
  );
}

export async function notifyCorrectionRequestedWhatsApp(input: {
  userId: string;
  applicantName: string;
  country: string;
  visaType: string;
  applicationId: string;
  message: string;
}): Promise<void> {
  const recipient = await resolveUserWhatsApp(input.userId);
  if (!recipient) return;

  const message =
    input.message.length > 500
      ? `${input.message.slice(0, 497)}...`
      : input.message;

  await sendSafely(
    sendToRecipient(
      recipient,
      sid('TWILIO_WA_SID_CORRECTION_REQUESTED'),
      [
        input.applicantName || recipient.name,
        message,
        input.country,
        input.visaType,
        input.applicationId,
      ],
      'correction requested'
    ),
    'correction requested'
  );
}

export async function notifyCorrectionResubmittedWhatsApp(input: {
  recipientUserIds: string[];
  applicantName: string;
  country: string;
  visaType: string;
  applicationId: string;
}): Promise<void> {
  await Promise.all(
    [...new Set(input.recipientUserIds)].map(async (userId) => {
      const recipient = await resolveUserWhatsApp(userId);
      if (!recipient) return;
      await sendSafely(
        sendToRecipient(
          recipient,
          sid('TWILIO_WA_SID_CORRECTION_RESUBMITTED'),
          [
            recipient.name,
            input.applicantName,
            input.country,
            input.visaType,
            input.applicationId,
          ],
          'correction resubmitted'
        ),
        'correction resubmitted'
      );
    })
  );
}

export async function notifyNewCommentWhatsApp(input: {
  recipientUserId: string;
  recipientName: string;
  authorName: string;
  country: string;
  visaType: string;
  applicationId: string;
  excerpt: string;
  audience: 'applicant' | 'staff';
}): Promise<void> {
  const recipient = await resolveUserWhatsApp(input.recipientUserId);
  if (!recipient) return;

  const contentSid =
    input.audience === 'applicant'
      ? sid('TWILIO_WA_SID_NEW_COMMENT_APPLICANT')
      : sid('TWILIO_WA_SID_NEW_COMMENT_STAFF');

  const excerpt =
    input.excerpt.length > 280
      ? `${input.excerpt.slice(0, 277)}...`
      : input.excerpt;

  await sendSafely(
    sendToRecipient(
      recipient,
      contentSid,
      [
        input.recipientName || recipient.name,
        input.authorName,
        excerpt,
        input.country,
        input.visaType,
        input.applicationId,
      ],
      `new comment ${input.audience}`
    ),
    `new comment ${input.audience}`
  );
}

export async function notifyStatusChangedWhatsApp(input: {
  recipientUserId: string;
  recipientName: string;
  country: string;
  visaType: string;
  applicationId: string;
  newStatus: string;
  notes?: string | null;
  audience: 'applicant' | 'staff';
}): Promise<void> {
  const recipient = await resolveUserWhatsApp(input.recipientUserId);
  if (!recipient) return;

  const contentSid =
    input.audience === 'applicant'
      ? sid('TWILIO_WA_SID_STATUS_CHANGED_APPLICANT')
      : sid('TWILIO_WA_SID_STATUS_CHANGED_STAFF');

  const readable = input.newStatus.replace(/_/g, ' ');
  const notes = input.notes?.trim() || '—';

  await sendSafely(
    sendToRecipient(
      recipient,
      contentSid,
      [
        input.recipientName || recipient.name,
        readable,
        notes,
        input.country,
        input.visaType,
        input.applicationId,
      ],
      `status changed ${input.audience}`
    ),
    `status changed ${input.audience}`
  );
}

/**
 * Login OTP — sends to the requested mobile even if no users row exists yet.
 * Returns false when Twilio/SID is missing or the API fails (caller must fail the request).
 */
export async function sendLoginOtpWhatsApp(input: {
  phone: string;
  name: string;
  code: string;
}): Promise<boolean> {
  const contentSid = sid('TWILIO_WA_SID_LOGIN_OTP');
  if (!contentSid) {
    console.warn('[whatsapp] TWILIO_WA_SID_LOGIN_OTP missing; cannot send login OTP');
    return false;
  }

  const to = toWhatsAppAddress(`+91${input.phone}`);
  if (!to) {
    console.warn('[whatsapp] Invalid login OTP phone; cannot send');
    return false;
  }

  return sendWhatsAppContent({
    to,
    contentSid,
    variables: vars([input.name, input.code]),
    label: 'login otp',
  });
}
