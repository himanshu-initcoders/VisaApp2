'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { countries, visaListings, visaListingPrices, visaFormSteps, additionalQuestions, questionCatalog, componentsRequired, faqs, postCheckoutSteps, multiTripCountries } from '@/lib/db/schema-extended';
import { eq, and, sql, ne } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';
import { processBasicInfoSchema, type ProcessBasicInfo, createVisaListingSchema, visaListingPriceSchema, type VisaListingPriceInput, additionalQuestionSchema, type AdditionalQuestion, visaFormStepSchema, type VisaFormStepInput, componentRequiredSchema, type ComponentRequired, createComponentsBulkSchema, type CreateComponentsBulk, faqSchema, type FAQ, postCheckoutStepSchema, type PostCheckoutStep, multiCountrySchema, type MultiCountry } from '@/lib/validations/config';
import {
  getQuestionById,
  getMaxQuestionSortOrder,
  getMaxQuestionSortOrderForStep,
  getMaxVisaStepSortOrder,
  getVisaFormStepById,
  getAdditionalQuestions,
  searchQuestionCatalogByLabel,
  getQuestionCatalogById,
  createQuestionCatalogEntry,
  listingHasCatalogQuestion,
  getComponentById,
  getMaxComponentSortOrder,
  getComponentsRequired,
  getFaqById,
  getMaxFaqSortOrder,
  getPostCheckoutStepById,
  getMaxStepSortOrder,
  getProcessWithAllRelations,
  getDocumentTypeByValue,
  getDocumentTypeSamplesByValues,
} from '@/lib/db/queries/config';
import { seedDefaultVisaFormSteps } from '@/lib/db/seedVisaFormSteps';
import { isLockedOcrSystemKey } from '@/lib/apply/visaSystemFields';
import { revalidatePublicVisaCatalog } from '@/lib/revalidate-public-catalog';
import { documentTypeLabel } from '@/lib/document-types';
import { validateVisibilityAgainstSiblings } from '@/lib/question-visibility';
import { normalizeDocumentConditions } from '@/lib/document-conditions';
import { sanitizeBlogHtml } from '@/lib/blog/sanitize';

/** Sanitize TinyMCE overview HTML; empty / whitespace-only markup becomes null. */
function normalizeOverviewHtml(html: string | null | undefined): string | null {
  const cleaned = sanitizeBlogHtml(html ?? '').trim();
  if (!cleaned) return null;
  if (cleaned.replace(/<[^>]*>/g, '').trim().length === 0) return null;
  return cleaned;
}

/**
 * Invalidate public static catalog pages whenever any listing attribute changes.
 */
async function revalidateListingPublic(processId: string) {
  try {
    const listing = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
      columns: { id: true, slug: true, destinationCountry: true },
    });

    if (listing) {
      await revalidatePublicVisaCatalog({
        countryCode: listing.destinationCountry,
        listingId: listing.id,
        listingSlug: listing.slug,
      });
    } else {
      await revalidatePublicVisaCatalog();
    }
  } catch (error) {
    console.warn('Failed to revalidate public visa catalog:', error);
  }
}

/**
 * Ensure catalog document types exist on the listing's components_required.
 * Skips types already attached. Returns how many were newly attached.
 */
async function ensureDocumentTypesAttached(
  processId: string,
  documentTypes: string[]
): Promise<number> {
  const uniqueTypes = [...new Set(documentTypes.map((t) => t.trim()).filter(Boolean))];
  if (uniqueTypes.length === 0) return 0;

  const existing = await getComponentsRequired(processId);
  const existingTypes = new Set(
    existing.map((item) => item.documentType || item.key).filter(Boolean)
  );

  const missing = uniqueTypes.filter((type) => !existingTypes.has(type));
  if (missing.length === 0) return 0;

  const catalogMap = await getDocumentTypeSamplesByValues(missing);
  const unknown = missing.filter((type) => !catalogMap.has(type));
  if (unknown.length > 0) {
    throw new Error(`Unknown document type(s): ${unknown.join(', ')}`);
  }

  let nextOrder = (await getMaxComponentSortOrder(processId)) + 1;
  const rows = missing.map((documentType) => ({
    visaListingId: processId,
    key: crypto.randomUUID(),
    documentType,
    label: catalogMap.get(documentType)?.label || documentTypeLabel(documentType),
    amount: '0' as const,
    chargeable: false,
    familyEnabled: false,
    onlyB2b: false,
    toggle: false,
    attributes: [] as string[],
    sourceUrl: null,
    sortOrder: nextOrder++,
  }));

  await db.insert(componentsRequired).values(rows);
  return rows.length;
}

const SLUG_TAKEN_ERROR = 'This URL slug is already used for this country';

async function findSlugOwner(
  destinationCountry: string,
  slug: string,
  excludeId?: string
) {
  const filters = [
    eq(visaListings.destinationCountry, destinationCountry),
    sql`lower(${visaListings.slug}) = ${slug.toLowerCase()}`,
  ];
  if (excludeId) {
    filters.push(ne(visaListings.id, excludeId));
  }

  return db.query.visaListings.findFirst({
    where: and(...filters),
    columns: { id: true },
  });
}

function invalidListingError(error: unknown, fallback: string) {
  if (error instanceof Error && error.name === 'ZodError' && 'issues' in error) {
    const issue = (
      error as { issues?: Array<{ message?: string; path?: Array<PropertyKey> }> }
    ).issues?.[0];
    const pathKey = issue?.path?.[0];
    const field =
      pathKey === 'slug' || pathKey === 'purpose'
        ? (pathKey as 'slug' | 'purpose')
        : undefined;
    return {
      success: false as const,
      error: issue?.message || 'Invalid visa listing data provided',
      field,
    };
  }

  if (
    error instanceof Error &&
    /visa_listings_country_slug_unique|duplicate key/i.test(error.message)
  ) {
    return {
      success: false as const,
      error: SLUG_TAKEN_ERROR,
      field: 'slug' as const,
    };
  }

  return { success: false as const, error: fallback };
}

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
      return {
        success: false as const,
        error: `Destination country ${validated.destinationCountry} does not exist`,
      };
    }

    const slugTaken = await findSlugOwner(
      validated.destinationCountry,
      validated.slug
    );
    if (slugTaken) {
      return { success: false as const, error: SLUG_TAKEN_ERROR, field: 'slug' as const };
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
        isActive: validated.isActive,
        visaOnArrival: validated.visaOnArrival,
        visaFree: validated.visaFree,
        withFreeInsurance: validated.withFreeInsurance,
        showGeneralInfo: true,
        showTripDetails: true,
        showInsuranceInterest: validated.withFreeInsurance
          ? false
          : validated.showInsuranceInterest,
        sourceUrl: validated.sourceUrl || null,
        description: normalizeOverviewHtml(validated.description),
        slug: validated.slug,
      })
      .returning({ id: visaListings.id });

    if (!created) {
      return { success: false as const, error: 'Failed to create visa listing' };
    }

    await seedDefaultVisaFormSteps(created.id);

    revalidatePath('/admin/config/visa-listings');
    revalidatePath(`/admin/config/visa-listings?country=${validated.destinationCountry}`);
    revalidatePath(`/admin/config/visa-listings/${created.id}`);
    revalidatePath('/admin/config/countries');
    revalidatePath(`/admin/config/countries/${validated.destinationCountry}`);
    revalidatePublicVisaCatalog({
      countryCode: validated.destinationCountry,
      listingId: created.id,
      listingSlug: validated.slug,
    });

    return {
      success: true as const,
      id: created.id,
      message: 'Visa listing created successfully',
    };
  } catch (error) {
    console.error('Error creating visa listing:', error);
    return invalidListingError(error, 'Failed to create visa listing');
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
        slug: true,
      },
    });

    if (!process) {
      return { success: false as const, error: 'Visa listing not found' };
    }

    const slugTaken = await findSlugOwner(
      process.destinationCountry,
      validated.slug,
      processId
    );
    if (slugTaken) {
      return {
        success: false as const,
        error: SLUG_TAKEN_ERROR,
        field: 'slug' as const,
      };
    }

    await db
      .update(visaListings)
      .set({
        processName: validated.processName,
        slug: validated.slug,
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
        isActive: validated.isActive,
        visaOnArrival: validated.visaOnArrival,
        visaFree: validated.visaFree,
        withFreeInsurance: validated.withFreeInsurance,
        showInsuranceInterest: validated.withFreeInsurance
          ? false
          : validated.showInsuranceInterest,
        sourceUrl: validated.sourceUrl || null,
        description: normalizeOverviewHtml(validated.description),
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
      listingSlug: validated.slug,
      previousSlug: process.slug,
    });

    return {
      success: true as const,
      message: 'Process details updated successfully',
    };
  } catch (error) {
    console.error('Error updating process basic info:', error);
    return invalidListingError(error, 'Failed to update process details');
  }
}

/**
 * Toggle public visibility for a visa listing (Visible / Hidden).
 */
export async function toggleVisaListingVisibility(processId: string) {
  await requireRole(['admin']);

  try {
    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
      columns: {
        id: true,
        isActive: true,
        destinationCountry: true,
        slug: true,
        processName: true,
      },
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    const nextActive = !process.isActive;

    await db
      .update(visaListings)
      .set({ isActive: nextActive, updatedAt: new Date() })
      .where(eq(visaListings.id, processId));

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/basic`);
    revalidatePath('/admin/config/visa-listings');
    await revalidateListingPublic(processId);

    return {
      success: true,
      isActive: nextActive,
      message: nextActive
        ? 'Visa listing is now visible to travelers'
        : 'Visa listing is now hidden from travelers',
    };
  } catch (error) {
    console.error('Error toggling visa listing visibility:', error);
    return { error: 'Failed to update visibility status' };
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
 * Suggest shared catalog questions for admin Form Builder autocomplete.
 */
export async function suggestQuestions(query: string, excludeId?: string) {
  await requireRole(['admin']);

  try {
    const suggestions = await searchQuestionCatalogByLabel(query, {
      excludeCatalogId: excludeId,
      limit: 10,
    });
    return { success: true as const, suggestions };
  } catch (error) {
    console.error('Error suggesting questions:', error);
    return { error: 'Failed to search questions', suggestions: [] as const };
  }
}

/**
 * Create new additional question for a process.
 * Attaches shared catalog identity when catalogQuestionId is provided; otherwise creates catalog + listing row.
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

    const step = await getVisaFormStepById(validated.stepId);
    if (!step || step.visaListingId !== processId) {
      return { error: 'Form step not found on this listing' };
    }

    // Get max sortOrder within the step
    const maxOrder = await getMaxQuestionSortOrderForStep(validated.stepId);

    const siblings = await getAdditionalQuestions(processId);
    const visibilityError = validateVisibilityAgainstSiblings({
      questionKey: null,
      visibility: validated.visibility ?? null,
      siblings,
    });
    if (visibilityError) {
      return { error: visibilityError };
    }

    const documentConditions = validated.documentConditions ?? null;

    let catalogId = validated.catalogQuestionId ?? null;
    let questionKey = validated.key?.trim() || '';

    if (catalogId) {
      const catalog = await getQuestionCatalogById(catalogId);
      if (!catalog) {
        return { error: 'Catalog question not found' };
      }
      if (await listingHasCatalogQuestion(processId, catalogId)) {
        return { error: 'This question is already on this listing' };
      }
      questionKey = catalog.key;
    } else {
      const catalog = await createQuestionCatalogEntry({
        key: questionKey || undefined,
        label: validated.label,
        description: validated.description || null,
        questionType: validated.questionType,
        options: validated.options || [],
      });
      catalogId = catalog.id;
      questionKey = catalog.key;
    }

    // Create listing attachment (step-scoped; category kept for legacy compat)
    await db.insert(additionalQuestions).values({
      visaListingId: processId,
      stepId: validated.stepId,
      catalogQuestionId: catalogId,
      key: questionKey,
      label: validated.label,
      description: validated.description || null,
      questionType: validated.questionType,
      category: validated.category ?? 'other',
      required: validated.required,
      familyEnabled: false,
      onlyB2b: false,
      extraInfo: null,
      requiredDoc: validated.requiredDoc || null,
      sourceUrl: null,
      options: validated.options || [],
      visibility: validated.visibility ?? null,
      documentConditions,
      sortOrder: maxOrder + 1
    });

    const conditionDocs =
      normalizeDocumentConditions(documentConditions)?.documents.map((d) => d.documentType) ??
      [];
    try {
      await ensureDocumentTypesAttached(processId, conditionDocs);
    } catch (attachError) {
      console.error('Error attaching document types for question:', attachError);
      return {
        error:
          attachError instanceof Error
            ? attachError.message
            : 'Failed to attach document types for this question',
      };
    }

    // Revalidate pages
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/forms`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');
    await revalidateListingPublic(processId);

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

    const siblings = await getAdditionalQuestions(question.visaListingId);
    const visibilityError = validateVisibilityAgainstSiblings({
      questionKey: question.key,
      visibility: validated.visibility ?? null,
      siblings,
    });
    if (visibilityError) {
      return { error: visibilityError };
    }

    const documentConditions = validated.documentConditions ?? null;

    const step = await getVisaFormStepById(validated.stepId);
    if (!step || step.visaListingId !== question.visaListingId) {
      return { error: 'Form step not found on this listing' };
    }

    // Update listing row. Key + catalogQuestionId + systemKey stay immutable after create.
    await db
      .update(additionalQuestions)
      .set({
        stepId: validated.stepId,
        label: validated.label,
        description: validated.description || null,
        questionType: validated.questionType,
        category: validated.category ?? question.category ?? 'other',
        required: validated.required,
        requiredDoc: validated.requiredDoc || null,
        options: validated.options || [],
        visibility: validated.visibility ?? null,
        documentConditions,
      })
      .where(eq(additionalQuestions.id, questionId));

    // Keep catalog identity fields in sync for future autocomplete.
    if (question.catalogQuestionId) {
      await db
        .update(questionCatalog)
        .set({
          label: validated.label,
          description: validated.description || null,
          questionType: validated.questionType,
          options: validated.options || [],
          updatedAt: new Date(),
        })
        .where(eq(questionCatalog.id, question.catalogQuestionId));
    }

    const processId = question.visaListingId;
    const conditionDocs =
      normalizeDocumentConditions(documentConditions)?.documents.map((d) => d.documentType) ??
      [];
    try {
      await ensureDocumentTypesAttached(processId, conditionDocs);
    } catch (attachError) {
      console.error('Error attaching document types for question:', attachError);
      return {
        error:
          attachError instanceof Error
            ? attachError.message
            : 'Failed to attach document types for this question',
      };
    }

    // Revalidate pages
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/forms`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');
    await revalidateListingPublic(processId);

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

    if (isLockedOcrSystemKey(question.systemKey)) {
      return {
        error:
          'First name, last name, and passport number cannot be deleted from the OCR step',
      };
    }

    // Delete question
    await db.delete(additionalQuestions).where(eq(additionalQuestions.id, questionId));

    // Revalidate pages
    const processId = question.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/forms`);
    revalidatePath('/admin/config/visa-listings');
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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

    const catalogType = await getDocumentTypeByValue(validated.documentType);
    if (!catalogType) {
      return { error: `Unknown document type "${validated.documentType}"` };
    }

    // Get max sortOrder and increment
    const maxOrder = await getMaxComponentSortOrder(processId);

    // Create component
    const [created] = await db
      .insert(componentsRequired)
      .values({
        visaListingId: processId,
        key: crypto.randomUUID(),
        documentType: validated.documentType,
        label: validated.label?.trim() || catalogType.label,
        amount: '0',
        chargeable: false,
        familyEnabled: false,
        onlyB2b: false,
        toggle: false,
        attributes: [],
        sourceUrl: null,
        sortOrder: maxOrder + 1,
      })
      .returning();

    // Revalidate pages (including Add Visa wizard)
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePath('/admin/config/visa-listings/new');
    await revalidateListingPublic(processId);

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
 * Create multiple document requirements in one action
 */
export async function createComponents(processId: string, data: CreateComponentsBulk) {
  await requireRole(['admin']);

  try {
    const validated = createComponentsBulkSchema.parse(data);

    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    const existing = await getComponentsRequired(processId);
    const existingTypes = new Set(
      existing
        .map((item) => item.documentType || item.key)
        .filter(Boolean)
    );

    const uniqueTypes = [...new Set(validated.documentTypes)].filter(
      (type) => !existingTypes.has(type)
    );

    if (uniqueTypes.length === 0) {
      return { error: 'Those document types are already added' };
    }

    const catalogMap = await getDocumentTypeSamplesByValues(uniqueTypes);
    const unknown = uniqueTypes.filter((type) => !catalogMap.has(type));
    if (unknown.length > 0) {
      return { error: `Unknown document type(s): ${unknown.join(', ')}` };
    }

    let nextOrder = (await getMaxComponentSortOrder(processId)) + 1;
    const rows = uniqueTypes.map((documentType) => ({
      visaListingId: processId,
      key: crypto.randomUUID(),
      documentType,
      label: catalogMap.get(documentType)?.label || documentTypeLabel(documentType),
      amount: '0' as const,
      chargeable: false,
      familyEnabled: false,
      onlyB2b: false,
      toggle: false,
      attributes: [] as string[],
      sourceUrl: null,
      sortOrder: nextOrder++,
    }));

    const created = await db.insert(componentsRequired).values(rows).returning();

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePath('/admin/config/visa-listings/new');
    await revalidateListingPublic(processId);

    return {
      success: true,
      message: `${created.length} document requirement${created.length === 1 ? '' : 's'} created`,
      components: created,
    };
  } catch (error) {
    console.error('Error creating components:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid component data provided' };
    }

    return { error: 'Failed to create document requirements' };
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

    const catalogType = await getDocumentTypeByValue(validated.documentType);
    if (!catalogType) {
      return { error: `Unknown document type "${validated.documentType}"` };
    }

    // Update component (key stays UUID; type/label are editable)
    const [updated] = await db
      .update(componentsRequired)
      .set({
        documentType: validated.documentType,
        label: validated.label?.trim() || catalogType.label,
        amount: '0',
        chargeable: false,
        familyEnabled: false,
        onlyB2b: false,
        toggle: false,
        attributes: [],
        sourceUrl: null,
      })
      .where(eq(componentsRequired.id, componentId))
      .returning();

    // Revalidate pages
    const processId = component.visaListingId;
    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/docs`);
    revalidatePath('/admin/config/visa-listings');
    revalidatePath('/admin/config/visa-listings/new');
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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
 * Update listing-specific disclaimer (TinyMCE HTML) shown on the public page.
 */
export async function updateListingDisclaimer(
  processId: string,
  disclaimerHtml: string
) {
  await requireRole(['admin']);

  try {
    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, processId),
      columns: { id: true },
    });

    if (!process) {
      return { error: 'Visa listing not found' };
    }

    const cleaned = sanitizeBlogHtml(disclaimerHtml ?? '').trim();

    await db
      .update(visaListings)
      .set({
        disclaimer: cleaned.length > 0 ? cleaned : null,
        updatedAt: new Date(),
      })
      .where(eq(visaListings.id, processId));

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');
    await revalidateListingPublic(processId);

    return { success: true, message: 'Disclaimer saved successfully' };
  } catch (error) {
    console.error('Error updating listing disclaimer:', error);
    return { error: 'Failed to save disclaimer' };
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
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

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

    const code = validated.additionalCountryCode.toUpperCase();

    if (process.destinationCountry?.toUpperCase() === code) {
      return { error: 'That country is already the primary destination' };
    }

    const existing = await db.query.multiTripCountries.findFirst({
      where: and(
        eq(multiTripCountries.visaListingId, processId),
        eq(multiTripCountries.additionalCountryCode, code)
      ),
    });

    if (existing) {
      return { error: 'This country is already added to multi-country support' };
    }

    await db.insert(multiTripCountries).values({
      visaListingId: processId,
      additionalCountryCode: code,
    });

    revalidatePath(`/admin/config/visa-listings/${processId}`);
    revalidatePath(`/admin/config/visa-listings/${processId}/content`);
    revalidatePath('/admin/config/visa-listings');
    await revalidateListingPublic(processId);

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
    await revalidateListingPublic(processId);

    return { success: true, message: 'Multi-trip country removed successfully' };
  } catch (error) {
    console.error('Error removing multi-trip country:', error);
    return { error: 'Failed to remove multi-trip country' };
  }
}

/**
 * Create a custom Form Builder step (OCR/Trip are seeded; OCR cannot be deleted).
 */
export async function createVisaFormStep(
  listingId: string,
  data: VisaFormStepInput
) {
  await requireRole(['admin']);

  try {
    const validated = visaFormStepSchema.parse(data);
    const process = await db.query.visaListings.findFirst({
      where: eq(visaListings.id, listingId),
      columns: { id: true },
    });
    if (!process) return { error: 'Visa listing not found' };

    const sortOrder = (await getMaxVisaStepSortOrder(listingId)) + 1;
    const [created] = await db
      .insert(visaFormSteps)
      .values({
        visaListingId: listingId,
        title: validated.title,
        description: validated.description || null,
        kind: 'custom',
        sortOrder: Math.max(sortOrder, 1),
      })
      .returning();

    revalidatePath(`/admin/config/visa-listings/${listingId}/forms`);
    await revalidateListingPublic(listingId);
    return { success: true, message: 'Step created', step: created };
  } catch (error) {
    console.error('Error creating visa form step:', error);
    return { error: 'Failed to create step' };
  }
}

export async function updateVisaFormStep(
  stepId: string,
  data: VisaFormStepInput
) {
  await requireRole(['admin']);

  try {
    const validated = visaFormStepSchema.parse(data);
    const step = await getVisaFormStepById(stepId);
    if (!step) return { error: 'Step not found' };

    await db
      .update(visaFormSteps)
      .set({
        title: validated.title,
        description: validated.description || null,
      })
      .where(eq(visaFormSteps.id, stepId));

    revalidatePath(`/admin/config/visa-listings/${step.visaListingId}/forms`);
    await revalidateListingPublic(step.visaListingId);
    return { success: true, message: 'Step updated' };
  } catch (error) {
    console.error('Error updating visa form step:', error);
    return { error: 'Failed to update step' };
  }
}

export async function deleteVisaFormStep(stepId: string) {
  await requireRole(['admin']);

  try {
    const step = await getVisaFormStepById(stepId);
    if (!step) return { error: 'Step not found' };
    if (step.kind === 'ocr') {
      return { error: 'The Personal details (OCR) step cannot be deleted' };
    }

    await db.delete(visaFormSteps).where(eq(visaFormSteps.id, stepId));

    revalidatePath(`/admin/config/visa-listings/${step.visaListingId}/forms`);
    await revalidateListingPublic(step.visaListingId);
    return { success: true, message: 'Step deleted' };
  } catch (error) {
    console.error('Error deleting visa form step:', error);
    return { error: 'Failed to delete step' };
  }
}

export async function reorderVisaFormSteps(
  listingId: string,
  stepIds: string[]
) {
  await requireRole(['admin']);

  try {
    const steps = await db.query.visaFormSteps.findMany({
      where: eq(visaFormSteps.visaListingId, listingId),
    });
    const byId = new Map(steps.map((s) => [s.id, s]));

    const ocr = steps.find((s) => s.kind === 'ocr');
    let ordered = stepIds.filter((id) => byId.has(id));
    if (ocr) {
      ordered = [ocr.id, ...ordered.filter((id) => id !== ocr.id)];
    }

    await Promise.all(
      ordered.map((id, index) =>
        db
          .update(visaFormSteps)
          .set({ sortOrder: index })
          .where(eq(visaFormSteps.id, id))
      )
    );

    revalidatePath(`/admin/config/visa-listings/${listingId}/forms`);
    await revalidateListingPublic(listingId);
    return { success: true };
  } catch (error) {
    console.error('Error reordering visa form steps:', error);
    return { error: 'Failed to reorder steps' };
  }
}

export async function reorderVisaStepQuestions(
  stepId: string,
  questionIds: string[]
) {
  await requireRole(['admin']);

  try {
    const step = await getVisaFormStepById(stepId);
    if (!step) return { error: 'Step not found' };

    await db.transaction(async (tx) => {
      for (let i = 0; i < questionIds.length; i++) {
        await tx
          .update(additionalQuestions)
          .set({ sortOrder: i })
          .where(
            and(
              eq(additionalQuestions.id, questionIds[i]),
              eq(additionalQuestions.stepId, stepId)
            )
          );
      }
    });

    revalidatePath(`/admin/config/visa-listings/${step.visaListingId}/forms`);
    await revalidateListingPublic(step.visaListingId);
    return { success: true };
  } catch (error) {
    console.error('Error reordering visa step questions:', error);
    return { error: 'Failed to reorder questions' };
  }
}

/**
 * Publish an immutable form version snapshot for a listing (Phase 3).
 * Freezes buildApplyFormConfig output so submitted apps keep historical labels.
 */
export async function publishFormVersion(listingId: string) {
  const session = await requireRole(['admin']);

  try {
    const process = await getProcessWithAllRelations(listingId);
    if (!process) {
      return { error: 'Visa listing not found' };
    }

    const { buildApplyFormConfig } = await import('@/lib/apply/applicationForm');
    const {
      getNextFormVersionNumber,
    } = await import('@/lib/db/queries/formVersions');
    const { formVersions } = await import('@/lib/db/schema');

    const documentTypeSamples = await getDocumentTypeSamplesByValues(
      process.componentsRequired.flatMap((item) =>
        [item.documentType, item.key].filter(Boolean) as string[]
      )
    );

    const config = buildApplyFormConfig({
      purpose: process.purpose,
      countryName: process.country.name,
      processName: process.processName,
      showGeneralInfo: process.showGeneralInfo,
      showTripDetails: process.showTripDetails,
      showInsuranceInterest:
        process.showInsuranceInterest && !process.withFreeInsurance,
      components: process.componentsRequired,
      questions: process.additionalQuestions,
      formSteps: process.formSteps,
      documentTypeSamples,
    });

    const version = await getNextFormVersionNumber(listingId);

    const [created] = await db
      .insert(formVersions)
      .values({
        listingId,
        version,
        config,
        publishedBy: session.user.id,
        publishedAt: new Date(),
      })
      .returning({
        id: formVersions.id,
        version: formVersions.version,
        publishedAt: formVersions.publishedAt,
      });

    revalidatePath(`/admin/config/visa-listings/${listingId}/forms`);
    revalidatePath(`/admin/config/visa-listings/${listingId}/docs`);
    revalidatePath(`/admin/config/visa-listings/${listingId}`);
    await revalidateListingPublic(listingId);

    return {
      success: true,
      message: `Form version ${created.version} published`,
      version: created.version,
      id: created.id,
      publishedAt: created.publishedAt?.toISOString?.() ?? null,
    };
  } catch (error) {
    console.error('Error publishing form version:', error);
    return { error: 'Failed to publish form version' };
  }
}

