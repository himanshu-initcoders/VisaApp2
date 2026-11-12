import type {
  PassportAdditionalQuestion,
  PassportComponentRequired,
  PassportFormStep,
  PassportListing,
} from '@/lib/db/schema-passport';
import type { DocumentTypeSampleLookup } from '@/lib/apply/applicationForm';

export type PassportApplyQuestion = {
  key: string;
  label: string;
  description: string | null;
  questionType: string;
  required: boolean;
  options: Array<{ label: string; value: string }>;
  visibility: PassportAdditionalQuestion['visibility'];
  documentConditions: PassportAdditionalQuestion['documentConditions'];
  sortOrder: number | null;
};

export type PassportApplyStep = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  questions: PassportApplyQuestion[];
};

export type PassportApplyDocumentSlot = {
  key: string;
  documentType: string | null;
  label: string;
  /** Catalog docs are required when shown (visa parity). Legacy snapshots may omit this. */
  required: boolean;
  sampleUrl?: string | null;
  sampleFilename?: string | null;
};

/** Legacy published configs may omit `required` — treat those slots as required. */
export function isPassportDocumentSlotRequired(
  slot: Pick<PassportApplyDocumentSlot, 'required'>
): boolean {
  return slot.required !== false;
}

export function getMissingPassportDocuments(
  slots: PassportApplyDocumentSlot[] | null | undefined,
  uploads:
    | Record<
        string,
        | {
            storageKey?: string | null;
            /** @deprecated legacy draft field — treat as storageKey */
            s3Key?: string | null;
            filename?: string | null;
          }
        | undefined
      >
    | null
    | undefined
): PassportApplyDocumentSlot[] {
  return (slots ?? []).filter((slot) => {
    if (!isPassportDocumentSlotRequired(slot)) return false;
    const file = uploads?.[slot.key];
    const key = file?.storageKey || file?.s3Key;
    return !key;
  });
}

export type PassportApplyFormConfig = {
  serviceType: 'fresh' | 'reissue';
  productName: string;
  description: string | null;
  steps: PassportApplyStep[];
  documentSlots: PassportApplyDocumentSlot[];
};

export function buildPassportFormConfig(input: {
  listing: Pick<
    PassportListing,
    'serviceType' | 'name' | 'description'
  >;
  formSteps: Array<
    PassportFormStep & { questions?: PassportAdditionalQuestion[] }
  >;
  components: PassportComponentRequired[];
  documentTypeSamples?: DocumentTypeSampleLookup;
}): PassportApplyFormConfig {
  const samples = input.documentTypeSamples;

  const steps: PassportApplyStep[] = [...input.formSteps]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      sortOrder: step.sortOrder,
      questions: [...(step.questions ?? [])]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((q) => ({
          key: q.key,
          label: q.label,
          description: q.description,
          questionType: q.questionType,
          required: Boolean(q.required),
          options: (q.options ?? []) as Array<{ label: string; value: string }>,
          visibility: q.visibility,
          documentConditions: q.documentConditions,
          sortOrder: q.sortOrder,
        })),
    }));

  const documentSlots: PassportApplyDocumentSlot[] = [...input.components]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const sample = c.documentType ? samples?.get(c.documentType) : undefined;
      return {
        key: c.key,
        documentType: c.documentType ?? null,
        label: c.label || sample?.label || c.documentType || 'Document',
        // Same as visa components_required: attached docs are required uploads.
        required: true,
        sampleUrl: sample?.sampleDocumentUrl ?? null,
        sampleFilename: sample?.sampleDocumentFilename ?? null,
      };
    });

  return {
    serviceType: input.listing.serviceType,
    productName: input.listing.name,
    description: input.listing.description,
    steps,
    documentSlots,
  };
}
