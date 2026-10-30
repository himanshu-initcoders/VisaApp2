import 'server-only';
import twilio from 'twilio';

let client: ReturnType<typeof twilio> | null | undefined;

/** Ensure Twilio WhatsApp address form: whatsapp:+91XXXXXXXXXX */
export function toWhatsAppAddress(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().startsWith('whatsapp:')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  const e164 = trimmed.startsWith('+') ? `+${digits}` : `+${digits}`;
  return `whatsapp:${e164}`;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim()
  );
}

function getClient(): ReturnType<typeof twilio> | null {
  if (client !== undefined) return client;
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    client = null;
    return null;
  }
  client = twilio(accountSid, authToken);
  return client;
}

/**
 * Send a Twilio Content Template WhatsApp message.
 * Returns false (and logs) when Twilio/from/contentSid are missing or the API fails.
 */
export async function sendWhatsAppContent(input: {
  to: string;
  contentSid: string;
  variables: Record<string, string>;
  label: string;
}): Promise<boolean> {
  if (!isWhatsAppConfigured()) {
    console.warn(`[whatsapp] Twilio is not configured; skipping: ${input.label}`);
    return false;
  }

  const contentSid = input.contentSid.trim();
  if (!contentSid) {
    console.warn(`[whatsapp] Content SID missing; skipping: ${input.label}`);
    return false;
  }

  const from = toWhatsAppAddress(process.env.TWILIO_WHATSAPP_FROM!);
  const to = toWhatsAppAddress(input.to);
  if (!from || !to) {
    console.warn(
      `[whatsapp] Invalid from/to address; skipping: ${input.label}`,
      { from, to }
    );
    return false;
  }

  const twilioClient = getClient();
  if (!twilioClient) return false;

  try {
    const message = await twilioClient.messages.create({
      from,
      to,
      contentSid,
      contentVariables: JSON.stringify(input.variables),
    });
    console.info(
      `[whatsapp] Sent ${input.label} sid=${message.sid} status=${message.status} to=${to}`
    );
    return true;
  } catch (error) {
    console.error(`[whatsapp] Failed to send: ${input.label}`, error);
    return false;
  }
}
