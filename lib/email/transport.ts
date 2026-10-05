import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

const BRAND_NAME = 'Viserv';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transporter: Transporter | null = null;

export function getMailer(): Transporter | null {
  if (!isEmailConfigured()) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  return transporter;
}

/** `Viserv <address>`. Falls back to GMAIL_USER when EMAIL_FROM is unset. */
export function getFromAddress(): string {
  const address = (process.env.EMAIL_FROM || process.env.GMAIL_USER || '').trim();
  return `${BRAND_NAME} <${address}>`;
}
