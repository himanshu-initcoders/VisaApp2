import 'server-only';
import path from 'node:path';
import {
  getFromAddress,
  getMailer,
  isEmailConfigured,
  resetMailer,
} from '@/lib/email/transport';

export const LOGO_CID = 'viserv-logo';

export type EmailFileAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

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
    {
      filename: 'logo.png',
      path: path.join(process.cwd(), 'public', 'logo.png'),
      cid: LOGO_CID,
      contentDisposition: 'inline' as const,
      contentType: 'image/png',
    },
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
