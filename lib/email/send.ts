import 'server-only';
import path from 'node:path';
import { getFromAddress, getMailer, isEmailConfigured } from '@/lib/email/transport';

export const LOGO_CID = 'viserv-logo';

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('[email] Gmail is not configured; skipping:', input.subject);
    return false;
  }

  const mailer = getMailer();
  if (!mailer) return false;

  try {
    await mailer.sendMail({
      from: getFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(process.cwd(), 'public', 'logo.png'),
          cid: LOGO_CID,
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('[email] Failed to send:', input.subject, error);
    return false;
  }
}
