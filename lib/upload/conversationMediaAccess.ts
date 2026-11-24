/**
 * Authorize view/download of conversation attachment keys
 * (applications/conversation/{applicationId}/...).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { passportServices, visaApplications } from '@/lib/db/schema';
import { isAdmin } from '@/lib/auth-utils';
import { reviewerOwnsApplication } from '@/lib/reviewer-access';
import {
  extractConversationApplicationId,
  isConversationMediaKey,
} from '@/lib/upload/mediaUrl';

export async function canAccessConversationMedia(input: {
  key: string;
  userId: string;
  role?: string | null;
}): Promise<boolean> {
  if (!isConversationMediaKey(input.key)) return false;

  const applicationId = extractConversationApplicationId(input.key);
  if (!applicationId) return false;

  if (isAdmin({ role: input.role || undefined })) {
    return true;
  }

  const [visa] = await db
    .select({
      id: visaApplications.id,
      userId: visaApplications.userId,
    })
    .from(visaApplications)
    .where(eq(visaApplications.id, applicationId))
    .limit(1);

  if (visa) {
    if (visa.userId === input.userId) return true;
    if (input.role === 'reviewer') {
      return reviewerOwnsApplication(input.userId, applicationId, 'visa');
    }
    return false;
  }

  const [passport] = await db
    .select({
      id: passportServices.id,
      userId: passportServices.userId,
    })
    .from(passportServices)
    .where(eq(passportServices.id, applicationId))
    .limit(1);

  if (passport) {
    if (passport.userId === input.userId) return true;
    if (input.role === 'reviewer') {
      return reviewerOwnsApplication(input.userId, applicationId, 'passport');
    }
    return false;
  }

  return false;
}

export { isConversationMediaKey, extractConversationApplicationId };
