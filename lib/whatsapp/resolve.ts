import 'server-only';

import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { normalizeIndianPhone } from '@/lib/auth/phone';

export interface WhatsAppRecipient {
  userId: string;
  name: string;
  /** Twilio address: whatsapp:+91XXXXXXXXXX */
  to: string;
  /** 10-digit local mobile for template display */
  phoneDisplay: string;
}

function toWhatsAppAddress(phone10: string): string {
  return `whatsapp:+91${phone10}`;
}

function formatPhoneForTemplate(phone10: string): string {
  return `+91${phone10}`;
}

/**
 * Resolve a WhatsApp recipient from users.phone only.
 * Returns null when the user has no valid Indian mobile on the users table.
 */
export async function resolveUserWhatsApp(
  userId: string
): Promise<WhatsAppRecipient | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.phone?.trim()) return null;
  const phone10 = normalizeIndianPhone(row.phone);
  if (!phone10) return null;

  return {
    userId: row.id,
    name: row.name,
    to: toWhatsAppAddress(phone10),
    phoneDisplay: formatPhoneForTemplate(phone10),
  };
}

/**
 * Build a recipient from an already-loaded users.phone value (no extra query).
 */
export function recipientFromUserPhone(input: {
  userId: string;
  name: string;
  phone: string | null | undefined;
}): WhatsAppRecipient | null {
  if (!input.phone?.trim()) return null;
  const phone10 = normalizeIndianPhone(input.phone);
  if (!phone10) return null;
  return {
    userId: input.userId,
    name: input.name,
    to: toWhatsAppAddress(phone10),
    phoneDisplay: formatPhoneForTemplate(phone10),
  };
}

/**
 * Active admin users who have a phone on the users table.
 */
export async function resolveAdminWhatsAppRecipients(
  excludeUserId?: string
): Promise<WhatsAppRecipient[]> {
  const conditions = [
    eq(users.role, 'admin'),
    isNull(users.deactivatedAt),
    isNotNull(users.phone),
  ];
  if (excludeUserId) {
    conditions.push(ne(users.id, excludeUserId));
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
    })
    .from(users)
    .where(and(...conditions));

  const out: WhatsAppRecipient[] = [];
  for (const row of rows) {
    const recipient = recipientFromUserPhone({
      userId: row.id,
      name: row.name,
      phone: row.phone,
    });
    if (recipient) out.push(recipient);
  }
  return out;
}
