import 'server-only';
import { sendEmail } from '@/lib/email/send';
import { renderEmail } from '@/lib/email/templates';

const SYNTHETIC_EMAIL_SUFFIX = '@users.local';

export function isDeliverableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed.includes('@')) return false;
  return !trimmed.toLowerCase().endsWith(SYNTHETIC_EMAIL_SUFFIX);
}

export function resolveApplicantEmail(input: {
  accountEmail?: string | null;
  passportEmail?: string | null;
}): string | null {
  if (isDeliverableEmail(input.accountEmail)) return input.accountEmail.trim();
  if (isDeliverableEmail(input.passportEmail)) return input.passportEmail.trim();
  return null;
}

export async function notifyUserWelcome(input: {
  name: string;
  email: string;
}): Promise<void> {
  if (!isDeliverableEmail(input.email)) return;

  await sendEmail({
    to: input.email.trim(),
    subject: 'Welcome to Viserv',
    html: renderEmail({
      preheader: 'Your Viserv account is ready.',
      heading: `Welcome, ${input.name}`,
      paragraphs: [
        'Your Viserv account is ready. Sign in to track visa applications and pick up where you left off.',
      ],
      buttonLabel: 'Sign in',
      buttonHref: '/login',
    }),
  });
}

export async function notifyReviewerWelcome(input: {
  name: string;
  email: string;
}): Promise<void> {
  if (!isDeliverableEmail(input.email)) return;

  await sendEmail({
    to: input.email.trim(),
    subject: 'Welcome to Viserv — reviewer access',
    html: renderEmail({
      preheader: 'You now have reviewer access on Viserv.',
      heading: `Welcome, ${input.name}`,
      paragraphs: [
        'An admin created a reviewer account for you. Sign in with the email and password they shared to review visa applications.',
      ],
      buttonLabel: 'Sign in',
      buttonHref: '/login',
    }),
  });
}

export async function notifyVisaSubmittedToApplicant(input: {
  accountEmail?: string | null;
  passportEmail?: string | null;
  applicantName: string;
  country: string;
  visaType: string;
  applicationId: string;
}): Promise<void> {
  const to = resolveApplicantEmail(input);
  if (!to) {
    console.warn(
      '[email] No deliverable applicant email; skipping submit confirmation',
      input.applicationId
    );
    return;
  }

  await sendEmail({
    to,
    subject: `Visa application received — ${input.country}`,
    html: renderEmail({
      preheader: 'We received your visa application.',
      heading: 'Application received',
      paragraphs: [
        `Hi ${input.applicantName}, we received your visa application and will review it shortly.`,
      ],
      details: [
        { label: 'Destination', value: input.country },
        { label: 'Visa', value: input.visaType },
        { label: 'Reference', value: input.applicationId },
      ],
      buttonLabel: 'View application',
      buttonHref: `/applications/visa/${input.applicationId}`,
    }),
  });
}

export async function notifyVisaSubmittedToAdmin(input: {
  applicantName: string;
  phone?: string | null;
  country: string;
  visaType: string;
  applicationId: string;
}): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (!to) {
    console.warn('[email] ADMIN_NOTIFY_EMAIL is not set; skipping new visa notice');
    return;
  }

  await sendEmail({
    to,
    subject: `New visa request — ${input.applicantName}`,
    html: renderEmail({
      preheader: 'A new visa application was submitted.',
      heading: 'New visa request',
      paragraphs: ['A traveller just submitted a visa application.'],
      details: [
        { label: 'Applicant', value: input.applicantName },
        { label: 'Phone', value: input.phone?.trim() || '—' },
        { label: 'Destination', value: input.country },
        { label: 'Visa', value: input.visaType },
        { label: 'Reference', value: input.applicationId },
      ],
      buttonLabel: 'Open in admin',
      buttonHref: `/admin/applications/visa/${input.applicationId}`,
    }),
  });
}

export async function notifyReviewerAssigned(input: {
  email: string;
  reviewerName: string;
  applicantName: string;
  country: string;
  visaType: string;
  applicationId: string;
}): Promise<void> {
  if (!isDeliverableEmail(input.email)) return;

  await sendEmail({
    to: input.email.trim(),
    subject: `Visa application assigned to you — ${input.applicantName}`,
    html: renderEmail({
      preheader: 'A visa application was assigned to you.',
      heading: 'Assigned to you',
      paragraphs: [
        `Hi ${input.reviewerName}, a visa application is now on your queue.`,
      ],
      details: [
        { label: 'Applicant', value: input.applicantName },
        { label: 'Destination', value: input.country },
        { label: 'Visa', value: input.visaType },
        { label: 'Reference', value: input.applicationId },
      ],
      buttonLabel: 'Open application',
      buttonHref: `/admin/applications/visa/${input.applicationId}`,
    }),
  });
}

export async function notifyCorrectionRequested(input: {
  to: string;
  applicantName: string;
  country: string;
  visaType: string;
  applicationId: string;
  message: string;
}): Promise<void> {
  if (!isDeliverableEmail(input.to)) return;
  await sendEmail({
    to: input.to.trim(),
    subject: `Action needed on your visa application — ${input.country}`,
    html: renderEmail({
      preheader: 'A reviewer asked you to update your visa application.',
      heading: 'Please update your application',
      paragraphs: [
        `Hi ${input.applicantName}, we need a few updates before we can continue your visa application.`,
        input.message,
      ],
      details: [
        { label: 'Destination', value: input.country },
        { label: 'Visa', value: input.visaType },
        { label: 'Reference', value: input.applicationId },
      ],
      buttonLabel: 'Fix now',
      buttonHref: `/applications/visa/${input.applicationId}/fix`,
    }),
  });
}

export async function notifyCorrectionResubmitted(input: {
  to: string;
  reviewerName: string;
  applicantName: string;
  country: string;
  visaType: string;
  applicationId: string;
}): Promise<void> {
  if (!isDeliverableEmail(input.to)) return;
  await sendEmail({
    to: input.to.trim(),
    subject: `Updates received — ${input.applicantName}`,
    html: renderEmail({
      preheader: 'An applicant sent the requested updates.',
      heading: 'Applicant sent updates',
      paragraphs: [
        `Hi ${input.reviewerName}, ${input.applicantName} updated the items you asked for.`,
      ],
      details: [
        { label: 'Applicant', value: input.applicantName },
        { label: 'Destination', value: input.country },
        { label: 'Visa', value: input.visaType },
        { label: 'Reference', value: input.applicationId },
      ],
      buttonLabel: 'Review updates',
      buttonHref: `/admin/applications/visa/${input.applicationId}`,
    }),
  });
}

export async function notifyNewComment(input: {
  to: string;
  recipientName: string;
  authorName: string;
  country: string;
  visaType: string;
  applicationId: string;
  excerpt: string;
  href: string;
}): Promise<void> {
  if (!isDeliverableEmail(input.to)) return;
  await sendEmail({
    to: input.to.trim(),
    subject: `New comment on a visa application — ${input.country}`,
    html: renderEmail({
      preheader: `${input.authorName} commented on a visa application.`,
      heading: 'New comment',
      paragraphs: [
        `Hi ${input.recipientName}, ${input.authorName} wrote:`,
        input.excerpt,
      ],
      details: [
        { label: 'Destination', value: input.country },
        { label: 'Visa', value: input.visaType },
        { label: 'Reference', value: input.applicationId },
      ],
      buttonLabel: 'Open conversation',
      buttonHref: input.href,
    }),
  });
}

export async function notifyStatusChanged(input: {
  to: string;
  recipientName: string;
  country: string;
  visaType: string;
  applicationId: string;
  newStatus: string;
  href: string;
  notes?: string | null;
}): Promise<void> {
  if (!isDeliverableEmail(input.to)) return;
  const readable = input.newStatus.replace(/_/g, ' ');
  await sendEmail({
    to: input.to.trim(),
    subject: `Visa application ${readable} — ${input.country}`,
    html: renderEmail({
      preheader: `Status is now ${readable}.`,
      heading: `Status: ${readable}`,
      paragraphs: [
        `Hi ${input.recipientName}, a visa application status changed to ${readable}.`,
        ...(input.notes?.trim() ? [input.notes.trim()] : []),
      ],
      details: [
        { label: 'Destination', value: input.country },
        { label: 'Visa', value: input.visaType },
        { label: 'Reference', value: input.applicationId },
      ],
      buttonLabel: 'View application',
      buttonHref: input.href,
    }),
  });
}
