'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import {
  passportListings,
  passportListingPrices,
  passportFormSteps,
  passportAdditionalQuestions,
  passportComponentsRequired,
  passportFaqs,
} from '@/lib/db/schema-passport';
import { passportFormVersions } from '@/lib/db/schema';
import {
  passportListingBasicSchema,
  passportListingPriceSchema,
  passportFormStepSchema,
  passportAdditionalQuestionSchema,
  faqSchema,
  componentRequiredSchema,
  createComponentsBulkSchema,
  type PassportListingBasic,
  type PassportListingPriceInput,
  type PassportFormStepInput,
  type PassportAdditionalQuestionInput,
} from '@/lib/validations/passport-config';
import type { FAQ, ComponentRequired, CreateComponentsBulk } from '@/lib/validations/config';
import {
  getPassportListingById,
  getPassportListingWithAllRelations,
  getPassportPriceById,
  getPassportFormStepById,
  getPassportQuestionById,
  getPassportComponentById,
  getPassportFaqById,
  getMaxPassportPriceSortOrder,
  getMaxPassportStepSortOrder,
  getMaxPassportQuestionSortOrder,
  getMaxPassportComponentSortOrder,
  getMaxPassportFaqSortOrder,
  getNextPassportFormVersionNumber,
} from '@/lib/db/queries/passport-config';
import {
  getDocumentTypeByValue,
  getDocumentTypeSamplesByValues,
  listDocumentTypes,
} from '@/lib/db/queries/config';
import { revalidatePublicPassportCatalog } from '@/lib/revalidate-public-catalog';
import { buildPassportFormConfig } from '@/lib/apply/passportForm';

function revalidateListing(listingId: string, serviceType?: string) {
  revalidatePath('/admin/config/passport-listings');
  revalidatePath(`/admin/config/passport-listings/${listingId}`);
  revalidatePath(`/admin/config/passport-listings/${listingId}/basic`);
  revalidatePath(`/admin/config/passport-listings/${listingId}/tiers`);
  revalidatePath(`/admin/config/passport-listings/${listingId}/forms`);
  revalidatePath(`/admin/config/passport-listings/${listingId}/docs`);
  revalidatePath(`/admin/config/passport-listings/${listingId}/content`);
  revalidatePublicPassportCatalog({ serviceType });
}

async function ensurePassportDocumentTypesAttached(
  listingId: string,
  documentTypes: string[]
) {
  const unique = [...new Set(documentTypes.map((d) => d.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const existing = await db.query.passportComponentsRequired.findMany({
    where: eq(passportComponentsRequired.passportListingId, listingId),
  });
  const attached = new Set(
    existing.map((c) => c.documentType).filter(Boolean) as string[]
  );
  const missing = unique.filter((value) => !attached.has(value));
  if (missing.length === 0) return;

  const catalog = await listDocumentTypes();
  const byValue = new Map(catalog.map((item) => [item.value, item]));
  let sortOrder = (await getMaxPassportComponentSortOrder(listingId)) + 1;

  for (const value of missing) {
    const type = byValue.get(value);
    if (!type) continue;
    await db.insert(passportComponentsRequired).values({
      passportListingId: listingId,
      key: crypto.randomUUID(),
      documentType: value,
      label: type.label,
      amount: '0',
      chargeable: false,
      toggle: false,
      attributes: [],
      sortOrder,
    });
    sortOrder += 1;
  }
}

export async function updatePassportListingBasic(
  listingId: string,
  data: PassportListingBasic
) {
  await requireRole(['admin']);

  try {
    const validated = passportListingBasicSchema.parse(data);
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    await db
      .update(passportListings)
      .set({
        name: validated.name,
        description: validated.description || null,
        standardEtaDuration: validated.standardEtaDuration ?? null,
        standardEtaUnit: validated.standardEtaUnit ?? null,
        isActive: validated.isActive,
        updatedAt: new Date(),
      })
      .where(eq(passportListings.id, listingId));

    revalidateListing(listingId, listing.serviceType);
    return { success: true, message: 'Basic info updated' };
  } catch (error) {
    console.error('Error updating passport listing:', error);
    return { error: 'Failed to update basic info' };
  }
}

export async function createPassportPrice(
  listingId: string,
  data: PassportListingPriceInput
) {
  await requireRole(['admin']);

  try {
    const validated = passportListingPriceSchema.parse(data);
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    const sortOrder =
      validated.sortOrder ??
      (await getMaxPassportPriceSortOrder(listingId)) + 1;

    const [created] = await db
      .insert(passportListingPrices)
      .values({
        passportListingId: listingId,
        scheme: validated.scheme,
        bookletPages: validated.bookletPages,
        governmentFeeAmount: validated.governmentFeeAmount,
        serviceFeeAmount: validated.serviceFeeAmount,
        governmentGstFeeAmount: validated.governmentGstFeeAmount,
        sortOrder,
      })
      .returning();

    revalidateListing(listingId, listing.serviceType);
    return { success: true, message: 'Price package created', price: created };
  } catch (error) {
    console.error('Error creating passport price:', error);
    const message =
      error instanceof Error && /unique|duplicate/i.test(error.message)
        ? 'That scheme and booklet size already exists for this product'
        : 'Failed to create price package';
    return { error: message };
  }
}

export async function updatePassportPrice(
  priceId: string,
  data: PassportListingPriceInput
) {
  await requireRole(['admin']);

  try {
    const validated = passportListingPriceSchema.parse(data);
    const price = await getPassportPriceById(priceId);
    if (!price) return { error: 'Price package not found' };

    const listing = await getPassportListingById(price.passportListingId);

    await db
      .update(passportListingPrices)
      .set({
        scheme: validated.scheme,
        bookletPages: validated.bookletPages,
        governmentFeeAmount: validated.governmentFeeAmount,
        serviceFeeAmount: validated.serviceFeeAmount,
        governmentGstFeeAmount: validated.governmentGstFeeAmount,
      })
      .where(eq(passportListingPrices.id, priceId));

    revalidateListing(price.passportListingId, listing?.serviceType);
    return { success: true, message: 'Price package updated' };
  } catch (error) {
    console.error('Error updating passport price:', error);
    const message =
      error instanceof Error && /unique|duplicate/i.test(error.message)
        ? 'That scheme and booklet size already exists for this product'
        : 'Failed to update price package';
    return { error: message };
  }
}

export async function deletePassportPrice(priceId: string) {
  await requireRole(['admin']);

  try {
    const price = await getPassportPriceById(priceId);
    if (!price) return { error: 'Price package not found' };
    const listing = await getPassportListingById(price.passportListingId);

    await db
      .delete(passportListingPrices)
      .where(eq(passportListingPrices.id, priceId));

    revalidateListing(price.passportListingId, listing?.serviceType);
    return { success: true, message: 'Price package deleted' };
  } catch (error) {
    console.error('Error deleting passport price:', error);
    return { error: 'Failed to delete price package' };
  }
}

export async function createPassportFormStep(
  listingId: string,
  data: PassportFormStepInput
) {
  await requireRole(['admin']);

  try {
    const validated = passportFormStepSchema.parse(data);
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    const sortOrder = (await getMaxPassportStepSortOrder(listingId)) + 1;
    const [created] = await db
      .insert(passportFormSteps)
      .values({
        passportListingId: listingId,
        title: validated.title,
        description: validated.description || null,
        sortOrder,
      })
      .returning();

    revalidateListing(listingId, listing.serviceType);
    return { success: true, message: 'Step created', step: created };
  } catch (error) {
    console.error('Error creating passport form step:', error);
    return { error: 'Failed to create step' };
  }
}

export async function updatePassportFormStep(
  stepId: string,
  data: PassportFormStepInput
) {
  await requireRole(['admin']);

  try {
    const validated = passportFormStepSchema.parse(data);
    const step = await getPassportFormStepById(stepId);
    if (!step) return { error: 'Step not found' };
    const listing = await getPassportListingById(step.passportListingId);

    await db
      .update(passportFormSteps)
      .set({
        title: validated.title,
        description: validated.description || null,
      })
      .where(eq(passportFormSteps.id, stepId));

    revalidateListing(step.passportListingId, listing?.serviceType);
    return { success: true, message: 'Step updated' };
  } catch (error) {
    console.error('Error updating passport form step:', error);
    return { error: 'Failed to update step' };
  }
}

export async function deletePassportFormStep(stepId: string) {
  await requireRole(['admin']);

  try {
    const step = await getPassportFormStepById(stepId);
    if (!step) return { error: 'Step not found' };
    const listing = await getPassportListingById(step.passportListingId);

    await db.delete(passportFormSteps).where(eq(passportFormSteps.id, stepId));

    revalidateListing(step.passportListingId, listing?.serviceType);
    return { success: true, message: 'Step deleted' };
  } catch (error) {
    console.error('Error deleting passport form step:', error);
    return { error: 'Failed to delete step' };
  }
}

export async function reorderPassportFormSteps(
  listingId: string,
  stepIds: string[]
) {
  await requireRole(['admin']);

  try {
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    await Promise.all(
      stepIds.map((id, index) =>
        db
          .update(passportFormSteps)
          .set({ sortOrder: index })
          .where(eq(passportFormSteps.id, id))
      )
    );

    revalidateListing(listingId, listing.serviceType);
    return { success: true };
  } catch (error) {
    console.error('Error reordering passport form steps:', error);
    return { error: 'Failed to reorder steps' };
  }
}

export async function createPassportQuestion(
  listingId: string,
  data: PassportAdditionalQuestionInput
) {
  await requireRole(['admin']);

  try {
    const validated = passportAdditionalQuestionSchema.parse(data);
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    const step = await getPassportFormStepById(validated.stepId);
    if (!step || step.passportListingId !== listingId) {
      return { error: 'Form step not found on this listing' };
    }

    const sortOrder =
      (await getMaxPassportQuestionSortOrder(validated.stepId)) + 1;

    const [created] = await db
      .insert(passportAdditionalQuestions)
      .values({
        passportListingId: listingId,
        stepId: validated.stepId,
        key: validated.key || crypto.randomUUID(),
        label: validated.label,
        description: validated.description || null,
        questionType: validated.questionType,
        required: validated.required,
        extraInfo: validated.extraInfo || null,
        requiredDoc: validated.requiredDoc || null,
        sourceUrl: validated.sourceUrl || null,
        options: validated.options ?? [],
        visibility: validated.visibility,
        documentConditions: validated.documentConditions,
        sortOrder,
      })
      .returning();

    if (validated.documentConditions?.enabled) {
      await ensurePassportDocumentTypesAttached(
        listingId,
        validated.documentConditions.documents.map((d) => d.documentType)
      );
    }

    revalidateListing(listingId, listing.serviceType);
    return { success: true, message: 'Question created', question: created };
  } catch (error) {
    console.error('Error creating passport question:', error);
    return { error: 'Failed to create question' };
  }
}

export async function updatePassportQuestion(
  questionId: string,
  data: PassportAdditionalQuestionInput
) {
  await requireRole(['admin']);

  try {
    const validated = passportAdditionalQuestionSchema.parse(data);
    const question = await getPassportQuestionById(questionId);
    if (!question) return { error: 'Question not found' };

    const listing = await getPassportListingById(question.passportListingId);
    const step = await getPassportFormStepById(validated.stepId);
    if (!step || step.passportListingId !== question.passportListingId) {
      return { error: 'Form step not found on this listing' };
    }

    await db
      .update(passportAdditionalQuestions)
      .set({
        stepId: validated.stepId,
        label: validated.label,
        description: validated.description || null,
        questionType: validated.questionType,
        required: validated.required,
        extraInfo: validated.extraInfo || null,
        requiredDoc: validated.requiredDoc || null,
        sourceUrl: validated.sourceUrl || null,
        options: validated.options ?? [],
        visibility: validated.visibility,
        documentConditions: validated.documentConditions,
      })
      .where(eq(passportAdditionalQuestions.id, questionId));

    if (validated.documentConditions?.enabled) {
      await ensurePassportDocumentTypesAttached(
        question.passportListingId,
        validated.documentConditions.documents.map((d) => d.documentType)
      );
    }

    revalidateListing(question.passportListingId, listing?.serviceType);
    return { success: true, message: 'Question updated' };
  } catch (error) {
    console.error('Error updating passport question:', error);
    return { error: 'Failed to update question' };
  }
}

export async function deletePassportQuestion(questionId: string) {
  await requireRole(['admin']);

  try {
    const question = await getPassportQuestionById(questionId);
    if (!question) return { error: 'Question not found' };
    const listing = await getPassportListingById(question.passportListingId);

    await db
      .delete(passportAdditionalQuestions)
      .where(eq(passportAdditionalQuestions.id, questionId));

    revalidateListing(question.passportListingId, listing?.serviceType);
    return { success: true, message: 'Question deleted' };
  } catch (error) {
    console.error('Error deleting passport question:', error);
    return { error: 'Failed to delete question' };
  }
}

export async function reorderPassportQuestions(
  stepId: string,
  questionIds: string[]
) {
  await requireRole(['admin']);

  try {
    const step = await getPassportFormStepById(stepId);
    if (!step) return { error: 'Step not found' };
    const listing = await getPassportListingById(step.passportListingId);

    await Promise.all(
      questionIds.map((id, index) =>
        db
          .update(passportAdditionalQuestions)
          .set({ sortOrder: index })
          .where(eq(passportAdditionalQuestions.id, id))
      )
    );

    revalidateListing(step.passportListingId, listing?.serviceType);
    return { success: true };
  } catch (error) {
    console.error('Error reordering passport questions:', error);
    return { error: 'Failed to reorder questions' };
  }
}

export async function createPassportComponent(
  listingId: string,
  data: ComponentRequired
) {
  await requireRole(['admin']);

  try {
    const validated = componentRequiredSchema.parse(data);
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    const catalogType = await getDocumentTypeByValue(validated.documentType);
    if (!catalogType) {
      return { error: `Unknown document type "${validated.documentType}"` };
    }

    const sortOrder = (await getMaxPassportComponentSortOrder(listingId)) + 1;
    const [created] = await db
      .insert(passportComponentsRequired)
      .values({
        passportListingId: listingId,
        key: crypto.randomUUID(),
        documentType: validated.documentType,
        label: validated.label?.trim() || catalogType.label,
        amount: '0',
        chargeable: false,
        toggle: false,
        attributes: [],
        sourceUrl: null,
        sortOrder,
      })
      .returning();

    revalidateListing(listingId, listing.serviceType);
    return {
      success: true,
      message: 'Document requirement created',
      component: created,
    };
  } catch (error) {
    console.error('Error creating passport component:', error);
    return { error: 'Failed to create document requirement' };
  }
}

export async function createPassportComponents(
  listingId: string,
  data: CreateComponentsBulk
) {
  await requireRole(['admin']);

  try {
    const validated = createComponentsBulkSchema.parse(data);
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    const catalog = await listDocumentTypes();
    const byValue = new Map(catalog.map((item) => [item.value, item]));
    let sortOrder = (await getMaxPassportComponentSortOrder(listingId)) + 1;
    const created = [];

    for (const value of validated.documentTypes) {
      const type = byValue.get(value);
      if (!type) continue;
      const [row] = await db
        .insert(passportComponentsRequired)
        .values({
          passportListingId: listingId,
          key: crypto.randomUUID(),
          documentType: value,
          label: type.label,
          amount: '0',
          chargeable: false,
          toggle: false,
          attributes: [],
          sourceUrl: null,
          sortOrder,
        })
        .returning();
      created.push(row);
      sortOrder += 1;
    }

    revalidateListing(listingId, listing.serviceType);
    return {
      success: true,
      message: 'Document requirements created',
      components: created,
    };
  } catch (error) {
    console.error('Error creating passport components:', error);
    return { error: 'Failed to create document requirements' };
  }
}

export async function updatePassportComponent(
  componentId: string,
  data: ComponentRequired
) {
  await requireRole(['admin']);

  try {
    const validated = componentRequiredSchema.parse(data);
    const component = await getPassportComponentById(componentId);
    if (!component) return { error: 'Document requirement not found' };

    const catalogType = await getDocumentTypeByValue(validated.documentType);
    if (!catalogType) {
      return { error: `Unknown document type "${validated.documentType}"` };
    }

    const listing = await getPassportListingById(component.passportListingId);

    const [updated] = await db
      .update(passportComponentsRequired)
      .set({
        documentType: validated.documentType,
        label: validated.label?.trim() || catalogType.label,
      })
      .where(eq(passportComponentsRequired.id, componentId))
      .returning();

    revalidateListing(component.passportListingId, listing?.serviceType);
    return {
      success: true,
      message: 'Document requirement updated',
      component: updated,
    };
  } catch (error) {
    console.error('Error updating passport component:', error);
    return { error: 'Failed to update document requirement' };
  }
}

export async function deletePassportComponent(componentId: string) {
  await requireRole(['admin']);

  try {
    const component = await getPassportComponentById(componentId);
    if (!component) return { error: 'Document requirement not found' };
    const listing = await getPassportListingById(component.passportListingId);

    await db
      .delete(passportComponentsRequired)
      .where(eq(passportComponentsRequired.id, componentId));

    revalidateListing(component.passportListingId, listing?.serviceType);
    return { success: true, message: 'Document requirement deleted' };
  } catch (error) {
    console.error('Error deleting passport component:', error);
    return { error: 'Failed to delete document requirement' };
  }
}

export async function reorderPassportComponents(
  listingId: string,
  componentIds: string[]
) {
  await requireRole(['admin']);

  try {
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    await Promise.all(
      componentIds.map((id, index) =>
        db
          .update(passportComponentsRequired)
          .set({ sortOrder: index })
          .where(eq(passportComponentsRequired.id, id))
      )
    );

    revalidateListing(listingId, listing.serviceType);
    return { success: true };
  } catch (error) {
    console.error('Error reordering passport components:', error);
    return { error: 'Failed to reorder documents' };
  }
}

export async function createPassportFaq(listingId: string, data: FAQ) {
  await requireRole(['admin']);

  try {
    const validated = faqSchema.parse(data);
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    const sortOrder = (await getMaxPassportFaqSortOrder(listingId)) + 1;
    await db.insert(passportFaqs).values({
      passportListingId: listingId,
      question: validated.question,
      answer: validated.answer,
      category: validated.category || null,
      sortOrder,
    });

    revalidateListing(listingId, listing.serviceType);
    return { success: true, message: 'FAQ created' };
  } catch (error) {
    console.error('Error creating passport FAQ:', error);
    return { error: 'Failed to create FAQ' };
  }
}

export async function updatePassportFaq(faqId: string, data: FAQ) {
  await requireRole(['admin']);

  try {
    const validated = faqSchema.parse(data);
    const faq = await getPassportFaqById(faqId);
    if (!faq) return { error: 'FAQ not found' };
    const listing = await getPassportListingById(faq.passportListingId);

    await db
      .update(passportFaqs)
      .set({
        question: validated.question,
        answer: validated.answer,
        category: validated.category || null,
      })
      .where(eq(passportFaqs.id, faqId));

    revalidateListing(faq.passportListingId, listing?.serviceType);
    return { success: true, message: 'FAQ updated' };
  } catch (error) {
    console.error('Error updating passport FAQ:', error);
    return { error: 'Failed to update FAQ' };
  }
}

export async function deletePassportFaq(faqId: string) {
  await requireRole(['admin']);

  try {
    const faq = await getPassportFaqById(faqId);
    if (!faq) return { error: 'FAQ not found' };
    const listing = await getPassportListingById(faq.passportListingId);

    await db.delete(passportFaqs).where(eq(passportFaqs.id, faqId));

    revalidateListing(faq.passportListingId, listing?.serviceType);
    return { success: true, message: 'FAQ deleted' };
  } catch (error) {
    console.error('Error deleting passport FAQ:', error);
    return { error: 'Failed to delete FAQ' };
  }
}

export async function reorderPassportFaqs(
  listingId: string,
  faqIds: string[]
) {
  await requireRole(['admin']);

  try {
    const listing = await getPassportListingById(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    await Promise.all(
      faqIds.map((id, index) =>
        db
          .update(passportFaqs)
          .set({ sortOrder: index })
          .where(eq(passportFaqs.id, id))
      )
    );

    revalidateListing(listingId, listing.serviceType);
    return { success: true };
  } catch (error) {
    console.error('Error reordering passport FAQs:', error);
    return { error: 'Failed to reorder FAQs' };
  }
}

export async function publishPassportFormVersion(listingId: string) {
  const session = await requireRole(['admin']);

  try {
    const listing = await getPassportListingWithAllRelations(listingId);
    if (!listing) return { error: 'Passport listing not found' };

    const documentTypeSamples = await getDocumentTypeSamplesByValues(
      listing.componentsRequired.flatMap((item) =>
        [item.documentType, item.key].filter(Boolean) as string[]
      )
    );

    const config = buildPassportFormConfig({
      listing,
      formSteps: listing.formSteps,
      components: listing.componentsRequired,
      documentTypeSamples,
    });

    const version = await getNextPassportFormVersionNumber(listingId);

    const [created] = await db
      .insert(passportFormVersions)
      .values({
        passportListingId: listingId,
        version,
        config,
        publishedBy: session.user.id,
        publishedAt: new Date(),
      })
      .returning({
        id: passportFormVersions.id,
        version: passportFormVersions.version,
        publishedAt: passportFormVersions.publishedAt,
      });

    revalidateListing(listingId, listing.serviceType);
    return {
      success: true,
      message: `Form version ${created.version} published`,
      version: created.version,
      id: created.id,
      publishedAt: created.publishedAt?.toISOString?.() ?? null,
    };
  } catch (error) {
    console.error('Error publishing passport form version:', error);
    return { error: 'Failed to publish form version' };
  }
}
