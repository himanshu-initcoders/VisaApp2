import { asc, desc, eq, max } from 'drizzle-orm';
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

export async function getAllPassportListings() {
  return db.query.passportListings.findMany({
    with: {
      prices: {
        orderBy: [asc(passportListingPrices.sortOrder)],
      },
    },
    orderBy: [asc(passportListings.serviceType)],
  });
}

export async function getPassportListingById(id: string) {
  return db.query.passportListings.findFirst({
    where: eq(passportListings.id, id),
  });
}

export async function getPassportListingByServiceType(
  serviceType: 'fresh' | 'reissue'
) {
  return db.query.passportListings.findFirst({
    where: eq(passportListings.serviceType, serviceType),
  });
}

export async function getPassportListingWithAllRelations(id: string) {
  return db.query.passportListings.findFirst({
    where: eq(passportListings.id, id),
    with: {
      prices: {
        orderBy: [asc(passportListingPrices.sortOrder)],
      },
      formSteps: {
        orderBy: [asc(passportFormSteps.sortOrder)],
        with: {
          questions: {
            orderBy: [asc(passportAdditionalQuestions.sortOrder)],
          },
        },
      },
      additionalQuestions: {
        orderBy: [asc(passportAdditionalQuestions.sortOrder)],
      },
      componentsRequired: {
        orderBy: [asc(passportComponentsRequired.sortOrder)],
      },
      faqs: {
        orderBy: [asc(passportFaqs.sortOrder)],
      },
    },
  });
}

export async function getActivePassportListingsWithPublicData() {
  return db.query.passportListings.findMany({
    where: eq(passportListings.isActive, true),
    with: {
      prices: {
        orderBy: [asc(passportListingPrices.sortOrder)],
      },
      componentsRequired: {
        orderBy: [asc(passportComponentsRequired.sortOrder)],
      },
      faqs: {
        orderBy: [asc(passportFaqs.sortOrder)],
      },
    },
    orderBy: [asc(passportListings.serviceType)],
  });
}

export async function getPassportPrices(listingId: string) {
  return db.query.passportListingPrices.findMany({
    where: eq(passportListingPrices.passportListingId, listingId),
    orderBy: [asc(passportListingPrices.sortOrder)],
  });
}

export async function getPassportPriceById(priceId: string) {
  return db.query.passportListingPrices.findFirst({
    where: eq(passportListingPrices.id, priceId),
  });
}

export async function getPassportFormSteps(listingId: string) {
  return db.query.passportFormSteps.findMany({
    where: eq(passportFormSteps.passportListingId, listingId),
    orderBy: [asc(passportFormSteps.sortOrder)],
    with: {
      questions: {
        orderBy: [asc(passportAdditionalQuestions.sortOrder)],
      },
    },
  });
}

export async function getPassportFormStepById(stepId: string) {
  return db.query.passportFormSteps.findFirst({
    where: eq(passportFormSteps.id, stepId),
  });
}

export async function getPassportQuestionById(questionId: string) {
  return db.query.passportAdditionalQuestions.findFirst({
    where: eq(passportAdditionalQuestions.id, questionId),
  });
}

export async function getPassportComponentById(componentId: string) {
  return db.query.passportComponentsRequired.findFirst({
    where: eq(passportComponentsRequired.id, componentId),
  });
}

export async function getPassportFaqById(faqId: string) {
  return db.query.passportFaqs.findFirst({
    where: eq(passportFaqs.id, faqId),
  });
}

export async function getMaxPassportPriceSortOrder(listingId: string) {
  const [row] = await db
    .select({ value: max(passportListingPrices.sortOrder) })
    .from(passportListingPrices)
    .where(eq(passportListingPrices.passportListingId, listingId));
  return row?.value ?? -1;
}

export async function getMaxPassportStepSortOrder(listingId: string) {
  const [row] = await db
    .select({ value: max(passportFormSteps.sortOrder) })
    .from(passportFormSteps)
    .where(eq(passportFormSteps.passportListingId, listingId));
  return row?.value ?? -1;
}

export async function getMaxPassportQuestionSortOrder(stepId: string) {
  const [row] = await db
    .select({ value: max(passportAdditionalQuestions.sortOrder) })
    .from(passportAdditionalQuestions)
    .where(eq(passportAdditionalQuestions.stepId, stepId));
  return row?.value ?? -1;
}

export async function getMaxPassportComponentSortOrder(listingId: string) {
  const [row] = await db
    .select({ value: max(passportComponentsRequired.sortOrder) })
    .from(passportComponentsRequired)
    .where(eq(passportComponentsRequired.passportListingId, listingId));
  return row?.value ?? -1;
}

export async function getMaxPassportFaqSortOrder(listingId: string) {
  const [row] = await db
    .select({ value: max(passportFaqs.sortOrder) })
    .from(passportFaqs)
    .where(eq(passportFaqs.passportListingId, listingId));
  return row?.value ?? -1;
}

export async function getLatestPassportFormVersion(listingId: string) {
  return db.query.passportFormVersions.findFirst({
    where: eq(passportFormVersions.passportListingId, listingId),
    orderBy: [desc(passportFormVersions.version)],
  });
}

export async function getNextPassportFormVersionNumber(listingId: string) {
  const latest = await getLatestPassportFormVersion(listingId);
  return (latest?.version ?? 0) + 1;
}
