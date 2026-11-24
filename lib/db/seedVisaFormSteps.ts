import { db } from '@/lib/db';
import { additionalQuestions, visaFormSteps } from '@/lib/db/schema-extended';
import { eq } from 'drizzle-orm';
import {
  DEFAULT_OCR_STEP_TITLE,
  DEFAULT_OCR_SYSTEM_FIELDS,
  DEFAULT_TRIP_STEP_TITLE,
  DEFAULT_TRIP_SYSTEM_FIELDS,
} from '@/lib/apply/visaSystemFields';

/**
 * Seed OCR + Trip form steps with default system questions for a new listing.
 * Idempotent: skips if an OCR step already exists.
 */
export async function seedDefaultVisaFormSteps(visaListingId: string) {
  const existing = await db.query.visaFormSteps.findFirst({
    where: eq(visaFormSteps.visaListingId, visaListingId),
    columns: { id: true, kind: true },
  });
  if (existing) return;

  const [ocrStep] = await db
    .insert(visaFormSteps)
    .values({
      visaListingId,
      title: DEFAULT_OCR_STEP_TITLE,
      description: 'Passport biodata filled from OCR or entered manually.',
      kind: 'ocr',
      sortOrder: 0,
    })
    .returning({ id: visaFormSteps.id });

  const [tripStep] = await db
    .insert(visaFormSteps)
    .values({
      visaListingId,
      title: DEFAULT_TRIP_STEP_TITLE,
      description: 'Arrival, return, and accommodation for this traveller.',
      kind: 'trip',
      sortOrder: 1,
    })
    .returning({ id: visaFormSteps.id });

  if (!ocrStep || !tripStep) {
    throw new Error('Failed to create default visa form steps');
  }

  await db.insert(additionalQuestions).values([
    ...DEFAULT_OCR_SYSTEM_FIELDS.map((field, index) => ({
      visaListingId,
      stepId: ocrStep.id,
      key: field.key,
      systemKey: field.systemKey,
      label: field.label,
      description: field.description ?? null,
      questionType: field.questionType,
      category: 'passenger_details' as const,
      required: field.required,
      options: field.options ?? [],
      sortOrder: index,
    })),
    ...DEFAULT_TRIP_SYSTEM_FIELDS.map((field, index) => ({
      visaListingId,
      stepId: tripStep.id,
      key: field.key,
      systemKey: field.systemKey,
      label: field.label,
      description: field.description ?? null,
      questionType: field.questionType,
      category: 'travel_details' as const,
      required: field.required,
      options: field.options ?? [],
      sortOrder: index,
    })),
  ]);
}
