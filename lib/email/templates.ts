import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_DISPLAY,
} from '@/lib/contact';
import { LOGO_CID, SOCIAL_ICON_CIDS } from '@/lib/email/send';
import { SITE_NAME, SOCIAL_PROFILES } from '@/lib/seo/site';

const INK = '#08304c';
const TEAL = '#084e72';
const MUTED = '#5c6b7a';
const CANVAS = '#f4f7fb';
const WHITE = '#ffffff';
const DIVIDER = '#e6edf5';

/** Portrait rainbow accent — table cells (gradients are unreliable in email). */
const RAINBOW_STOPS = [
  '#26c0ff',
  '#e600c2',
  '#ff6b35',
  '#ffd60a',
  '#06d6a0',
  '#118ab2',
];

/** Logo PNG is 1367×535 — keep email size proportional (~2.55:1). */
const LOGO_WIDTH = 160;
const LOGO_HEIGHT = 63;

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

function renderParagraphs(paragraphs: string[] | undefined): string {
  if (!paragraphs?.length) return '';
  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${INK};">${escapeHtml(paragraph)}</p>`
    )
    .join('');
}

function renderRainbowStrip(): string {
  const cells = RAINBOW_STOPS.map(
    (color) =>
      `<td style="background:${color};height:4px;font-size:0;line-height:0;">&nbsp;</td>`
  ).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr>${cells}</tr>
  </table>`;
}

function renderEmailHeader(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding:0;">
        ${renderRainbowStrip()}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:28px 28px 20px;text-align:center;">
        <a href="${escapeHtml(appBaseUrl())}" style="display:inline-block;text-decoration:none;">
          <img src="cid:${LOGO_CID}" alt="${escapeHtml(SITE_NAME)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display:block;margin:0 auto;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;max-width:100%;border:0;outline:none;text-decoration:none;" />
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="border-bottom:1px solid ${DIVIDER};font-size:0;line-height:0;height:1px;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

const SOCIAL_ICON_SIZE = 36;

function renderSocialLinks(): string {
  const links = SOCIAL_PROFILES.map((profile) => {
    const cid = SOCIAL_ICON_CIDS[profile.network];
    return `<td style="padding:0 8px;vertical-align:top;">
        <a href="${escapeHtml(profile.href)}" style="display:inline-block;text-decoration:none;text-align:center;" title="${escapeHtml(profile.label)}">
          <img src="cid:${cid}" alt="${escapeHtml(profile.label)}" width="${SOCIAL_ICON_SIZE}" height="${SOCIAL_ICON_SIZE}" style="display:block;margin:0 auto;width:${SOCIAL_ICON_SIZE}px;height:${SOCIAL_ICON_SIZE}px;border:0;outline:none;text-decoration:none;" />
          <span style="display:block;margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;color:${MUTED};">${escapeHtml(profile.label)}</span>
        </a>
      </td>`;
  }).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px;">
    <tr>
      ${links}
    </tr>
  </table>`;
}

function renderEmailFooter(): string {
  const year = new Date().getFullYear();
  const privacyHref = absoluteUrl('/privacy');
  const termsHref = absoluteUrl('/terms');
  const refundHref = absoluteUrl('/refund');

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding:8px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="border-top:1px solid ${DIVIDER};font-size:0;line-height:0;height:1px;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px 8px;text-align:center;">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};">
          Need help with your application?
        </p>
        <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};">
          <a href="mailto:${escapeHtml(CONTACT_EMAIL)}" style="color:${TEAL};text-decoration:none;font-weight:600;">${escapeHtml(CONTACT_EMAIL)}</a>
          <span style="color:${DIVIDER};padding:0 8px;">·</span>
          <a href="tel:${escapeHtml(CONTACT_PHONE)}" style="color:${TEAL};text-decoration:none;font-weight:600;">${escapeHtml(CONTACT_PHONE_DISPLAY)}</a>
        </p>
        ${renderSocialLinks()}
        <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};">
          <a href="${escapeHtml(privacyHref)}" style="color:${MUTED};text-decoration:underline;">Privacy</a>
          <span style="padding:0 6px;color:${DIVIDER};">·</span>
          <a href="${escapeHtml(termsHref)}" style="color:${MUTED};text-decoration:underline;">Terms</a>
          <span style="padding:0 6px;color:${DIVIDER};">·</span>
          <a href="${escapeHtml(refundHref)}" style="color:${MUTED};text-decoration:underline;">Refunds</a>
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};">
          © ${year} ${escapeHtml(SITE_NAME)}. Visa &amp; passport services for Indian travellers.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 4px;">
        ${renderRainbowStrip()}
      </td>
    </tr>
  </table>`;
}

/**
 * Shared Viserv email chrome — header, body slot, footer + social.
 * Every transactional email should render through this shell.
 */
export function renderEmailLayout(input: {
  preheader: string;
  title: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${CANVAS};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${WHITE};border-radius:24px;overflow:hidden;border:1px solid ${DIVIDER};">
            <tr>
              <td>
                ${renderEmailHeader()}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;">
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td>
                ${renderEmailFooter()}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
          <td align="center" style="background:${CANVAS};border-radius:16px;padding:28px 16px;border:1px solid ${DIVIDER};">
            <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};text-align:center;">Verification code</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:40px;line-height:1.2;letter-spacing:0.28em;font-weight:700;color:${INK};text-align:center;">${escapeHtml(input.otpCode.trim())}</p>
          </td>
        </tr>
      </table>`
    : '';

  const details = input.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;background:${CANVAS};border-radius:16px;border:1px solid ${DIVIDER};">
        ${input.details
          .map(
            (row, index) => `<tr>
              <td style="padding:${index === 0 ? '14px' : '6px'} 16px ${index === (input.details!.length - 1) ? '14px' : '6px'} 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};vertical-align:top;width:38%;">${escapeHtml(row.label)}</td>
              <td style="padding:${index === 0 ? '14px' : '6px'} 16px ${index === (input.details!.length - 1) ? '14px' : '6px'} 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${INK};font-weight:600;">${escapeHtml(row.value)}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '';

  const button =
    input.buttonLabel && input.buttonHref
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 12px;">
          <tr>
            <td align="center" style="text-align:center;">
              <a href="${escapeHtml(absoluteUrl(input.buttonHref))}" style="display:inline-block;padding:13px 24px;background:${INK};color:${WHITE};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;border-radius:28px;">${escapeHtml(input.buttonLabel)}</a>
            </td>
          </tr>
        </table>`
      : '';

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;color:${INK};font-weight:600;">${escapeHtml(input.heading)}</h1>
    ${paragraphs}
    ${otpCode}
    ${paragraphsAfterOtp}
    ${details}
    ${button}
  `;

  return renderEmailLayout({
    preheader: input.preheader,
    title: input.heading,
    bodyHtml,
  });
}
