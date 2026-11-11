import { LOGO_CID } from '@/lib/email/send';

const INK = '#08304c';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${appBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Logo PNG is 1367×535 — keep email size proportional (~2.55:1). */
const LOGO_WIDTH = 160;
const LOGO_HEIGHT = 63;

function renderParagraphs(paragraphs: string[] | undefined): string {
  if (!paragraphs?.length) return '';
  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${INK};">${escapeHtml(paragraph)}</p>`
    )
    .join('');
}

export function renderEmail(input: {
  preheader: string;
  heading: string;
  paragraphs: string[];
  /** Large centered one-time code (OTP emails). */
  otpCode?: string;
  /** Shown under the OTP block when present. */
  paragraphsAfterOtp?: string[];
  details?: Array<{ label: string; value: string }>;
  buttonLabel?: string;
  buttonHref?: string;
}): string {
  const paragraphs = renderParagraphs(input.paragraphs);
  const paragraphsAfterOtp = renderParagraphs(input.paragraphsAfterOtp);

  const otpCode = input.otpCode?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 24px;">
        <tr>
          <td align="center" style="background:#f4f7fb;border-radius:16px;padding:28px 16px;">
            <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5c6b7a;text-align:center;">Verification code</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:40px;line-height:1.2;letter-spacing:0.28em;font-weight:700;color:${INK};text-align:center;">${escapeHtml(input.otpCode.trim())}</p>
          </td>
        </tr>
      </table>`
    : '';

  const details = input.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;">
        ${input.details
          .map(
            (row) => `<tr>
              <td style="padding:6px 12px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c6b7a;vertical-align:top;">${escapeHtml(row.label)}</td>
              <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${INK};font-weight:600;">${escapeHtml(row.value)}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '';

  const button =
    input.buttonLabel && input.buttonHref
      ? `<a href="${escapeHtml(absoluteUrl(input.buttonHref))}" style="display:inline-block;padding:12px 22px;background:${INK};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;border-radius:28px;">${escapeHtml(input.buttonLabel)}</a>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;padding:32px 28px;">
            <tr>
              <td>
                <img src="cid:${LOGO_CID}" alt="Viserv" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;max-width:100%;margin:0 0 24px;border:0;outline:none;text-decoration:none;" />
                <h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.2;color:${INK};font-weight:600;">${escapeHtml(input.heading)}</h1>
                ${paragraphs}
                ${otpCode}
                ${paragraphsAfterOtp}
                ${details}
                ${button}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
