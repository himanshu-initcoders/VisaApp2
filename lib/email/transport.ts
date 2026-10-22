import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

const BRAND_NAME = 'Viserv';
const DEFAULT_SMTP_HOST = 'smtp.zeptomail.in';
const DEFAULT_SMTP_USER = 'emailapikey';

/** Strip accidental surrounding quotes from .env values. */
function envValue(key: string): string {
  const raw = process.env[key]?.trim() ?? '';
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

export function isEmailConfigured(): boolean {
  return Boolean(envValue('ZOHO_CPAAS_SMTP_PASSWORD') && envValue('EMAIL_FROM'));
}

let transporter: Transporter | null = null;

export function getMailer(): Transporter | null {
  if (!isEmailConfigured()) return null;

  if (!transporter) {
    // Prefer SMTP-tab username. Shorter-password mode can set ZOHO_CPAAS_SMTP_USER
    // to the From address or the username Zoho shows next to the short password.
    const user = envValue('ZOHO_CPAAS_SMTP_USER') || DEFAULT_SMTP_USER;
    const pass = envValue('ZOHO_CPAAS_SMTP_PASSWORD');

    transporter = nodemailer.createTransport({
      host: envValue('ZOHO_CPAAS_SMTP_HOST') || DEFAULT_SMTP_HOST,
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }

  return transporter;
}

/** `Viserv <address>`. Requires a verified domain address in EMAIL_FROM. */
export function getFromAddress(): string {
  return `${BRAND_NAME} <${envValue('EMAIL_FROM')}>`;
}
