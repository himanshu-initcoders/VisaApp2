'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { countries, visaListings, visaListingPrices, additionalQuestions, componentsRequired, faqs, postCheckoutSteps, multiTripCountries } from '@/lib/db/schema-extended';
import { eq, and, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';
import { processBasicInfoSchema, type ProcessBasicInfo, createVisaListingSchema, visaListingPriceSchema, type VisaListingPriceInput, additionalQuestionSchema, type AdditionalQuestion, componentRequiredSchema, type ComponentRequired, faqSchema, type FAQ, postCheckoutStepSchema, type PostCheckoutStep, multiCountrySchema, type MultiCountry } from '@/lib/validations/config';
import { getQuestionById, getMaxQuestionSortOrder, getComponentById, getMaxComponentSortOrder, getFaqById, getMaxFaqSortOrder, getPostCheckoutStepById, getMaxStepSortOrder } from '@/lib/db/queries/config';
import { revalidatePublicVisaCatalog } from '@/lib/revalidate-public-catalog';

/**
 * Server actions for visa listing management
 * All actions require admin role
 */

/**
 * Create a new visa listing for a destination country
 */
export async function createVisaListing(data: unknown) {
  await requireRole(['admin']);

  try {
    const validated = createVisaListingSchema.parse(data);

    const country = await db.query.countries.findFirst({
      where: eq(countries.iso2Code, validated.destinationCountry),
      columns: { id: true, iso2Code: true },
    });

    if (!country) {
      return { error: `Destination country ${validated.destinationCountry} does not exist` };
    }

    const [created] = await db
      .insert(visaListings)
      .values({
        processName: validated.processName,
        destinationCountry: validated.destinationCountry,
        processType: validated.processType,
        purpose: validated.purpose,
        processTypeLabel: validated.processTypeLabel || null,
        entryType: validated.entryType || null,
        processPhysical: validated.processPhysical,
        standardEtaDuration: validated.standardEtaDuration ?? null,
        standardEtaUnit: validated.standardEtaUnit ?? null,
        isMultipleEntry: validated.isMultipleEntry,
        familyEnabled: validated.familyEnabled,
        unsupported: validated.unsupported,
        visaOnArrival: validated.visaOnArrival,
        visaFree: validated.visaFree,
        sourceUrl: validated.sourceUrl || null,
      })
      .returning({ id: visaListings.id });

    if (!created) {
      return { error: 'Failed to create visa listing' };
    }

    revalidatePath('/admin/config/visa-listings');
    revalidatePath(`/admin/config/visa-listings?country=${validated.destinationCountry}`);
    revalidatePath(`/admin/config/visa-listings/${created.id}`);
    revalidatePath('/admin/config/countries');
    revalidatePath(`/admin/config/countries/${validated.destinationCountry}`);
    revalidatePublicVisaCatalog({
      countryCode: validated.destinationCountry,
      listingId: created.id,
    });

    return {
      success: true,
      id: created.id,
      message: 'Visa listing created successfully',
    };
  } catch (error) {
    console.error('Error creating visa listing:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid visa listing data provided' };
    }

    return { error: 'Failed to create visa listing' };
  }
}

/**
 * Update core process details shown in Basic Info
 */
export async function updateProcessBasicInfo(processId: string, data: ProcessBasicInfo) {
  await requireRole(['admin']);

  try {
    const validated = processBasicInfoSchema.parse(data);

    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
      columns: {
        id: true,
        destinationCountry: true,
      },
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    await db
      .update(visaListings)
      .set({
        processName: validated.processName,
        processType: validated.processType,
        purpose: validated.purpose,
        processTypeLabel: validated.processTypeLabel || null,
        entryType: validated.entryType || null,
        processPhysical: validated.processPhysical,
        standardEtaDuration: validated.standardEtaDuration ?? null,
        standardEtaUnit: validated.standardEtaUnit ?? null,
        isMultipleEntry: validated.isMultipleEntry,
        familyEnabled: validated.familyEnabled,
        unsupported: validated.unsupported,
        visaOnArrival: validated.visaOnArrival,
        visaFree: validated.visaFree,
        sourceUrl: validated.sourceUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(visaListings.id, processId));

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/basic`);
    revalidatePath(`/admin/config/visa-listings/${processId}/tiers`);
    revalidatePath(`/admin/config/visa-listings/${processId}/forms`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePublicVisaCatalog({
      countryCode: process.destinationCountry,
      listingId: processId,
    });

    return {
      success: true,
      message: 'Process details updated successfully',
    };
  } catch (error) {
    console.error('Error updating process basic info:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid process data provided' };
    }

    return { error: 'Failed to update process details' };
  }
}

/**
 * Create a price option (validity + stay + three fees)
 */
export async function createListingPrice(processId: string, data: VisaListingPriceInput) {
  await requireRole(['admin']);

  try {
    const validated = visaListingPriceSchema.parse(data);

    const listing = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
      columns: { id: true, destinationCountry: true },
    });

    if (!listing) {
      return { error: 'Visa listing not found' };
    }

    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${visaListingPrices.sortOrder}), -1)` })
      .from(visaListingPrices)
      .where(eq(visaListingPrices.visaListingId, processId));

    await db.insert(visaListingPrices).values({
      visaListingId: processId,
      entryValidityAmount: validated.entryValidityAmount,
      entryValidityUnit: validated.entryValidityUnit,
      entryLengthStayAmount: validated.entryLengthStayAmount,
      entryLengthStayUnit: validated.entryLengthStayUnit,
      governmentFeeAmount: validated.governmentFeeAmount,
      serviceFeeAmount: validated.serviceFeeAmount,
      governmentGstFeeAmount: validated.governmentGstFeeAmount,
      sortOrder: validated.sortOrder ?? maxOrder + 1,
    });

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/tiers`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePublicVisaCatalog({
      countryCode: listing.destinationCountry,
      listingId: processId,
    });

    return { success: true, message: 'Price option created' };
  } catch (error) {
    console.error('Error creating listing price:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid price data provided' };
    }
    return { error: 'Failed to create price option' };
  }
}

/**
 * Update a price option
 */
export async function updateListingPrice(priceId: string, data: VisaListingPriceInput) {
  await requireRole(['admin']);

  try {
    const validated = visaListingPriceSchema.parse(data);

    const price = await db.query.visaListingPrices.findFirst({
      where: eq(visaListingPrices.id, priceId),
    });

    if (!price) {
      return { error: 'Price option not found' };
    }

    await db
      .update(visaListingPrices)
      .set({
        entryValidityAmount: validated.entryValidityAmount,
        entryValidityUnit: validated.entryValidityUnit,
        entryLengthStayAmount: validated.entryLengthStayAmount,
        entryLengthStayUnit: validated.entryLengthStayUnit,
        governmentFeeAmount: validated.governmentFeeAmount,
        serviceFeeAmount: validated.serviceFeeAmount,
        governmentGstFeeAmount: validated.governmentGstFeeAmount,
        ...(validated.sortOrder !== undefined ? { sortOrder: validated.sortOrder } : {}),
      })
      .where(eq(visaListingPrices.id, priceId));

    const processId = price.visaListingId;
    const listing = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
      columns: { destinationCountry: true },
    });
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/tiers`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePublicVisaCatalog({
      countryCode: listing?.destinationCountry,
      listingId: processId,
    });

    return { success: true, message: 'Price option updated' };
  } catch (error) {
    console.error('Error updating listing price:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid price data provided' };
    }
    return { error: 'Failed to update price option' };
  }
}

/**
 * Delete a price option
 */
export async function deleteListingPrice(priceId: string) {
  await requireRole(['admin']);

  try {
    const price = await db.query.visaListingPrices.findFirst({
      where: eq(visaListingPrices.id, priceId),
    });

    if (!price) {
      return { error: 'Price option not found' };
    }

    await db.delete(visaListingPrices).where(eq(visaListingPrices.id, priceId));

    const processId = price.visaListingId;
    const listing = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
      columns: { destinationCountry: true },
    });
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/tiers`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePublicVisaCatalog({
      countryCode: listing?.destinationCountry,
      listingId: processId,
    });

    return { success: true, message: 'Price option deleted' };
  } catch (error) {
    console.error('Error deleting listing price:', error);
    return { error: 'Failed to delete price option' };
  }
}

/**
 * Get process basic info for breadcrumbs/headers
 */
export async function getProcessInfo(processId: string) {
  await requireRole(['admin', 'reviewer']);

  try {
    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
      with: {
        country: {
          columns: {
            name: true,
            iso2Code: true
          }
        }
      }
    });

    if (!process) {
      return { error: 'Process not found' };
    }

    return { success: true, process };
  } catch (error) {
    console.error('Error fetching process:', error);
    return { error: 'Failed to fetch process details' };
  }
}

/**
 * Create new additional question for a process
 */
export async function createQuestion(processId: string, data: AdditionalQuestion) {
  await requireRole(['admin']);

  try {
    // Validate input
    const validated = additionalQuestionSchema.parse(data);

    // Check if process exists
    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId)
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    // Get max sortOrder and increment
    const maxOrder = await getMaxQuestionSortOrder(processId);

    // Create question
    await db.insert(additionalQuestions).values({
      visaListingId: processId,
      key: validated.key,
      label: validated.label,
      description: validated.description || null,
      questionType: validated.questionType,
      required: validated.required,
      familyEnabled: validated.familyEnabled,
      onlyB2b: validated.onlyB2b,
      extraInfo: validated.extraInfo || null,
      requiredDoc: validated.requiredDoc || null,
      sourceUrl: validated.sourceUrl || null,
      options: validated.options || [],
      sortOrder: maxOrder + 1
    });

    // Revalidate pages
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/forms`);
    revalidatePath('/admin/config/visa-listings');

    return {
      success: true,
      message: 'Question created successfully'
    };
  } catch (error) {
    console.error('Error creating question:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid question data provided' };
    }

    return { error: 'Failed to create question' };
  }
}

/**
 * Update existing additional question
 */
export async function updateQuestion(questionId: string, data: AdditionalQuestion) {
  await requireRole(['admin']);

  try {
    // Validate input
    const validated = additionalQuestionSchema.parse(data);

    // Check if question exists
    const question = await getQuestionById(questionId);

    if (!question) {
      return { error: 'Question not found' };
    }

    // Update question
    await db
      .update(additionalQuestions)
      .set({
        key: validated.key,
        label: validated.label,
        description: validated.description || null,
        questionType: validated.questionType,
        required: validated.required,
        familyEnabled: validated.familyEnabled,
        onlyB2b: validated.onlyB2b,
        extraInfo: validated.extraInfo || null,
        requiredDoc: validated.requiredDoc || null,
        sourceUrl: validated.sourceUrl || null,
        options: validated.options || []
      })
      .where(eq(additionalQuestions.id, questionId));

    // Revalidate pages
    const processId = question.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/forms`);
    revalidatePath('/admin/config/visa-listings');

    return {
      success: true,
      message: 'Question updated successfully'
    };
  } catch (error) {
    console.error('Error updating question:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid question data provided' };
    }

    return { error: 'Failed to update question' };
  }
}

/**
 * Delete additional question
 */
export async function deleteQuestion(questionId: string) {
  await requireRole(['admin']);

  try {
    // Get question info before deleting
    const question = await getQuestionById(questionId);

    if (!question) {
      return { error: 'Question not found' };
    }

    // Delete question
    await db.delete(additionalQuestions).where(eq(additionalQuestions.id, questionId));

    // Revalidate pages
    const processId = question.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/forms`);
    revalidatePath('/admin/config/visa-listings');

    return {
      success: true,
      message: 'Question deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting question:', error);
    return { error: 'Failed to delete question' };
  }
}

/**
 * Reorder questions (for drag-and-drop)
 */
export async function reorderQuestions(processId: string, questionIds: string[]) {
  await requireRole(['admin']);

  try {
    // Update sortOrder for each question based on array index
    await db.transaction(async (tx) => {
      for (let i = 0; i < questionIds.length; i++) {
        await tx
          .update(additionalQuestions)
          .set({ sortOrder: i })
          .where(eq(additionalQuestions.id, questionIds[i]));
      }
    });

    // Revalidate pages
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/forms`);
    revalidatePath('/admin/config/visa-listings');

    return {
      success: true,
      message: 'Questions reordered successfully'
    };
  } catch (error) {
    console.error('Error reordering questions:', error);
    return { error: 'Failed to reorder questions' };
  }
}

/**
 * Create new document requirement for a process
 */
export async function createComponent(processId: string, data: ComponentRequired) {
  await requireRole(['admin']);

  try {
    // Validate input
    const validated = componentRequiredSchema.parse(data);

    // Check if process exists
    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId)
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    // Get max sortOrder and increment
    const maxOrder = await getMaxComponentSortOrder(processId);

    // Create component
    const [created] = await db
      .insert(componentsRequired)
      .values({
        visaListingId: processId,
        key: validated.key,
        amount: validated.amount,
        chargeable: validated.chargeable,
        familyEnabled: validated.familyEnabled,
        onlyB2b: validated.onlyB2b,
        toggle: validated.toggle,
        attributes: validated.attributes || [],
        sourceUrl: validated.sourceUrl || null,
        sortOrder: maxOrder + 1,
      })
      .returning();

    // Revalidate pages (including Add Visa wizard)
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePath('/admin/config/visa-listings/new');

    return {
      success: true,
      message: 'Document requirement created successfully',
      component: created,
    };
  } catch (error) {
    console.error('Error creating component:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid component data provided' };
    }

    return { error: 'Failed to create document requirement' };
  }
}

/**
 * Update existing document requirement
 */
export async function updateComponent(componentId: string, data: ComponentRequired) {
  await requireRole(['admin']);

  try {
    // Validate input
    const validated = componentRequiredSchema.parse(data);

    // Check if component exists
    const component = await getComponentById(componentId);

    if (!component) {
      return { error: 'Document requirement not found' };
    }

    // Update component
    const [updated] = await db
      .update(componentsRequired)
      .set({
        key: validated.key,
        amount: validated.amount,
        chargeable: validated.chargeable,
        familyEnabled: validated.familyEnabled,
        onlyB2b: validated.onlyB2b,
        toggle: validated.toggle,
        attributes: validated.attributes || [],
        sourceUrl: validated.sourceUrl || null,
      })
      .where(eq(componentsRequired.id, componentId))
      .returning();

    // Revalidate pages
    const processId = component.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePath('/admin/config/visa-listings/new');

    return {
      success: true,
      message: 'Document requirement updated successfully',
      component: updated,
    };
  } catch (error) {
    console.error('Error updating component:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid component data provided' };
    }

    return { error: 'Failed to update document requirement' };
  }
}

/**
 * Delete document requirement
 */
export async function deleteComponent(componentId: string) {
  await requireRole(['admin']);

  try {
    // Get component info before deleting
    const component = await getComponentById(componentId);

    if (!component) {
      return { error: 'Document requirement not found' };
    }

    // Delete component
    await db.delete(componentsRequired).where(eq(componentsRequired.id, componentId));

    // Revalidate pages
    const processId = component.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePath('/admin/config/visa-listings/new');

    return {
      success: true,
      message: 'Document requirement deleted successfully',
      id: componentId,
    };
  } catch (error) {
    console.error('Error deleting component:', error);
    return { error: 'Failed to delete document requirement' };
  }
}

/**
 * Reorder document requirements (for drag-and-drop)
 */
export async function reorderComponents(processId: string, componentIds: string[]) {
  await requireRole(['admin']);

  try {
    // Update sortOrder for each component based on array index
    await db.transaction(async (tx) => {
      for (let i = 0; i < componentIds.length; i++) {
        await tx
          .update(componentsRequired)
          .set({ sortOrder: i })
          .where(eq(componentsRequired.id, componentIds[i]));
      }
    });

    // Revalidate pages
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');

    return {
      success: true,
      message: 'Document requirements reordered successfully'
    };
  } catch (error) {
    console.error('Error reordering components:', error);
    return { error: 'Failed to reorder document requirements' };
  }
}

/**
 * Create new FAQ for a process
 */
export async function createFaq(processId: string, data: FAQ) {
  await requireRole(['admin']);

  try {
    const validated = faqSchema.parse(data);

    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId)
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    const maxOrder = await getMaxFaqSortOrder(processId);

    await db.insert(faqs).values({
      visaListingId: processId,
      question: validated.question,
      answer: validated.answer,
      category: validated.category || null,
      sortOrder: maxOrder + 1
    });

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'FAQ created successfully' };
  } catch (error) {
    console.error('Error creating FAQ:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid FAQ data provided' };
    }
    return { error: 'Failed to create FAQ' };
  }
}

/**
 * Update existing FAQ
 */
export async function updateFaq(faqId: string, data: FAQ) {
  await requireRole(['admin']);

  try {
    const validated = faqSchema.parse(data);
    const faq = await getFaqById(faqId);

    if (!faq) {
      return { error: 'FAQ not found' };
    }

    await db
      .update(faqs)
      .set({
        question: validated.question,
        answer: validated.answer,
        category: validated.category || null
      })
      .where(eq(faqs.id, faqId));

    const processId = faq.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'FAQ updated successfully' };
  } catch (error) {
    console.error('Error updating FAQ:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid FAQ data provided' };
    }
    return { error: 'Failed to update FAQ' };
  }
}

/**
 * Delete FAQ
 */
export async function deleteFaq(faqId: string) {
  await requireRole(['admin']);

  try {
    const faq = await getFaqById(faqId);

    if (!faq) {
      return { error: 'FAQ not found' };
    }

    await db.delete(faqs).where(eq(faqs.id, faqId));

    const processId = faq.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'FAQ deleted successfully' };
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return { error: 'Failed to delete FAQ' };
  }
}

/**
 * Reorder FAQs (for drag-and-drop)
 */
export async function reorderFaqs(processId: string, faqIds: string[]) {
  await requireRole(['admin']);

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < faqIds.length; i++) {
        await tx
          .update(faqs)
          .set({ sortOrder: i })
          .where(eq(faqs.id, faqIds[i]));
      }
    });

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'FAQs reordered successfully' };
  } catch (error) {
    console.error('Error reordering FAQs:', error);
    return { error: 'Failed to reorder FAQs' };
  }
}

/**
 * Create new post-checkout step for a process
 */
export async function createPostCheckoutStep(processId: string, data: PostCheckoutStep) {
  await requireRole(['admin']);

  try {
    const validated = postCheckoutStepSchema.parse(data);

    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId)
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    const maxOrder = await getMaxStepSortOrder(processId);

    await db.insert(postCheckoutSteps).values({
      visaListingId: processId,
      heading: validated.heading,
      subheading: validated.subheading || null,
      sortOrder: maxOrder + 1
    });

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'Post-checkout step created successfully' };
  } catch (error) {
    console.error('Error creating post-checkout step:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid step data provided' };
    }
    return { error: 'Failed to create post-checkout step' };
  }
}

/**
 * Update existing post-checkout step
 */
export async function updatePostCheckoutStep(stepId: string, data: PostCheckoutStep) {
  await requireRole(['admin']);

  try {
    const validated = postCheckoutStepSchema.parse(data);
    const step = await getPostCheckoutStepById(stepId);

    if (!step) {
      return { error: 'Post-checkout step not found' };
    }

    await db
      .update(postCheckoutSteps)
      .set({
        heading: validated.heading,
        subheading: validated.subheading || null
      })
      .where(eq(postCheckoutSteps.id, stepId));

    const processId = step.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'Post-checkout step updated successfully' };
  } catch (error) {
    console.error('Error updating post-checkout step:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid step data provided' };
    }
    return { error: 'Failed to update post-checkout step' };
  }
}

/**
 * Delete post-checkout step
 */
export async function deletePostCheckoutStep(stepId: string) {
  await requireRole(['admin']);

  try {
    const step = await getPostCheckoutStepById(stepId);

    if (!step) {
      return { error: 'Post-checkout step not found' };
    }

    await db.delete(postCheckoutSteps).where(eq(postCheckoutSteps.id, stepId));

    const processId = step.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'Post-checkout step deleted successfully' };
  } catch (error) {
    console.error('Error deleting post-checkout step:', error);
    return { error: 'Failed to delete post-checkout step' };
  }
}

/**
 * Reorder post-checkout steps (for drag-and-drop)
 */
export async function reorderPostCheckoutSteps(processId: string, stepIds: string[]) {
  await requireRole(['admin']);

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < stepIds.length; i++) {
        await tx
          .update(postCheckoutSteps)
          .set({ sortOrder: i })
          .where(eq(postCheckoutSteps.id, stepIds[i]));
      }
    });

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'Post-checkout steps reordered successfully' };
  } catch (error) {
    console.error('Error reordering post-checkout steps:', error);
    return { error: 'Failed to reorder post-checkout steps' };
  }
}

/**
 * Add multi-trip country to a visa process
 */
export async function addMultiTripCountry(processId: string, data: MultiCountry) {
  await requireRole(['admin']);

  try {
    const validated = multiCountrySchema.parse(data);

    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId)
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    // Check if country already exists
    const existing = await db.query.multiTripCountries.findFirst({
      where: eq(multiTripCountries.visaListingId, processId)
    });

    await db.insert(multiTripCountries).values({
      visaListingId: processId,
      additionalCountryCode: validated.additionalCountryCode.toUpperCase()
    });

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'Multi-trip country added successfully' };
  } catch (error) {
    console.error('Error adding multi-trip country:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid country code provided' };
    }
    return { error: 'Failed to add multi-trip country' };
  }
}

/**
 * Remove multi-trip country from a visa process
 */
export async function removeMultiTripCountry(countryId: string) {
  await requireRole(['admin']);

  try {
    const country = await db.query.multiTripCountries.findFirst({
      where: eq(multiTripCountries.id, countryId)
    });

    if (!country) {
      return { error: 'Multi-trip country not found' };
    }

    await db.delete(multiTripCountries).where(eq(multiTripCountries.id, countryId));

    const processId = country.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');

    return { success: true, message: 'Multi-trip country removed successfully' };
  } catch (error) {
    console.error('Error removing multi-trip country:', error);
    return { error: 'Failed to remove multi-trip country' };
  }
}
