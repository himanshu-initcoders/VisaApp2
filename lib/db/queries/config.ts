import { db } from '@/lib/db';
import { eq, desc, and, or, like, ilike, ne, sql } from 'drizzle-orm';
import {
  countries,
  visaListings,
  visaListingPrices,
  additionalQuestions,
  componentsRequired,
  multiTripCountries,
  faqs,
  postCheckoutSteps,
  passportOcrSettings,
  photoValidationSettings,
  visaRisks
} from '@/lib/db/schema-extended';

/**
 * Database query helpers for admin configuration
 * Used by server actions and page components
 */

// ============================================================================
// COUNTRY QUERIES
// ============================================================================

/**
 * Get all countries with visa listing counts
 * Sorted by enabled status (enabled first), then alphabetically
 */
export async function getCountriesWithProcessCounts() {
  return await db.query.countries.findMany({
    with: {
      visaListings: {
        columns: { id: true }
      }
    },
    orderBy: [desc(countries.enabled), countries.name]
  });
}

/**
 * Get single country with all related data
 */
export async function getCountryDetails(iso2Code: string) {
  return await db.query.countries.findFirst({
    where: eq(countries.iso2Code, iso2Code),
    with: {
      visaListings: {
        with: {
          prices: {
            orderBy: [visaListingPrices.sortOrder]
          },
          additionalQuestions: {
            orderBy: [additionalQuestions.sortOrder]
          },
          componentsRequired: true
        }
      },
      visaRisks: true
    }
  });
}

/**
 * Get country by ID
 */
export async function getCountryById(id: string) {
  return await db.query.countries.findFirst({
    where: eq(countries.id, id)
  });
}

// ============================================================================
// VISA LISTING QUERIES
// ============================================================================

/**
 * Get all visa listings with country info and tier counts
 * Used for the processes list page
 */
export async function getAllProcessesWithCountries() {
  return await db.query.visaListings.findMany({
    with: {
      country: {
        columns: {
          name: true,
          iso2Code: true
        }
      },
      prices: {
        columns: {
          id: true,
          governmentFeeAmount: true,
          serviceFeeAmount: true,
          governmentGstFeeAmount: true,
          entryValidityAmount: true,
          entryValidityUnit: true,
          entryLengthStayAmount: true,
          entryLengthStayUnit: true,
          sortOrder: true,
        },
        orderBy: [visaListingPrices.sortOrder]
      }
    },
    orderBy: [visaListings.processName]
  });
}

/**
 * Get visa listing with ALL related data
 * Used for the process hub page
 */
export async function getProcessWithAllRelations(processId: string) {
  return await db.query.visaListings.findFirst({
    where: eq(visaListings.id, processId),
    with: {
      country: true,
      prices: {
        orderBy: [visaListingPrices.sortOrder]
      },
      multiTripCountries: true,
      additionalQuestions: {
        orderBy: [additionalQuestions.sortOrder]
      },
      componentsRequired: true,
      passportOcrSettings: true,
      photoValidationSettings: true,
      faqs: {
        orderBy: [faqs.sortOrder]
      },
      postCheckoutSteps: {
        orderBy: [postCheckoutSteps.sortOrder]
      }
    }
  });
}

/**
 * Get basic process info (for breadcrumbs, headers)
 */
export async function getProcessBasicInfo(processId: string) {
  return await db.query.visaListings.findFirst({
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
}

/**
 * Filter processes by various criteria
 */
export async function getFilteredProcesses(filters: {
  countryCode?: string;
  processType?: string;
  purpose?: string;
  search?: string;
}) {
  const conditions = [];

  if (filters.countryCode) {
    conditions.push(eq(visaListings.destinationCountry, filters.countryCode));
  }

  if (filters.processType) {
    conditions.push(eq(visaListings.processType, filters.processType as any));
  }

  if (filters.purpose) {
    conditions.push(eq(visaListings.purpose, filters.purpose as any));
  }

  if (filters.search) {
    conditions.push(like(visaListings.processName, `%${filters.search}%`));
  }

  return await db.query.visaListings.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      country: {
        columns: {
          name: true,
          iso2Code: true
        }
      },
      prices: {
        columns: {
          id: true,
          governmentFeeAmount: true,
          serviceFeeAmount: true,
          governmentGstFeeAmount: true,
          entryValidityAmount: true,
          entryValidityUnit: true,
          entryLengthStayAmount: true,
          entryLengthStayUnit: true,
          sortOrder: true,
        },
        orderBy: [visaListingPrices.sortOrder]
      }
    },
    orderBy: [visaListings.processName]
  });
}

// ============================================================================
// VISA LISTING PRICE QUERIES
// ============================================================================

/**
 * Get all price options for a listing
 */
export async function getListingPrices(processId: string) {
  return await db.query.visaListingPrices.findMany({
    where: eq(visaListingPrices.visaListingId, processId),
    orderBy: [visaListingPrices.sortOrder]
  });
}

/**
 * Get single price option by ID
 */
export async function getListingPriceById(priceId: string) {
  return await db.query.visaListingPrices.findFirst({
    where: eq(visaListingPrices.id, priceId)
  });
}

// ============================================================================
// DYNAMIC QUESTION QUERIES
// ============================================================================

/**
 * Get all questions for a process, ordered
 */
export async function getAdditionalQuestions(processId: string) {
  return await db.query.additionalQuestions.findMany({
    where: eq(additionalQuestions.visaListingId, processId),
    orderBy: [additionalQuestions.sortOrder]
  });
}

/**
 * Get single question by ID
 */
export async function getQuestionById(questionId: string) {
  return await db.query.additionalQuestions.findFirst({
    where: eq(additionalQuestions.id, questionId)
  });
}

/**
 * Get max sort order for questions (for appending new ones)
 */
export async function getMaxQuestionSortOrder(processId: string) {
  const result = await db
    .select({ maxSort: sql<number>`max(${additionalQuestions.sortOrder})` })
    .from(additionalQuestions)
    .where(eq(additionalQuestions.visaListingId, processId));

  return result[0]?.maxSort ?? -1;
}

export type QuestionLabelSuggestion = {
  id: string;
  label: string;
  description: string | null;
  questionType: 'text' | 'date' | 'select' | 'dropdown' | 'file' | 'flight' | 'boolean';
  category: string;
  required: boolean | null;
  options: Array<{ label: string; value: string }> | null;
  visibility: {
    enabled: true;
    sourceQuestionKey: string;
    operator: 'equals';
    value: string;
  } | null;
};

/**
 * Search additional questions by label across all visa listings.
 * Returns recent matches (deduped by lowercase label) for admin autocomplete.
 */
export async function searchAdditionalQuestionsByLabel(
  query: string,
  options?: { excludeId?: string; limit?: number }
): Promise<QuestionLabelSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const limit = options?.limit ?? 10;
  // Strip LIKE wildcards from user input so they match literally as text search
  const safeTerm = trimmed.replace(/[%_]/g, '');
  if (safeTerm.length < 2) {
    return [];
  }
  const conditions = [ilike(additionalQuestions.label, `%${safeTerm}%`)];

  if (options?.excludeId) {
    conditions.push(ne(additionalQuestions.id, options.excludeId));
  }

  const rows = await db.query.additionalQuestions.findMany({
    where: and(...conditions),
    orderBy: [desc(additionalQuestions.createdAt)],
    limit: limit * 4,
    columns: {
      id: true,
      label: true,
      description: true,
      questionType: true,
      category: true,
      required: true,
      options: true,
      visibility: true,
    },
  });

  const seen = new Set<string>();
  const suggestions: QuestionLabelSuggestion[] = [];

  for (const row of rows) {
    const dedupeKey = row.label.trim().toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    suggestions.push(row);
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

// ============================================================================
// DOCUMENT REQUIREMENT QUERIES
// ============================================================================

/**
 * Get all document requirements for a process (ordered by sortOrder)
 */
export async function getComponentsRequired(processId: string) {
  return await db.query.componentsRequired.findMany({
    where: eq(componentsRequired.visaListingId, processId),
    orderBy: [componentsRequired.sortOrder]
  });
}

/**
 * Get single document requirement by ID
 */
export async function getComponentById(componentId: string) {
  return await db.query.componentsRequired.findFirst({
    where: eq(componentsRequired.id, componentId)
  });
}

/**
 * Get maximum sortOrder for components in a process
 */
export async function getMaxComponentSortOrder(processId: string): Promise<number> {
  const components = await db.query.componentsRequired.findMany({
    where: eq(componentsRequired.visaListingId, processId),
    columns: { sortOrder: true }
  });

  if (components.length === 0) {
    return -1; // First component will be 0
  }

  return Math.max(...components.map(c => c.sortOrder));
}

// ============================================================================
// MULTI-COUNTRY QUERIES
// ============================================================================

/**
 * Get additional countries for a visa
 */
export async function getMultiTripCountries(processId: string) {
  return await db.query.multiTripCountries.findMany({
    where: eq(multiTripCountries.visaListingId, processId)
  });
}

// ============================================================================
// FAQ QUERIES
// ============================================================================

/**
 * Get all FAQs for a process, ordered
 */
export async function getFaqs(processId: string) {
  return await db.query.faqs.findMany({
    where: eq(faqs.visaListingId, processId),
    orderBy: [faqs.sortOrder]
  });
}

/**
 * Get single FAQ by ID
 */
export async function getFaqById(faqId: string) {
  return await db.query.faqs.findFirst({
    where: eq(faqs.id, faqId)
  });
}

/**
 * Get max sort order for FAQs
 */
export async function getMaxFaqSortOrder(processId: string) {
  const result = await db
    .select({ maxSort: sql<number>`max(${faqs.sortOrder})` })
    .from(faqs)
    .where(eq(faqs.visaListingId, processId));

  return result[0]?.maxSort ?? -1;
}

// ============================================================================
// POST-CHECKOUT STEP QUERIES
// ============================================================================

/**
 * Get all post-checkout steps for a process, ordered
 */
export async function getPostCheckoutSteps(processId: string) {
  return await db.query.postCheckoutSteps.findMany({
    where: eq(postCheckoutSteps.visaListingId, processId),
    orderBy: [postCheckoutSteps.sortOrder]
  });
}

/**
 * Get single post-checkout step by ID
 */
export async function getPostCheckoutStepById(stepId: string) {
  return await db.query.postCheckoutSteps.findFirst({
    where: eq(postCheckoutSteps.id, stepId)
  });
}

/**
 * Get max sort order for steps
 */
export async function getMaxStepSortOrder(processId: string) {
  const result = await db
    .select({ maxSort: sql<number>`max(${postCheckoutSteps.sortOrder})` })
    .from(postCheckoutSteps)
    .where(eq(postCheckoutSteps.visaListingId, processId));

  return result[0]?.maxSort ?? -1;
}

// ============================================================================
// VALIDATION SETTINGS QUERIES
// ============================================================================

/**
 * Get passport OCR settings for a process
 */
export async function getPassportOcrSettings(processId: string) {
  return await db.query.passportOcrSettings.findFirst({
    where: eq(passportOcrSettings.visaListingId, processId)
  });
}

/**
 * Get photo validation settings for a process
 */
export async function getPhotoValidationSettings(processId: string) {
  return await db.query.photoValidationSettings.findMany({
    where: eq(photoValidationSettings.visaListingId, processId)
  });
}

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Get dashboard statistics
 */
export async function getConfigStats() {
  const [totalCountries, enabledCountries, totalProcesses, totalPrices] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(countries),
    db.select({ count: sql<number>`count(*)` }).from(countries).where(eq(countries.enabled, true)),
    db.select({ count: sql<number>`count(*)` }).from(visaListings),
    db.select({ count: sql<number>`count(*)` }).from(visaListingPrices)
  ]);

  return {
    totalCountries: totalCountries[0]?.count ?? 0,
    enabledCountries: enabledCountries[0]?.count ?? 0,
    totalProcesses: totalProcesses[0]?.count ?? 0,
    totalTiers: totalPrices[0]?.count ?? 0
  };
}
