import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notifications, users, visaApplications } from '@/lib/db/schema';
import {
  isDeliverableEmail,
  notifyCorrectionRequested,
  notifyCorrectionResubmitted,
  notifyNewComment,
  notifyStatusChanged,
  resolveApplicantEmail,
} from '@/lib/email/notify';

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
  userId: string;
  applicantName: string | null;
  country: string | null;
  countryCode: string | null;
  visaType: string;
  assignedReviewerId: string | null;
  accountEmail: string | null;
  accountName: string | null;
  passportEmail: string | null;
}

async function loadVisaContext(applicationId: string): Promise<VisaContext | null> {
  const [row] = await db
    .select({
      id: visaApplications.id,
      userId: visaApplications.userId,
      applicantName: visaApplications.applicantName,
      country: visaApplications.country,
      countryCode: visaApplications.countryCode,
      visaType: visaApplications.visaType,
      assignedReviewerId: visaApplications.assignedReviewerId,
      travellers: visaApplications.travellers,
      accountEmail: users.email,
      accountName: users.name,
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
    userId: row.userId,
    applicantName: row.applicantName,
    country: row.country,
    countryCode: row.countryCode,
    visaType: row.visaType,
    assignedReviewerId: row.assignedReviewerId,
    accountEmail: row.accountEmail,
    accountName: row.accountName,
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

export async function notifyCorrectionRequestedEvent(input: {
  applicationId: string;
  message: string;
}): Promise<void> {
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) return;
  const href = `/applications/visa/${visa.id}/fix`;
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
  if (!to) return;
  await sendSafely(
    notifyCorrectionRequested({
      to,
      applicantName: applicantLabel(visa),
      country: countryOf(visa),
      visaType: visa.visaType,
      applicationId: visa.id,
      message: input.message,
    }),
    'correction requested'
  );
}

export async function notifyCorrectionResubmittedEvent(input: {
  applicationId: string;
  excludeUserId?: string;
}): Promise<void> {
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) return;
  const audience = await staffAudience(visa, input.excludeUserId);
  const href = `/admin/applications/visa/${visa.id}`;
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
  await Promise.all(
    audience.emails.map((recipient) =>
      sendSafely(
        notifyCorrectionResubmitted({
          to: recipient.email,
          reviewerName: recipient.name,
          applicantName: applicantLabel(visa),
          country: countryOf(visa),
          visaType: visa.visaType,
          applicationId: visa.id,
        }),
        'correction resubmitted'
      )
    )
  );
}

export async function notifyCommentEvent(input: {
  applicationId: string;
  authorId: string;
  authorName: string;
  authorRole: 'applicant' | 'reviewer' | 'admin';
  body: string;
}): Promise<void> {
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) return;
  const excerpt = input.body.length > 280 ? `${input.body.slice(0, 277)}...` : input.body;
  const toApplicant = input.authorRole !== 'applicant';
  const href = toApplicant
    ? `/applications/visa/${visa.id}`
    : `/admin/applications/visa/${visa.id}`;
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
    if (!to) return;
    await sendSafely(
      notifyNewComment({
        to,
        recipientName: applicantLabel(visa),
        authorName: input.authorName,
        country: countryOf(visa),
        visaType: visa.visaType,
        applicationId: visa.id,
        excerpt,
        href,
      }),
      'staff comment'
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
  await Promise.all(
    audience.emails.map((recipient) =>
      sendSafely(
        notifyNewComment({
          to: recipient.email,
          recipientName: recipient.name,
          authorName: input.authorName,
          country: countryOf(visa),
          visaType: visa.visaType,
          applicationId: visa.id,
          excerpt,
          href,
        }),
        'applicant comment'
      )
    )
  );
}

export async function notifyStatusChangedEvent(input: {
  applicationId: string;
  actorId: string;
  newStatus: string;
  notes?: string | null;
}): Promise<void> {
  if (!STATUS_EMAILS.has(input.newStatus)) return;
  const visa = await loadVisaContext(input.applicationId);
  if (!visa) return;
  const readable = input.newStatus.replace(/_/g, ' ');
  const title = `Visa application is ${readable}`;
  const body = input.notes?.trim() || `${countryOf(visa)} · ${visa.visaType}`;

  if (visa.userId !== input.actorId) {
    const href = `/applications/visa/${visa.id}`;
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
          recipientName: applicantLabel(visa),
          country: countryOf(visa),
          visaType: visa.visaType,
          applicationId: visa.id,
          newStatus: input.newStatus,
          href,
          notes: input.notes,
        }),
        'status to applicant'
      );
    }
  }

  const audience = await staffAudience(visa, input.actorId);
  const href = `/admin/applications/visa/${visa.id}`;
  await insertNotifications({
    userIds: audience.userIds,
    applicationId: visa.id,
    type: 'status_changed',
    title,
    body,
    href,
  });
  await Promise.all(
    audience.emails.map((recipient) =>
      sendSafely(
        notifyStatusChanged({
          to: recipient.email,
          recipientName: recipient.name,
          country: countryOf(visa),
          visaType: visa.visaType,
          applicationId: visa.id,
          newStatus: input.newStatus,
          href,
          notes: input.notes,
        }),
        'status to staff'
      )
    )
  );
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
