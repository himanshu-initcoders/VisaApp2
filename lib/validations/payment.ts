import { z } from 'zod';

/** Real price rows are UUIDs. Demo options such as `demo-price-standard` are ignored. */
const priceOptionIdSchema = z
  .string()
  .max(100)
  .nullable()
  .optional()
  .transform((value) => {
    if (!value) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
      ? value
      : null;
  });

const travellerDocumentSchema = z.object({
  key: z.string().min(1).max(500),
  name: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const checkoutTravellerSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  passportData: z.unknown().optional().nullable(),
  tripDetails: z.unknown().optional().nullable(),
  documents: z.array(travellerDocumentSchema).max(20).optional(),
  passportUploaded: z.boolean().optional(),
  photoUploaded: z.boolean().optional(),
  applicationComplete: z.boolean().optional(),
});

export const createVisaCheckoutOrderSchema = z.object({
  submitId: z.string().uuid(),
  listingId: z.string().uuid(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/, 'Invalid country code'),
  priceOptionId: priceOptionIdSchema,
  travellers: z.array(checkoutTravellerSchema).min(1).max(100),
});

const uploadFileSchema = z.object({
  passengerId: z.string().min(1).max(100),
  slotKey: z.string().min(1).max(100),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  bufferBase64: z.string().min(1),
});

export const verifyVisaCheckoutSchema = createVisaCheckoutOrderSchema.extend({
  razorpayOrderId: z.string().min(1).max(255).optional(),
  razorpayPaymentId: z.string().min(1).max(255).optional(),
  razorpaySignature: z.string().min(1).max(255).optional(),
  files: z.array(uploadFileSchema).max(40).optional(),
});

export const quoteVisaCheckoutSchema = z.object({
  listingId: z.string().uuid(),
  priceOptionId: priceOptionIdSchema,
  travellerCount: z.number().int().min(1).max(100),
});

export type CreateVisaCheckoutOrderInput = z.infer<
  typeof createVisaCheckoutOrderSchema
>;
export type VerifyVisaCheckoutInput = z.infer<typeof verifyVisaCheckoutSchema>;
