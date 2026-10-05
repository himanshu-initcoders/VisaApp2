import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

/**
 * Map a JWT user to a row that still exists.
 * A reseeded account keeps the same email but gets a new id, so the cookie id can be stale.
 */
export async function resolveSessionUserId(sessionUser: {
  id?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const id = sessionUser.id?.trim();
  if (id) {
    const [byId] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (byId) return byId.id;
  }

  const email = sessionUser.email?.trim().toLowerCase();
  if (!email) return null;

  const [byEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  return byEmail?.id ?? null;
}
