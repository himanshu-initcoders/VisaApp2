import 'server-only';
import path from 'node:path';
import {
  getFromAddress,
  getMailer,
  isEmailConfigured,
  resetMailer,
} from '@/lib/email/transport';

export const LOGO_CID = 'viserv-logo';

/** Inline social icons for the shared email footer (PNG, not SVG — Outlook-safe). */
export const SOCIAL_ICON_CIDS = {
  instagram: 'viserv-instagram',
  linkedin: 'viserv-linkedin',
  facebook: 'viserv-facebook',
} as const;

export type EmailFileAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

const INLINE_IMAGE_ATTACHMENTS = [
  {
    filename: 'logo.png',
    path: path.join(process.cwd(), 'public', 'logo.png'),
    cid: LOGO_CID,
  },
  {
    filename: 'instagram.png',
    path: path.join(process.cwd(), 'public', 'email', 'instagram.png'),
    cid: SOCIAL_ICON_CIDS.instagram,
  },
  {
    filename: 'linkedin.png',
    path: path.join(process.cwd(), 'public', 'email', 'linkedin.png'),
    cid: SOCIAL_ICON_CIDS.linkedin,
  },
  {
    filename: 'facebook.png',
    path: path.join(process.cwd(), 'public', 'email', 'facebook.png'),
    cid: SOCIAL_ICON_CIDS.facebook,
  },
] as const;

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  fileAttachments?: EmailFileAttachment[];
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('[email] Zoho CPaaS is not configured; skipping:', input.subject);
    return false;
  }

  const attachments = [
    ...INLINE_IMAGE_ATTACHMENTS.map((image) => ({
      filename: image.filename,
      path: image.path,
      cid: image.cid,
      contentDisposition: 'inline' as const,
      contentType: 'image/png',
    })),
    ...(input.fileAttachments ?? []).map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
    })),
  ];

  // The first SMTP handshake on a cold connection often fails; retry once
  // on a new session so signup does not depend on the user clicking again.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const mailer = getMailer();
    if (!mailer) return false;

    try {
      await mailer.sendMail({
        from: getFromAddress(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        attachments,
      });
      return true;
    } catch (error) {
      console.error(
        `[email] Failed to send (attempt ${attempt}):`,
        input.subject,
        error
      );
      try {
        mailer.close();
      } catch {
        // The failed connection may already be closed.
      }
      resetMailer();
    }
  }

  return false;
}
