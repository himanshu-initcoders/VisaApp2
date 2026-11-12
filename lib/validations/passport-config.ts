import { z } from 'zod';
import {
  normalizeQuestionVisibility,
  questionVisibilityDraftSchema,
} from '@/lib/question-visibility';
import {
  documentConditionsDraftSchema,
  normalizeDocumentConditions,
} from '@/lib/document-conditions';
import { faqSchema, componentRequiredSchema, createComponentsBulkSchema } from '@/lib/validations/config';

export { faqSchema, componentRequiredSchema, createComponentsBulkSchema };

const feeAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount');

export const passportListingBasicSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Name must be at least 3 characters')
      .max(100, 'Name too long'),
    description: z
      .union([
        z.string().max(2000, 'Description must be at most 2000 characters'),
        z.literal(''),
      ])
      .nullable()
      .optional(),
    standardEtaDuration: z
      .number()
      .int()
      .positive('ETA duration must be positive')
      .nullable()
      .optional(),
    standardEtaUnit: z
      .enum(['minutes', 'hours', 'days', 'months', 'years'], 'Invalid ETA unit')
      .nullable()
      .optional(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const hasAmount =
      data.standardEtaDuration !== null &&
      data.standardEtaDuration !== undefined;
    const hasUnit =
      data.standardEtaUnit !== null && data.standardEtaUnit !== undefined;
    if (hasAmount !== hasUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ETA duration and unit must be provided together',
        path: [hasAmount ? 'standardEtaUnit' : 'standardEtaDuration'],
      });
    }
  });

export type PassportListingBasic = z.infer<typeof passportListingBasicSchema>;

export const passportListingPriceSchema = z.object({
  scheme: z.enum(['normal', 'tatkaal'], 'Invalid scheme'),
  bookletPages: z.enum(['36', '60'], 'Invalid booklet pages'),
  governmentFeeAmount: feeAmountSchema,
  serviceFeeAmount: feeAmountSchema,
  governmentGstFeeAmount: feeAmountSchema,
  sortOrder: z.number().int().nonnegative().optional(),
});

export type PassportListingPriceInput = z.infer<
  typeof passportListingPriceSchema
>;

export const passportFormStepSchema = z.object({
  title: z
    .string()
    .min(2, 'Title must be at least 2 characters')
    .max(120, 'Title too long'),
  description: z
    .union([z.string().max(500, 'Description too long'), z.literal('')])
    .nullable()
    .optional(),
});

export type PassportFormStepInput = z.infer<typeof passportFormStepSchema>;

export const questionOptionSchema = z
  .object({
    label: z.string().min(1, 'Option label required'),
    value: z.string().optional(),
  })
  .transform((opt) => ({
    label: opt.label.trim(),
    value: opt.value?.trim() ? opt.value.trim() : crypto.randomUUID(),
  }));

export const passportAdditionalQuestionSchema = z
  .object({
    key: z
      .string()
      .min(2, 'Key must be at least 2 characters')
      .max(50, 'Key too long')
      .regex(
        /^[a-z0-9_-]+$/,
        'Key must be lowercase letters, numbers, hyphens, and underscores only'
      )
      .optional(),
    stepId: z.string().uuid('Select a form step'),
    label: z
      .string()
      .min(3, 'Label must be at least 3 characters')
      .max(255, 'Label too long'),
    description: z
      .union([z.string().max(500, 'Description too long'), z.literal('')])
      .nullable()
      .optional(),
    questionType: z.enum(
      ['text', 'date', 'dropdown', 'boolean', 'checkbox', 'radio'],
      'Invalid question type'
    ),
    required: z.boolean(),
    extraInfo: z
      .union([z.string().max(500, 'Extra info too long'), z.literal('')])
      .nullable()
      .optional(),
    requiredDoc: z
      .union([z.string().max(100, 'Required doc too long'), z.literal('')])
      .nullable()
      .optional(),
    sourceUrl: z
      .union([z.string().url('Must be a valid URL'), z.literal('')])
      .nullable()
      .optional(),
    options: z.array(questionOptionSchema).optional().default([]),
    visibility: questionVisibilityDraftSchema,
    documentConditions: documentConditionsDraftSchema,
  })
  .superRefine((data, ctx) => {
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
  })
  .transform((data) => ({
    ...data,
    visibility: normalizeQuestionVisibility(data.visibility),
    documentConditions: normalizeDocumentConditions(data.documentConditions),
  }));

export type PassportAdditionalQuestionInput = z.infer<
  typeof passportAdditionalQuestionSchema
>;
