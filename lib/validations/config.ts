import { z } from 'zod';
import { QUESTION_CATEGORY_VALUES } from '@/lib/question-categories';
import {
  normalizeQuestionVisibility,
  questionVisibilityDraftSchema,
} from '@/lib/question-visibility';
import {
  documentConditionsDraftSchema,
  normalizeDocumentConditions,
} from '@/lib/document-conditions';
import {
  normalizeVisaListingSlug,
  VISA_LISTING_SLUG_PATTERN,
} from '@/lib/visa/listingSlug';
import { VISA_LISTING_PURPOSES } from '@/lib/visa/purposes';
import { PROCESS_TYPES } from '@/lib/visa/processTypes';

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
  processName: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name too long'),
  slug: z
    .string()
    .trim()
    .min(3, 'URL slug must be at least 3 characters')
    .max(120, 'URL slug is too long')
    .transform((value) => normalizeVisaListingSlug(value))
    .refine((value) => VISA_LISTING_SLUG_PATTERN.test(value), {
      message: 'Use lowercase words separated by hyphens, like australia-tourism-visa',
    }),
  processType: z.enum(PROCESS_TYPES, 'Invalid process type'),
  purpose: z.enum(VISA_LISTING_PURPOSES, {
    error: 'Invalid purpose',
  }),
  processTypeLabel: z.union([z.string().max(50, 'Type label too long'), z.literal('')]).nullable().optional(),
  entryType: z.union([z.string().max(50, 'Entry type too long'), z.literal('')]).nullable().optional(),
  processPhysical: z.boolean(),
  standardEtaDuration: z.number().int().positive('ETA duration must be positive').nullable().optional(),
  standardEtaUnit: z.enum(
    ['minutes', 'hours', 'days', 'months', 'years'],
    'Invalid ETA unit'
  ).nullable().optional(),
  isMultipleEntry: z.boolean(),
  familyEnabled: z.boolean(),
  unsupported: z.boolean(),
  /** When true, listing appears on the public site for travelers. */
  isActive: z.boolean(),
  visaOnArrival: z.boolean(),
  visaFree: z.boolean(),
  withFreeInsurance: z.boolean(),
  showInsuranceInterest: z.boolean(),
  sourceUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).nullable().optional(),
  /** TinyMCE HTML overview shown on the public visa listing page. */
  description: z
    .union([
      z.string().max(50000, 'Overview content is too long'),
      z.literal(''),
    ])
    .nullable()
    .optional(),
}).superRefine((data, ctx) => {
  if (data.processType === 'digital_arrival_card' && data.purpose !== 'visa_on_arrival') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Digital Arrival Card listings must use Arrival Card purpose',
      path: ['purpose'],
    });
  }
  if (data.withFreeInsurance && data.showInsuranceInterest) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Insurance interest cannot be offered when free insurance is included',
      path: ['showInsuranceInterest'],
    });
  }
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

const unitSchema = z.enum(
  ['minutes', 'hours', 'days', 'months', 'years'],
  'Invalid time unit'
);

/** Coerce empty/NaN RHF number inputs to null (used for Digital Arrival Card packages). */
const optionalPositiveInt = z.preprocess((value) => {
  if (value === '' || value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isNaN(value)) return null;
  return value;
}, z.number().int().positive('Must be a positive number').nullable());

const optionalUnit = z.preprocess((value) => {
  if (value === '' || value === undefined || value === null) return null;
  return value;
}, unitSchema.nullable());

export const visaListingPriceSchema = z.object({
  // Optional for Digital Arrival Card — those listings have fees only, no validity/stay.
  entryValidityAmount: optionalPositiveInt,
  entryValidityUnit: optionalUnit,
  entryLengthStayAmount: optionalPositiveInt,
  entryLengthStayUnit: optionalUnit,
  governmentFeeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  serviceFeeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  governmentGstFeeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  sortOrder: z.number().int().nonnegative().optional(),
});

export type VisaListingPriceInput = z.infer<typeof visaListingPriceSchema>;

// ============================================================================
// DYNAMIC QUESTION SCHEMAS
// ============================================================================

export const questionOptionSchema = z
  .object({
    label: z.string().min(1, 'Option label required'),
    value: z.string().optional(),
  })
  .transform((opt) => ({
    label: opt.label.trim(),
    value: opt.value?.trim() ? opt.value.trim() : crypto.randomUUID(),
  }));

export const visaFormStepSchema = z.object({
  title: z
    .string()
    .min(2, 'Title must be at least 2 characters')
    .max(120, 'Title too long'),
  description: z
    .union([z.string().max(500, 'Description too long'), z.literal('')])
    .nullable()
    .optional(),
});

export type VisaFormStepInput = z.infer<typeof visaFormStepSchema>;

export const additionalQuestionSchema = z.object({
  /** Shared catalog identity — when set on create, reuse catalog.key instead of minting a new one. */
  catalogQuestionId: z.string().uuid('Invalid catalog question id').optional().nullable(),
  key: z
    .string()
    .min(2, 'Key must be at least 2 characters')
    .max(50, 'Key too long')
    // Allow camelCase for built-in system keys (e.g. sys.givenNames).
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Key must be letters, numbers, dots, hyphens, and underscores only'
    )
    .optional(),
  /** Form Builder step (required for new step-based builder). */
  stepId: z.string().uuid('Select a form step'),
  label: z.string().min(3, 'Label must be at least 3 characters').max(255, 'Label too long'),
  description: z.union([z.string().max(500, 'Description too long'), z.literal('')]).nullable().optional(),
  questionType: z.enum(
    ['text', 'date', 'dropdown', 'boolean', 'checkbox', 'radio'],
    'Invalid question type'
  ),
  /** @deprecated Prefer steps; optional for legacy. */
  category: z.enum(QUESTION_CATEGORY_VALUES, 'Invalid question category').optional().default('other'),
  required: z.boolean(),
  familyEnabled: z.boolean().optional().default(false),
  onlyB2b: z.boolean().optional().default(false),
  extraInfo: z.union([z.string().max(500, 'Extra info too long'), z.literal('')]).nullable().optional(),
  requiredDoc: z.union([z.string().max(100, 'Required doc too long'), z.literal('')]).nullable().optional(),
  sourceUrl: z.union([z.string().url('Must be a valid URL'), z.literal('')]).nullable().optional(),
  options: z.array(questionOptionSchema).optional().default([]),
  visibility: questionVisibilityDraftSchema,
  documentConditions: documentConditionsDraftSchema,
}).superRefine((data, ctx) => {
  if (
    (data.questionType === 'dropdown' ||
      data.questionType === 'checkbox' ||
      data.questionType === 'radio') &&
    data.options.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Options are required for this question type',
      path: ['options'],
    });
  }

  if (data.visibility && data.visibility.enabled === true) {
    if (!data.visibility.sourceQuestionKey.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a question',
        path: ['visibility', 'sourceQuestionKey'],
      });
    }
    const operator = data.visibility.operator ?? 'equals';
    if (operator === 'equals' && !data.visibility.value.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a value to match',
        path: ['visibility', 'value'],
      });
    }
  }

  if (data.documentConditions && data.documentConditions.enabled === true) {
    const operator = data.documentConditions.operator ?? 'equals';
    if (operator === 'equals' && !data.documentConditions.value.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a value to match',
        path: ['documentConditions', 'value'],
      });
    }
    const docs = data.documentConditions.documents ?? [];
    const validDocs = docs.filter((d) => d.documentType.trim());
    if (validDocs.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one document type',
        path: ['documentConditions', 'documents'],
      });
    }
  }
}).transform((data) => ({
  ...data,
  visibility: normalizeQuestionVisibility(data.visibility),
  documentConditions: normalizeDocumentConditions(data.documentConditions),
}));

export type AdditionalQuestion = z.infer<typeof additionalQuestionSchema>;
export type QuestionOption = z.infer<typeof questionOptionSchema>;

// ============================================================================
// DOCUMENT TYPE CATALOG SCHEMAS
// ============================================================================

export const documentTypeSlugSchema = z
  .string()
  .trim()
  .min(2, 'Slug must be at least 2 characters')
  .max(80, 'Slug too long')
  .regex(/^[a-z0-9_]+$/, 'Slug must be lowercase letters, numbers, or underscores');

export const createDocumentTypeSchema = z.object({
  label: z.string().trim().min(2, 'Name must be at least 2 characters').max(200, 'Name too long'),
  value: documentTypeSlugSchema,
});

export type CreateDocumentTypeInput = z.infer<typeof createDocumentTypeSchema>;

export const updateDocumentTypeLabelSchema = z.object({
  id: z.string().uuid('Invalid document type id'),
  label: z.string().trim().min(2, 'Name must be at least 2 characters').max(200, 'Name too long'),
});

export type UpdateDocumentTypeLabelInput = z.infer<typeof updateDocumentTypeLabelSchema>;

// ============================================================================
// DOCUMENT REQUIREMENT SCHEMAS
// ============================================================================

export const componentRequiredSchema = z.object({
  documentType: z.string().trim().min(1, 'Select a document type').max(80),
  label: z.string().min(2, 'Label required').max(200).optional(),
});

export type ComponentRequired = z.infer<typeof componentRequiredSchema>;

export const createComponentsBulkSchema = z.object({
  documentTypes: z
    .array(z.string().trim().min(1).max(80))
    .min(1, 'Select at least one document type'),
});

export type CreateComponentsBulk = z.infer<typeof createComponentsBulkSchema>;

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
/** @deprecated Use FAQ */
export type Faq = FAQ;

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
  settingType: z.enum(
    ['upload', 'live_capture'],
    'Setting type must be upload or live_capture'
  ),
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
