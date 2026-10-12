import { z } from 'zod';

export const saveApplicationCredentialSchema = z.object({
  applicationId: z.string().uuid(),
  applicationType: z.enum(['visa', 'passport']),
  username: z.string().trim().min(1, 'Username is required').max(255),
  password: z.string().min(1, 'Password is required').max(500),
});

export const revealApplicationCredentialSchema = z.object({
  applicationId: z.string().uuid(),
  applicationType: z.enum(['visa', 'passport']),
});

export type SaveApplicationCredentialInput = z.infer<
  typeof saveApplicationCredentialSchema
>;
export type RevealApplicationCredentialInput = z.infer<
  typeof revealApplicationCredentialSchema
>;
