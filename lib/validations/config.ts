import { z } from 'zod';

/**
 * Validation schemas for admin configuration forms
 * Used with React Hook Form for type-safe form validation
 */

// ============================================================================
// COUNTRY SCHEMAS
// ============================================================================

export const countryMetadataSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  // Banner image (portrait)
  bannerImageUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).nullable().optional(),
  bannerImageAlt: z.union([z.string().max(255, 'Alt text too long'), z.literal('')]).nullable().optional(),
  bannerImageWidth: z.number().int().positive('Width must be positive').nullable().optional(),
  bannerImageHeight: z.number().int().positive('Height must be positive').nullable().optional(),
  // Hero image
  heroImageUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).nullable().optional(),
  heroImageAlt: z.union([z.string().max(255, 'Alt text too long'), z.literal('')]).nullable().optional(),
  heroImageWidth: z.number().int().positive('Width must be positive').nullable().optional(),
  heroImageHeight: z.number().int().positive('Height must be positive').nullable().optional(),
  // Flag logo
  flagLogoUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).nullable().optional(),
  // SEO
  metaTitle: z.union([z.string().min(10, 'Meta title must be at least 10 characters').max(100, 'Meta title too long'), z.literal('')]).nullable().optional(),
  metaDescription: z.union([z.string().min(20, 'Meta description must be at least 20 characters').max(200, 'Meta description too long'), z.literal('')]).nullable().optional(),
  headline: z.union([z.string().min(5, 'Headline must be at least 5 characters').max(200, 'Headline too long'), z.literal('')]).nullable().optional(),
  showAuthorizationTag: z.boolean()
});

export type CountryMetadata = z.infer<typeof countryMetadataSchema>;

export const createCountrySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  iso2Code: z
    .string()
    .length(2, 'ISO2 code must be exactly 2 letters')
    .regex(/^[A-Za-z]{2}$/, 'ISO2 code must be 2 letters')
    .transform((code) => code.toUpperCase()),
  enabled: z.boolean(),
  supported: z.boolean(),
});

export type CreateCountryInput = z.infer<typeof createCountrySchema>;
export type CreateCountryFormValues = z.input<typeof createCountrySchema>;

// ============================================================================
// PROCESS BASIC INFO SCHEMA
// ============================================================================

export const processBasicInfoSchema = z.object({
  processName: z.string().min(3, 'Visa name must be at least 3 characters').max(100, 'Visa name too long'),
  processType: z.enum(['electronic_travel_authorisation', 'afc', 'visa', 'appointment', 'visa_on_arrival', 'sticker_visa', 'visa_free'], {
    errorMap: () => ({ message: 'Invalid process type' })
  }),
  purpose: z.enum(['tourism', 'business', 'work', 'study', 'family', 'medical', 'transit'], {
    errorMap: () => ({ message: 'Invalid purpose' })
  }),
  processTypeLabel: z.union([z.string().max(50, 'Type label too long'), z.literal('')]).nullable().optional(),
  entryType: z.union([z.string().max(50, 'Entry type too long'), z.literal('')]).nullable().optional(),
  processPhysical: z.boolean(),
  standardEtaDuration: z.number().int().positive('ETA duration must be positive').nullable().optional(),
  standardEtaUnit: z.enum(['minutes', 'hours', 'days', 'months', 'years'], {
    errorMap: () => ({ message: 'Invalid ETA unit' })
  }).nullable().optional(),
  isMultipleEntry: z.boolean(),
  familyEnabled: z.boolean(),
  unsupported: z.boolean(),
  visaOnArrival: z.boolean(),
  visaFree: z.boolean(),
  sourceUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).nullable().optional()
}).superRefine((data, ctx) => {
  const hasAmount = data.standardEtaDuration !== null && data.standardEtaDuration !== undefined;
  const hasUnit = data.standardEtaUnit !== null && data.standardEtaUnit !== undefined;

  if (hasAmount !== hasUnit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ETA duration and unit must be provided together',
      path: [hasAmount ? 'standardEtaUnit' : 'standardEtaDuration'],
    });
  }
});

export type ProcessBasicInfo = z.infer<typeof processBasicInfoSchema>;

export const createVisaListingSchema = processBasicInfoSchema.and(
  z.object({
    destinationCountry: z
      .string()
      .length(2, 'Country code must be 2 letters (ISO2)')
      .regex(/^[A-Za-z]{2}$/, 'Country code must be 2 letters')
      .transform((code) => code.toUpperCase()),
  })
);

export type CreateVisaListingInput = z.infer<typeof createVisaListingSchema>;
export type CreateVisaListingFormValues = z.input<typeof createVisaListingSchema>;

// ============================================================================
// VISA LISTING PRICE OPTIONS
// ============================================================================

const unitSchema = z.enum(['minutes', 'hours', 'days', 'months', 'years'], {
  errorMap: () => ({ message: 'Invalid time unit' })
});

export const visaListingPriceSchema = z.object({
  entryValidityAmount: z.number().int().positive('Validity amount must be positive'),
  entryValidityUnit: unitSchema,
  entryLengthStayAmount: z.number().int().positive('Stay duration must be positive'),
  entryLengthStayUnit: unitSchema,
  governmentFeeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  serviceFeeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  governmentGstFeeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  sortOrder: z.number().int().nonnegative().optional(),
});

export type VisaListingPriceInput = z.infer<typeof visaListingPriceSchema>;

// ============================================================================
// DYNAMIC QUESTION SCHEMAS
// ============================================================================

export const questionOptionSchema = z.object({
  label: z.string().min(1, 'Option label required'),
  value: z.string().min(1, 'Option value required')
});

export const additionalQuestionSchema = z.object({
  key: z.string()
    .min(2, 'Key must be at least 2 characters')
    .max(50, 'Key too long')
    .regex(/^[a-z_]+$/, 'Key must be lowercase letters and underscores only'),
  label: z.string().min(3, 'Label must be at least 3 characters').max(255, 'Label too long'),
  description: z.union([z.string().max(500, 'Description too long'), z.literal('')]).nullable().optional(),
  questionType: z.enum(['text', 'date', 'select', 'dropdown', 'file', 'flight', 'boolean'], {
    errorMap: () => ({ message: 'Invalid question type' })
  }),
  required: z.boolean(),
  familyEnabled: z.boolean(),
  onlyB2b: z.boolean(),
  extraInfo: z.union([z.string().max(500, 'Extra info too long'), z.literal('')]).nullable().optional(),
  requiredDoc: z.union([z.string().max(100, 'Required doc too long'), z.literal('')]).nullable().optional(),
  sourceUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).nullable().optional(),
  options: z.array(questionOptionSchema).default([])
}).refine(data => {
  // Dropdown/select types must have options
  if (data.questionType === 'dropdown' || data.questionType === 'select') {
    return data.options.length > 0;
  }
  return true;
}, {
  message: 'Dropdown options required for select/dropdown question types',
  path: ['options']
});

export type AdditionalQuestion = z.infer<typeof additionalQuestionSchema>;
export type QuestionOption = z.infer<typeof questionOptionSchema>;

// ============================================================================
// DOCUMENT REQUIREMENT SCHEMAS
// ============================================================================

export const componentRequiredSchema = z.object({
  key: z.string().min(2, 'Key must be at least 2 characters').max(50, 'Key too long'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  chargeable: z.boolean(),
  familyEnabled: z.boolean(),
  onlyB2b: z.boolean(),
  toggle: z.boolean(),
  attributes: z.array(z.string()).default([]),
  sourceUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).nullable().optional(),
});

export type ComponentRequired = z.infer<typeof componentRequiredSchema>;

// ============================================================================
// FAQ SCHEMAS
// ============================================================================

export const faqSchema = z.object({
  question: z.string().min(10, 'Question must be at least 10 characters').max(500, 'Question too long'),
  answer: z.string().min(20, 'Answer must be at least 20 characters').max(5000, 'Answer too long'),
  category: z.string().max(100, 'Category too long').nullable().optional(),
  sortOrder: z.number().int().nonnegative('Sort order must be 0 or greater')
});

export type FAQ = z.infer<typeof faqSchema>;

// ============================================================================
// POST-CHECKOUT STEP SCHEMAS
// ============================================================================

export const postCheckoutStepSchema = z.object({
  heading: z.string().min(3, 'Heading must be at least 3 characters').max(200, 'Heading too long'),
  subheading: z.string().max(500, 'Subheading too long').nullable().optional(),
  sortOrder: z.number().int().nonnegative('Sort order must be 0 or greater')
});

export type PostCheckoutStep = z.infer<typeof postCheckoutStepSchema>;

// ============================================================================
// MULTI-COUNTRY SCHEMAS
// ============================================================================

export const multiCountrySchema = z.object({
  additionalCountryCode: z.string().length(2, 'Country code must be 2 letters (ISO2)').toUpperCase()
});

export type MultiCountry = z.infer<typeof multiCountrySchema>;

// ============================================================================
// VALIDATION SETTINGS SCHEMAS
// ============================================================================

export const passportOcrSettingsSchema = z.object({
  skipBlurDetection: z.boolean(),
  skipGlareDetection: z.boolean(),
  skipFingersDetection: z.boolean(),
  useStrictFingersDetectionModel: z.boolean(),
  enableTravelDocCheck: z.boolean()
});

export type PassportOcrSettings = z.infer<typeof passportOcrSettingsSchema>;

export const photoValidationSettingsSchema = z.object({
  settingType: z.enum(['upload', 'live_capture'], {
    errorMap: () => ({ message: 'Setting type must be upload or live_capture' })
  }),
  restrictInvalidPhoto: z.boolean(),
  restrictMultipleFaces: z.boolean(),
  restrictFaceOutsideFrame: z.boolean(),
  restrictCoveredFace: z.boolean(),
  restrictClosedEyes: z.boolean(),
  restrictGlasses: z.boolean(),
  restrictHeadcover: z.boolean(),
  restrictNotCenteredFace: z.boolean(),
  restrictNotStraightFace: z.boolean(),
  restrictImproperLightConditions: z.boolean(),
  restrictTooCloseFace: z.boolean(),
  restrictTooFarFace: z.boolean(),
  restrictTeethVisibility: z.boolean(),
  restrictHairInFront: z.boolean(),
  restrictEarsNotVisible: z.boolean(),
  restrictShouldersVisible: z.boolean()
});

export type PhotoValidationSettings = z.infer<typeof photoValidationSettingsSchema>;
