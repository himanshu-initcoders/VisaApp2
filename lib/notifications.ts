import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  notifications,
  passportServices,
  users,
  visaApplicationTravellers,
  visaApplications,
} from '@/lib/db/schema';
import {
  isDeliverableEmail,
  notifyCorrectionRequested,
  notifyCorrectionResubmitted,
  notifyNewComment,
  notifyPassportCorrectionRequested,
  notifyPassportCorrectionResubmitted,
  notifyPassportNewComment,
  notifyPassportStatusChanged,
  notifyPassportSubmittedToAdmin,
  notifyPassportSubmittedToApplicant,
  notifyStatusChanged,
  notifyVisaOutcomeDelivered,
  resolveApplicantEmail,
} from '@/lib/email/notify';
import {
  notifyCorrectionRequestedWhatsApp,
  notifyCorrectionResubmittedWhatsApp,
  notifyNewCommentWhatsApp,
  notifyPassportCorrectionRequestedWhatsApp,
  notifyPassportCorrectionResubmittedWhatsApp,
  notifyPassportNewCommentWhatsApp,
  notifyPassportStatusChangedWhatsApp,
  notifyPassportSubmittedToAdminWhatsApp,
  notifyPassportSubmittedToApplicantWhatsApp,
  notifyStatusApprovedWithDocumentWhatsApp,
  notifyStatusChangedWhatsApp,
} from '@/lib/whatsapp/notify';
import { passportServiceTypeLabel } from '@/lib/passport/constants';
import { readStoredObject } from '@/lib/upload/readStoredObject';
import { buildWaMediaPublicUrl } from '@/lib/wa-media/token';
import { isPdfMime } from '@/lib/visa/outcomeDocumentShared';

const STATUS_EMAILS = new Set(['approved', 'rejected', 'under_review']);

export interface AppNotice {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
  type: string;
}

interface VisaContext {
  id: string;
  referenceNumber: string;
  userId: string;
  applicantName: string | null;
  country: string | null;
  countryCode: string | null;
  visaType: string;
  assignedReviewerId: string | null;
  accountEmail: string | null;
  accountName: string | null;
  accountPhone: string | null;
  passportEmail: string | null;
}

interface PassportNotifyContext {
  id: string;
  referenceNumber: string | null;
  userId: string;
  serviceType: string;
  productName: string | null;
  assignedReviewerId: string | null;
  accountEmail: string | null;
  accountName: string | null;
  accountPhone: string | null;
}

async function loadPassportNotifyContext(
  applicationId: string
): Promise<PassportNotifyContext | null> {
  const [row] = await db
    .select({
      id: passportServices.id,
      referenceNumber: passportServices.referenceNumber,
      userId: passportServices.userId,
      serviceType: passportServices.serviceType,
      formSnapshot: passportServices.formSnapshot,
      assignedReviewerId: passportServices.assignedReviewerId,
      accountEmail: users.email,
      accountName: users.name,
      accountPhone: users.phone,
    })
    .from(passportServices)
    .innerJoin(users, eq(passportServices.userId, users.id))
    .where(eq(passportServices.id, applicationId))
    .limit(1);

  if (!row) return null;
  const snapshot = row.formSnapshot as { productName?: string } | null;
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    userId: row.userId,
    serviceType: row.serviceType,
    productName:
      typeof snapshot?.productName === 'string' ? snapshot.productName : null,
    assignedReviewerId: row.assignedReviewerId,
    accountEmail: row.accountEmail,
    accountName: row.accountName,
    accountPhone: row.accountPhone,
  };
}

function passportApplicantLabel(passport: PassportNotifyContext) {
  return passport.accountName?.trim() || 'Applicant';
}

function passportServiceLabel(passport: PassportNotifyContext) {
  return passportServiceTypeLabel(passport.serviceType);
}

function passportProductLabel(passport: PassportNotifyContext) {
  return (
    passport.productName?.trim() ||
    (passport.serviceType === 'reissue' ? 'Passport reissue' : 'New passport')
  );
}

function passportRef(passport: PassportNotifyContext) {
  return passport.referenceNumber || passport.id;
}

async function passportStaffAudience(
  passport: PassportNotifyContext,
  excludeUserId?: string
): Promise<{ userIds: string[]; emails: Array<{ email: string; name: string }> }> {
  if (
    passport.assignedReviewerId &&
    passport.assignedReviewerId !== excludeUserId
  ) {
    const [reviewer] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, passport.assignedReviewerId))
      .limit(1);
    if (!reviewer) return { userIds: [], emails: [] };
    return {
      userIds: [reviewer.id],
      emails: isDeliverableEmail(reviewer.email)
        ? [{ email: reviewer.email, name: reviewer.name }]
        : [],
    };
  }
  if (passport.assignedReviewerId) return { userIds: [], emails: [] };

  const admins = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.deactivatedAt)));

  const userIds = admins
    .map((admin) => admin.id)
    .filter((id) => id !== excludeUserId);
  const fallback = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (fallback && isDeliverableEmail(fallback)) {
    return { userIds, emails: [{ email: fallback, name: 'Admin' }] };
  }
  return {
    userIds,
    emails: admins
      .filter((admin) => admin.id !== excludeUserId && isDeliverableEmail(admin.email))
      .map((admin) => ({ email: admin.email, name: admin.name })),
  };
}

async function loadVisaContext(applicationId: string): Promise<VisaContext | null> {
  const [row] = await db
    .select({
      id: visaApplications.id,
      referenceNumber: visaApplications.referenceNumber,
      userId: visaApplications.userId,
      applicantName: visaApplications.applicantName,
      country: visaApplications.country,
      countryCode: visaApplications.countryCode,
      visaType: visaApplications.visaType,
      assignedReviewerId: visaApplications.assignedReviewerId,
      travellers: visaApplications.travellers,
      accountEmail: users.email,
      accountName: users.name,
      accountPhone: users.phone,
    })
    .from(visaApplications)
    .innerJoin(users, eq(visaApplications.userId, users.id))
    .where(eq(visaApplications.id, applicationId))
    .limit(1);

  if (!row) return null;

  const travellers = Array.isArray(row.travellers) ? row.travellers : [];
  const first = travellers[0] as
    | { passportData?: { email?: string } | null }
    | undefined;
  const passportEmail =
    typeof first?.passportData?.email === 'string'
      ? first.passportData.email
      : null;

  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    userId: row.userId,
    applicantName: row.applicantName,
    country: row.country,
    countryCode: row.countryCode,
    visaType: row.visaType,
    assignedReviewerId: row.assignedReviewerId,
    accountEmail: row.accountEmail,
    accountName: row.accountName,
    accountPhone: row.accountPhone,
    passportEmail,
  };
}

async function insertNotifications(input: {
  userIds: string[];
  applicationId: string;
  type: string;
  title: string;
  body: string;
  href: string;
}) {
  const unique = [...new Set(input.userIds)];
  if (unique.length === 0) return;
  await db.insert(notifications).values(
    unique.map((userId) => ({
      userId,
      applicationId: input.applicationId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    }))
  );
}

async function sendSafely(task: Promise<void>, label: string) {
  try {
    await task;
  } catch (error) {
    console.error(`[email] ${label} failed`, error);
  }
}

async function staffAudience(
  visa: VisaContext,
  excludeUserId?: string
): Promise<{ userIds: string[]; emails: Array<{ email: string; name: string }> }> {
  if (
    visa.assignedReviewerId &&
    visa.assignedReviewerId !== excludeUserId
  ) {
    const [reviewer] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, visa.assignedReviewerId))
      .limit(1);
    if (!reviewer) return { userIds: [], emails: [] };
    return {
      userIds: [reviewer.id],
      emails: isDeliverableEmail(reviewer.email)
        ? [{ email: reviewer.email, name: reviewer.name }]
        : [],
    };
  }

  if (visa.assignedReviewerId) return { userIds: [], emails: [] };

  const admins = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.deactivatedAt)));

  const userIds = admins
    .map((admin) => admin.id)
    .filter((id) => id !== excludeUserId);
  const fallback = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (fallback && isDeliverableEmail(fallback)) {
    return { userIds, emails: [{ email: fallback, name: 'Admin' }] };
  }
  return {
    userIds,
    emails: admins
      .filter((admin) => admin.id !== excludeUserId && isDeliverableEmail(admin.email))
      .map((admin) => ({ email: admin.email, name: admin.name })),
  };
}

function countryOf(visa: VisaContext) {
  return visa.country || visa.countryCode || 'Visa';
}

function applicantLabel(visa: VisaContext) {
  return visa.applicantName || visa.accountName || 'Applicant';
}

/** Prefer the traveller whose status changed; fall back to case applicant. */
async function resolveStatusRecipientName(
  applicationId: string,
  travellerId?: string | null
): Promise<string | null> {
  if (!travellerId) return null;
  const [row] = await db
    .select({ name: visaApplicationTravellers.name })
    .from(visaApplicationTravellers)
    .where(
      and(
        eq(visaApplicationTravellers.id, travellerId),
        eq(visaApplicationTravellers.applicationId, applicationId)
      )
    )
    .limit(1);
  const name = row?.name?.trim();
  return name || null;
}

export async function notifyPassportSubmittedEvent(input: {
  applicationId: string;
  applicantName?: string | null;
  serviceType?: string | null;
  productName?: string | null;
  referenceNumber?: string | null;
  accountEmail?: string | null;
  accountPhone?: string | null;
  userId?: string | null;
}): Promise<void> {
  const passport = await loadPassportNotifyContext(input.applicationId);
  if (!passport && !input.userId) return;

  const userId = input.userId || passport!.userId;
  const applicantName =
    input.applicantName?.trim() ||
    (passport ? passportApplicantLabel(passport) : 'Applicant');
  const serviceType =
    input.serviceType?.trim() ||
    (passport ? passportServiceLabel(passport) : 'Passport');
  const productName =
    input.productName?.trim() ||
    (passport ? passportProductLabel(passport) : 'Passport');
  const referenceNumber =
    input.referenceNumber?.trim() ||
    (passport ? passportRef(passport) : input.applicationId);
  const accountEmail = input.accountEmail ?? passport?.accountEmail ?? null;
  const accountPhone = input.accountPhone ?? passport?.accountPhone ?? null;

  await sendSafely(
    notifyPassportSubmittedToApplicant({
      accountEmail,
      applicantName,
      serviceType,
      productName,
      referenceNumber,
    }),
    'passport submitted applicant'
  );
  await sendSafely(
    notifyPassportSubmittedToApplicantWhatsApp({
      userId,
      applicantName,
      phone: accountPhone,
      serviceType,
      productName,
      referenceNumber,
    }),
    'passport submitted applicant whatsapp'
  );
  await sendSafely(
    notifyPassportSubmittedToAdmin({
      applicantName,
      phone: accountPhone,
      serviceType,
      productName,
      referenceNumber,
    }),
    'passport submitted admin'
  );
  await sendSafely(
    notifyPassportSubmittedToAdminWhatsApp({
      applicantName,
      phone: accountPhone,
      serviceType,
      productName,
      referenceNumber,
    }),
    'passport submitted admin whatsapp'
  );
}

export async function notifyPassportCorrectionRequestedEvent(input: {
  applicationId: string;
  message: string;
}): Promise<void> {
  const passport = await loadPassportNotifyContext(input.applicationId);
  if (!passport) return;
  const ref = passportRef(passport);
  const href = `/applications/passport/${ref}/form`;
  const title = 'Updates needed on your passport application';
  const serviceType = passportServiceLabel(passport);
  const productName = passportProductLabel(passport);
  const applicantName = passportApplicantLabel(passport);
  await insertNotifications({
    userIds: [passport.userId],
    applicationId: passport.id,
    type: 'correction_requested',
    title,
    body: input.message,
    href,
  });
  const to = resolveApplicantEmail({ accountEmail: passport.accountEmail });
  if (to) {
    await sendSafely(
      notifyPassportCorrectionRequested({
        to,
        applicantName,
        serviceType,
        productName,
        referenceNumber: ref,
        message: input.message,
      }),
      'passport correction requested'
    );
  }
  await sendSafely(
    notifyPassportCorrectionRequestedWhatsApp({
      userId: passport.userId,
      applicantName,
      serviceType,
      productName,
      referenceNumber: ref,
      message: input.message,
    }),
    'passport correction requested whatsapp'
  );
}
export async function notifyPassportCorrectionResubmittedEvent(input: {
  applicationId: string;
  excludeUserId?: string;
}): Promise<void> {
  const passport = await loadPassportNotifyContext(input.applicationId);
  if (!passport) return;
  const audience = await passportStaffAudience(passport, input.excludeUserId);
  const ref = passportRef(passport);
  const href = `/admin/applications/passport/${ref}`;
  const serviceType = passportServiceLabel(passport);
  const productName = passportProductLabel(passport);
  const applicantName = passportApplicantLabel(passport);
  const title = `${applicantName} sent the requested updates`;
  const body = `Passport · ${productName}`;
  await insertNotifications({
    userIds: audience.userIds,
    applicationId: passport.id,
    type: 'correction_resubmitted',
    title,
    body,
    href,
  });
  await Promise.all([
    ...audience.emails.map((recipient) =>
      sendSafely(
        notifyPassportCorrectionResubmitted({
          to: recipient.email,
          reviewerName: recipient.name,
          applicantName,
          serviceType,
          productName,
          referenceNumber: ref,
        }),
        'passport correction resubmitted'
      )
    ),
    sendSafely(
      notifyPassportCorrectionResubmittedWhatsApp({
        recipientUserIds: audience.userIds,
        applicantName,
        serviceType,
        productName,
        referenceNumber: ref,
      }),
      'passport correction resubmitted whatsapp'
    ),
  ]);
}
export async function notifyCorrectionRequestedEvent(input: {
  applicationId: string;
  message: string;
}): Promise<void> {
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) return;
  const href = `/applications/visa/${visa.referenceNumber}/fix`;
  const title = 'Updates needed on your visa application';
  await insertNotifications({
    userIds: [visa.userId],
    applicationId: visa.id,
    type: 'correction_requested',
    title,
    body: input.message,
    href,
  });
  const to = resolveApplicantEmail({
    accountEmail: visa.accountEmail,
    passportEmail: visa.passportEmail,
  });
  if (to) {
    await sendSafely(
      notifyCorrectionRequested({
        to,
        applicantName: applicantLabel(visa),
        country: countryOf(visa),
        visaType: visa.visaType,
        referenceNumber: visa.referenceNumber,
        message: input.message,
      }),
      'correction requested'
    );
  }
  await sendSafely(
    notifyCorrectionRequestedWhatsApp({
      userId: visa.userId,
      applicantName: applicantLabel(visa),
      country: countryOf(visa),
      visaType: visa.visaType,
      referenceNumber: visa.referenceNumber,
      message: input.message,
    }),
    'correction requested whatsapp'
  );
}

export async function notifyCorrectionResubmittedEvent(input: {
  applicationId: string;
  excludeUserId?: string;
}): Promise<void> {
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) return;
  const audience = await staffAudience(visa, input.excludeUserId);
  const href = `/admin/applications/visa/${visa.referenceNumber}`;
  const title = `${applicantLabel(visa)} sent the requested updates`;
  const body = `${countryOf(visa)} · ${visa.visaType}`;
  await insertNotifications({
    userIds: audience.userIds,
    applicationId: visa.id,
    type: 'correction_resubmitted',
    title,
    body,
    href,
  });
  await Promise.all([
    ...audience.emails.map((recipient) =>
      sendSafely(
        notifyCorrectionResubmitted({
          to: recipient.email,
          reviewerName: recipient.name,
          applicantName: applicantLabel(visa),
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
        }),
        'correction resubmitted'
      )
    ),
    sendSafely(
      notifyCorrectionResubmittedWhatsApp({
        recipientUserIds: audience.userIds,
        applicantName: applicantLabel(visa),
        country: countryOf(visa),
        visaType: visa.visaType,
        referenceNumber: visa.referenceNumber,
      }),
      'correction resubmitted whatsapp'
    ),
  ]);
}

export async function notifyCommentEvent(input: {
  applicationId: string;
  authorId: string;
  authorName: string;
  authorRole: 'applicant' | 'reviewer' | 'admin';
  body: string;
}): Promise<void> {
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) {
    const passport = await loadPassportNotifyContext(input.applicationId);
    if (!passport) return;
    const excerpt =
      input.body.length > 280 ? `${input.body.slice(0, 277)}...` : input.body;
    const ref = passportRef(passport);
    const serviceType = passportServiceLabel(passport);
    const productName = passportProductLabel(passport);
    const applicantName = passportApplicantLabel(passport);
    const toApplicant = input.authorRole !== 'applicant';
    const href = toApplicant
      ? `/applications/passport/${ref}`
      : `/admin/applications/passport/${ref}`;
    const title = `New comment from ${input.authorName}`;

    if (toApplicant) {
      await insertNotifications({
        userIds: [passport.userId],
        applicationId: passport.id,
        type: 'staff_comment',
        title,
        body: excerpt,
        href,
      });
      const to = resolveApplicantEmail({ accountEmail: passport.accountEmail });
      if (to) {
        await sendSafely(
          notifyPassportNewComment({
            to,
            recipientName: applicantName,
            authorName: input.authorName,
            serviceType,
            productName,
            referenceNumber: ref,
            excerpt,
            href,
          }),
          'passport staff comment'
        );
      }
      await sendSafely(
        notifyPassportNewCommentWhatsApp({
          recipientUserId: passport.userId,
          recipientName: applicantName,
          authorName: input.authorName,
          serviceType,
          productName,
          referenceNumber: ref,
          excerpt,
          audience: 'applicant',
        }),
        'passport staff comment whatsapp'
      );
      return;
    }

    const audience = await passportStaffAudience(passport, input.authorId);
    await insertNotifications({
      userIds: audience.userIds,
      applicationId: passport.id,
      type: 'applicant_comment',
      title,
      body: excerpt,
      href,
    });
    await Promise.all([
      ...audience.emails.map((recipient) =>
        sendSafely(
          notifyPassportNewComment({
            to: recipient.email,
            recipientName: recipient.name,
            authorName: input.authorName,
            serviceType,
            productName,
            referenceNumber: ref,
            excerpt,
            href,
          }),
          'passport applicant comment'
        )
      ),
      ...audience.userIds.map((userId) =>
        sendSafely(
          notifyPassportNewCommentWhatsApp({
            recipientUserId: userId,
            recipientName: '',
            authorName: input.authorName,
            serviceType,
            productName,
            referenceNumber: ref,
            excerpt,
            audience: 'staff',
          }),
          'passport applicant comment whatsapp'
        )
      ),
    ]);
    return;
  }
  const excerpt = input.body.length > 280 ? `${input.body.slice(0, 277)}...` : input.body;
  const toApplicant = input.authorRole !== 'applicant';
  const href = toApplicant
    ? `/applications/visa/${visa.referenceNumber}`
    : `/admin/applications/visa/${visa.referenceNumber}`;
  const title = `New comment from ${input.authorName}`;

  if (toApplicant) {
    await insertNotifications({
      userIds: [visa.userId],
      applicationId: visa.id,
      type: 'staff_comment',
      title,
      body: excerpt,
      href,
    });
    const to = resolveApplicantEmail({
      accountEmail: visa.accountEmail,
      passportEmail: visa.passportEmail,
    });
    if (to) {
      await sendSafely(
        notifyNewComment({
          to,
          recipientName: applicantLabel(visa),
          authorName: input.authorName,
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
          excerpt,
          href,
        }),
        'staff comment'
      );
    }
    await sendSafely(
      notifyNewCommentWhatsApp({
        recipientUserId: visa.userId,
        recipientName: applicantLabel(visa),
        authorName: input.authorName,
        country: countryOf(visa),
        visaType: visa.visaType,
        referenceNumber: visa.referenceNumber,
        excerpt,
        audience: 'applicant',
      }),
      'staff comment whatsapp'
    );
    return;
  }

  const audience = await staffAudience(visa, input.authorId);
  await insertNotifications({
    userIds: audience.userIds,
    applicationId: visa.id,
    type: 'applicant_comment',
    title,
    body: excerpt,
    href,
  });
  await Promise.all([
    ...audience.emails.map((recipient) =>
      sendSafely(
        notifyNewComment({
          to: recipient.email,
          recipientName: recipient.name,
          authorName: input.authorName,
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
          excerpt,
          href,
        }),
        'applicant comment'
      )
    ),
    ...audience.userIds.map((userId) =>
      sendSafely(
        notifyNewCommentWhatsApp({
          recipientUserId: userId,
          recipientName: '',
          authorName: input.authorName,
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
          excerpt,
          audience: 'staff',
        }),
        'applicant comment whatsapp'
      )
    ),
  ]);
}

export type StatusDeliveryPayload = {
  documentId: string;
  s3Key: string;
  filename: string;
  mimeType: string;
  sendToChannels: boolean;
};

async function loadPdfAttachment(delivery: StatusDeliveryPayload): Promise<{
  filename: string;
  content: Buffer;
  contentType: string;
} | null> {
  if (!delivery.sendToChannels || !isPdfMime(delivery.mimeType)) return null;
  const stored = await readStoredObject(delivery.s3Key);
  if (!stored) {
    console.error('[email] Could not read delivery PDF', delivery.s3Key);
    return null;
  }
  const filename = delivery.filename?.endsWith('.pdf')
    ? delivery.filename
    : `${delivery.filename || 'visa-document'}.pdf`;
  return {
    filename,
    content: stored.buffer,
    contentType: 'application/pdf',
  };
}

export async function notifyStatusChangedEvent(input: {
  applicationId: string;
  actorId: string;
  newStatus: string;
  notes?: string | null;
  travellerId?: string | null;
  applicationType?: 'visa' | 'passport';
  /** When rejecting multiple travellers, comma-separated names for WhatsApp/email. */
  recipientNameOverride?: string | null;
  delivery?: StatusDeliveryPayload | null;
}): Promise<void> {
  if (!STATUS_EMAILS.has(input.newStatus)) return;
  if (input.applicationType === 'passport') {
    const passport = await loadPassportNotifyContext(input.applicationId);
    if (!passport) return;
    const readable = input.newStatus.replace(/_/g, ' ');
    const recipientName = passportApplicantLabel(passport);
    const serviceType = passportServiceLabel(passport);
    const productName = passportProductLabel(passport);
    const ref = passportRef(passport);
    const title = `Passport application is ${readable}`;
    const body = input.notes?.trim() || productName;
    const href = `/applications/passport/${ref}`;
    if (passport.userId !== input.actorId) {
      await insertNotifications({
        userIds: [passport.userId],
        applicationId: passport.id,
        type: 'status_changed',
        title,
        body,
        href,
      });
      const to = resolveApplicantEmail({
        accountEmail: passport.accountEmail,
      });
      if (to) {
        await sendSafely(
          notifyPassportStatusChanged({
            to,
            recipientName,
            serviceType,
            productName,
            referenceNumber: ref,
            newStatus: input.newStatus,
            href,
            notes: input.notes,
          }),
          'passport status to applicant'
        );
      }
      await sendSafely(
        notifyPassportStatusChangedWhatsApp({
          recipientUserId: passport.userId,
          recipientName,
          serviceType,
          productName,
          referenceNumber: ref,
          newStatus: input.newStatus,
          notes: input.notes,
          audience: 'applicant',
        }),
        'passport status whatsapp'
      );
    }

    const audience = await passportStaffAudience(passport, input.actorId);
    const staffHref = `/admin/applications/passport/${ref}`;
    await insertNotifications({
      userIds: audience.userIds,
      applicationId: passport.id,
      type: 'status_changed',
      title,
      body,
      href: staffHref,
    });
    await Promise.all([
      ...audience.emails.map((recipient) =>
        sendSafely(
          notifyPassportStatusChanged({
            to: recipient.email,
            recipientName: recipient.name,
            serviceType,
            productName,
            referenceNumber: ref,
            newStatus: input.newStatus,
            href: staffHref,
            notes: input.notes,
          }),
          'passport status to staff'
        )
      ),
      ...audience.userIds.map((userId) =>
        sendSafely(
          notifyPassportStatusChangedWhatsApp({
            recipientUserId: userId,
            recipientName: '',
            serviceType,
            productName,
            referenceNumber: ref,
            newStatus: input.newStatus,
            notes: input.notes,
            audience: 'staff',
          }),
          'passport status to staff whatsapp'
        )
      ),
    ]);
    return;
  }
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) return;
  const travellerName = await resolveStatusRecipientName(
    visa.id,
    input.travellerId
  );
  const recipientName =
    input.recipientNameOverride?.trim() ||
    travellerName ||
    applicantLabel(visa);
  const readable = input.newStatus.replace(/_/g, ' ');
  const title = input.recipientNameOverride?.trim()
    ? `Visa update for ${input.recipientNameOverride.trim()}: ${readable}`
    : travellerName
      ? `${travellerName}'s visa is ${readable}`
      : `Visa application is ${readable}`;
  const body = input.notes?.trim() || `${countryOf(visa)} · ${visa.visaType}`;
  const sendDelivery =
    input.newStatus === 'approved' &&
    Boolean(input.delivery?.sendToChannels) &&
    isPdfMime(input.delivery?.mimeType);
  const fileAttachment =
    sendDelivery && input.delivery
      ? await loadPdfAttachment(input.delivery)
      : null;
  const mediaUrl =
    sendDelivery && input.delivery
      ? buildWaMediaPublicUrl(input.delivery.documentId)
      : null;

  if (visa.userId !== input.actorId) {
    const href = `/applications/visa/${visa.referenceNumber}`;
    await insertNotifications({
      userIds: [visa.userId],
      applicationId: visa.id,
      type: 'status_changed',
      title,
      body,
      href,
    });
    const to = resolveApplicantEmail({
      accountEmail: visa.accountEmail,
      passportEmail: visa.passportEmail,
    });
    if (to) {
      await sendSafely(
        notifyStatusChanged({
          to,
          recipientName,
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
          newStatus: input.newStatus,
          href,
          notes: input.notes,
          fileAttachment,
        }),
        'status to applicant'
      );
    }
    let sentMediaWhatsApp = false;
    if (sendDelivery && mediaUrl) {
      try {
        sentMediaWhatsApp = await notifyStatusApprovedWithDocumentWhatsApp({
          recipientUserId: visa.userId,
          recipientName,
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
          notes: input.notes,
          mediaPathVariable: mediaUrl.pathVariable,
        });
      } catch (error) {
        console.error('[email] status approved with document whatsapp failed', error);
      }
    }
    if (!sentMediaWhatsApp) {
      await sendSafely(
        notifyStatusChangedWhatsApp({
          recipientUserId: visa.userId,
          recipientName,
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
          newStatus: input.newStatus,
          notes: input.notes,
          audience: 'applicant',
        }),
        'status to applicant whatsapp'
      );
    }
  }

  const audience = await staffAudience(visa, input.actorId);
  const href = `/admin/applications/visa/${visa.referenceNumber}`;
  await insertNotifications({
    userIds: audience.userIds,
    applicationId: visa.id,
    type: 'status_changed',
    title,
    body,
    href,
  });
  await Promise.all([
    ...audience.emails.map((recipient) =>
      sendSafely(
        notifyStatusChanged({
          to: recipient.email,
          recipientName: recipient.name,
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
          newStatus: input.newStatus,
          href,
          notes: input.notes,
        }),
        'status to staff'
      )
    ),
    ...audience.userIds.map((userId) =>
      sendSafely(
        notifyStatusChangedWhatsApp({
          recipientUserId: userId,
          recipientName: '',
          country: countryOf(visa),
          visaType: visa.visaType,
          referenceNumber: visa.referenceNumber,
          newStatus: input.newStatus,
          notes: input.notes,
          audience: 'staff',
        }),
        'status to staff whatsapp'
      )
    ),
  ]);
}

/** Post-approve attach: email + media WA only (no plain status notify). */
export async function notifyVisaOutcomeDeliveredEvent(input: {
  applicationId: string;
  travellerId?: string | null;
  delivery: StatusDeliveryPayload;
}): Promise<void> {
  if (!input.delivery.sendToChannels || !isPdfMime(input.delivery.mimeType)) {
    return;
  }
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) return;
  const travellerName = await resolveStatusRecipientName(
    visa.id,
    input.travellerId
  );
  const recipientName = travellerName || applicantLabel(visa);

  const href = `/applications/visa/${visa.referenceNumber}`;
  await insertNotifications({
    userIds: [visa.userId],
    applicationId: visa.id,
    type: 'visa_outcome_delivered',
    title: travellerName
      ? `${travellerName}'s visa document is ready`
      : 'Your visa document is ready',
    body: `${countryOf(visa)} · ${visa.visaType}`,
    href,
  });

  const fileAttachment = await loadPdfAttachment(input.delivery);
  const mediaUrl = buildWaMediaPublicUrl(input.delivery.documentId);
  const to = resolveApplicantEmail({
    accountEmail: visa.accountEmail,
    passportEmail: visa.passportEmail,
  });

  if (to && fileAttachment) {
    await sendSafely(
      notifyVisaOutcomeDelivered({
        to,
        recipientName,
        country: countryOf(visa),
        visaType: visa.visaType,
        referenceNumber: visa.referenceNumber,
        href,
        fileAttachment,
      }),
      'visa outcome email'
    );
  }

  if (mediaUrl) {
    try {
      await notifyStatusApprovedWithDocumentWhatsApp({
        recipientUserId: visa.userId,
        recipientName,
        country: countryOf(visa),
        visaType: visa.visaType,
        referenceNumber: visa.referenceNumber,
        notes: 'Your visa document is attached.',
        mediaPathVariable: mediaUrl.pathVariable,
      });
    } catch (error) {
      console.error('[email] visa outcome whatsapp failed', error);
    }
  }
}

export async function listNotifications(
  userId: string,
  limit = 8
): Promise<{ unread: number; items: AppNotice[] }> {
  const [items, unreadRows] = await Promise.all([
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        type: notifications.type,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);

  return { unread: unreadRows.length, items };
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function markApplicationNotificationsRead(
  userId: string,
  applicationId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.applicationId, applicationId),
        isNull(notifications.readAt)
      )
    );
}

export async function hasUnreadStaffComment(
  userId: string,
  applicationId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.applicationId, applicationId),
        eq(notifications.type, 'staff_comment'),
        isNull(notifications.readAt)
      )
    )
    .limit(1);

  return Boolean(row);
}

export async function markStaffCommentNotificationsRead(
  userId: string,
  applicationId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.applicationId, applicationId),
        eq(notifications.type, 'staff_comment'),
        isNull(notifications.readAt)
      )
    );
}
