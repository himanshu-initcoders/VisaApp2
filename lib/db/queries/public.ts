import { db } from '@/lib/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import {
  countries,
  visaListings,
  visaListingPrices,
  componentsRequired,
  additionalQuestions,
  faqs,
  postCheckoutSteps,
} from '@/lib/db/schema-extended';
import { visaApplications } from '@/lib/db/schema';
import {
  buildProcessHref,
  formatDuration,
  formatPrice,
  formatProcessType,
  formatVisaKindLabel,
  getFlagEmoji,
  slugifyProcessName,
  stableDemoCount,
} from '@/lib/public';
import {
  getDemoFaqs,
  getDemoHighlights,
  getDemoPriceOptions,
  getDemoRequirements,
} from '@/lib/public-demo';
import { buildApplyFormConfig, formatDocumentTitle } from '@/lib/apply/applicationForm';

/**
 * Public-facing database queries for landing pages
 */

const INR = 'INR';

function getPriceAmount(amount: string | number | null | undefined) {
  return typeof amount === 'string' ? Number(amount) : (amount ?? 0);
}

function mapPriceOption(price: typeof visaListingPrices.$inferSelect) {
  const governmentFeeAmount = getPriceAmount(price.governmentFeeAmount);
  const serviceFeeAmount = getPriceAmount(price.serviceFeeAmount);
  const governmentGstFeeAmount = getPriceAmount(price.governmentGstFeeAmount);
  const totalAmount =
    governmentFeeAmount + serviceFeeAmount + governmentGstFeeAmount;

  const stayDuration = formatDuration(
    price.entryLengthStayAmount,
    price.entryLengthStayUnit
  );
  const entryValidity = formatDuration(
    price.entryValidityAmount,
    price.entryValidityUnit
  );
  const daysLabel = stayDuration || entryValidity;

  return {
    id: price.id,
    sortOrder: price.sortOrder,
    entryValidity,
    stayDuration,
    daysLabel,
    governmentFeeAmount,
    serviceFeeAmount,
    governmentGstFeeAmount,
    governmentFeeLabel: formatPrice(governmentFeeAmount, INR),
    serviceFeeLabel: formatPrice(serviceFeeAmount, INR),
    governmentGstFeeLabel: formatPrice(governmentGstFeeAmount, INR),
    totalAmount,
    formattedTotal: formatPrice(totalAmount, INR),
    formattedLabel: daysLabel
      ? `${formatPrice(totalAmount, INR)} · ${daysLabel}`
      : formatPrice(totalAmount, INR),
  };
}

function mapProcess(process: {
  id: string;
  processName: string;
  processType: string;
  purpose: string;
  destinationCountry: string;
  processTypeLabel: string | null;
  processPhysical: boolean;
  entryType: string | null;
  isMultipleEntry: boolean | null;
  familyEnabled: boolean;
  unsupported: boolean | null;
  visaOnArrival: boolean | null;
  visaFree: boolean | null;
  standardEtaDuration: number | null;
  standardEtaUnit: string | null;
  prices: Array<typeof visaListingPrices.$inferSelect>;
}) {
  const priceOptions = [...process.prices]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(mapPriceOption);

  const first = priceOptions[0];
  const startingPrice = first?.totalAmount ?? 0;
  const entryValidity = first?.entryValidity ?? null;
  const stayDuration = first?.stayDuration ?? null;

  return {
    ...process,
    slug: slugifyProcessName(process.processName),
    processTypeLabel:
      process.processTypeLabel || formatProcessType(process.processType),
    processTypeDisplay: formatProcessType(process.processType),
    standardEta: formatDuration(
      process.standardEtaDuration,
      process.standardEtaUnit
    ),
    entryValidity,
    stayDuration,
    governmentFeeAmount: first?.governmentFeeAmount ?? 0,
    serviceFeeAmount: first?.serviceFeeAmount ?? 0,
    governmentGstFeeAmount: first?.governmentGstFeeAmount ?? 0,
    priceOptions,
    startingPrice,
    formattedStartingPrice: first?.formattedLabel ?? 'FREE',
  };
}

/**
 * Get all enabled countries with their active visa listings
 * Used for the landing page visa grid
 */
export async function getEnabledCountriesWithProcesses() {
  const enabledCountries = await db.query.countries.findMany({
    where: and(eq(countries.enabled, true), eq(countries.supported, true)),
    with: {
      visaListings: {
        with: {
          prices: {
            orderBy: [visaListingPrices.sortOrder],
          },
        },
        orderBy: [visaListings.processName],
      },
    },
    orderBy: [countries.name],
  });

  return enabledCountries
    .map((country) => ({
      ...country,
      visaListings: country.visaListings
        .filter((process) => !process.unsupported)
        .map((process) => ({
          ...mapProcess(process),
          featured: false,
          href: buildProcessHref(country.iso2Code, process.id),
        })),
    }))
    .filter((country) => country.visaListings.length > 0);
}

/**
 * Get a single country with all its processes
 * Used for country detail pages
 */
export async function getCountryWithProcesses(iso2Code: string) {
  const country = await db.query.countries.findFirst({
    where: and(eq(countries.iso2Code, iso2Code), eq(countries.enabled, true)),
    with: {
      visaListings: {
        orderBy: [visaListings.processName],
        with: {
          prices: {
            orderBy: [visaListingPrices.sortOrder],
          },
        },
      },
    },
  });

  if (!country) return null;

  return {
    ...country,
    flag: getFlagEmoji(country.iso2Code),
    visaListings: country.visaListings
      .filter((process) => !process.unsupported)
      .map((process) => ({
        ...mapProcess(process),
        href: buildProcessHref(country.iso2Code, process.id),
      })),
  };
}

/**
 * Get a single visa listing with all details
 * Used for visa detail pages
 */
export async function getEntryProcessDetails(processId: string) {
  return await db.query.visaListings.findFirst({
    where: eq(visaListings.id, processId),
    with: {
      country: true,
      prices: {
        orderBy: [visaListingPrices.sortOrder],
      },
      componentsRequired: {
        orderBy: [componentsRequired.sortOrder],
      },
      additionalQuestions: {
        orderBy: [additionalQuestions.sortOrder],
      },
      multiTripCountries: true,
      faqs: {
        orderBy: [faqs.sortOrder],
      },
      postCheckoutSteps: {
        orderBy: [postCheckoutSteps.sortOrder],
      },
    },
  });
}

export async function getPublicProcessPageData(
  countryCode: string,
  processId: string
) {
  const process = await db.query.visaListings.findFirst({
    where: and(
      eq(visaListings.id, processId),
      eq(visaListings.destinationCountry, countryCode.toUpperCase())
    ),
    with: {
      country: true,
      prices: {
        orderBy: [visaListingPrices.sortOrder],
      },
      componentsRequired: {
        orderBy: [componentsRequired.sortOrder],
      },
      additionalQuestions: {
        orderBy: [additionalQuestions.sortOrder],
      },
      multiTripCountries: true,
      faqs: {
        orderBy: [faqs.sortOrder],
      },
      postCheckoutSteps: {
        orderBy: [postCheckoutSteps.sortOrder],
      },
    },
  });

  if (!process || process.unsupported || !process.country.enabled) {
    return null;
  }

  const mappedProcess = mapProcess(process);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [weeklyCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(visaApplications)
    .where(
      and(
        eq(visaApplications.visaListingId, process.id),
        gte(visaApplications.createdAt, weekAgo)
      )
    );

  const weeklyApplications =
    Number(weeklyCount?.count ?? 0) || stableDemoCount(process.id);

  const [relatedCountries, siblingListings] = await Promise.all([
    getEnabledCountriesWithProcesses(),
    db.query.visaListings.findMany({
      where: eq(
        visaListings.destinationCountry,
        process.destinationCountry
      ),
      orderBy: [visaListings.processName],
    }),
  ]);

  const exploreMore = relatedCountries
    .flatMap((country) =>
      country.visaListings.map((visaListing) => ({
        ...visaListing,
        country: {
          id: country.id,
          name: country.name,
          iso2Code: country.iso2Code,
          images: country.images,
        },
      }))
    )
    .filter((visaListing) => visaListing.id !== process.id)
    .slice(0, 8);

  const visaKindsRaw = siblingListings
    .filter((listing) => !listing.unsupported)
    .map((listing) => ({
      id: listing.id,
      purpose: listing.purpose,
      label: formatVisaKindLabel({
        purpose: listing.purpose,
      }),
      href: buildProcessHref(process.country.iso2Code, listing.id),
    }));

  // Prefer unique labels; fall back to process name when purpose clashes
  const labelCounts = visaKindsRaw.reduce<Record<string, number>>((acc, kind) => {
    acc[kind.label] = (acc[kind.label] ?? 0) + 1;
    return acc;
  }, {});

  const visaKinds = visaKindsRaw.map((kind) => {
    if ((labelCounts[kind.label] ?? 0) <= 1) return kind;
    const listing = siblingListings.find((item) => item.id === kind.id);
    return {
      ...kind,
      label: listing?.processName || kind.label,
    };
  });

  const dbRequirements = process.componentsRequired.map((item) => {
    return {
    id: item.id,
    key: item.key,
    title: formatDocumentTitle(item.key, {
      label: item.label,
      documentType: item.documentType,
    }),
    description: 'Needed before you can submit',
    helper: 'Standard requirement for this destination',
    chargeable: false,
  };
  });

  const questionRequirements = process.additionalQuestions.map((question) => ({
    id: question.id,
    key: question.key,
    title: question.label,
    description:
      question.description ||
      (question.required ? 'Required before you can submit' : 'Optional extra detail'),
    helper: question.extraInfo || 'Asked during the application form',
    chargeable: false,
  }));

  const priceOptions =
    mappedProcess.priceOptions.length > 0
      ? mappedProcess.priceOptions
      : getDemoPriceOptions(mappedProcess);

  const isFree = mappedProcess.startingPrice === 0 && priceOptions.every(
    (option) => option.totalAmount === 0
  );

  return {
    id: process.id,
    href: buildProcessHref(process.country.iso2Code, process.id),
    country: {
      ...process.country,
      flag: getFlagEmoji(process.country.iso2Code),
    },
    process: mappedProcess,
    page: {
      title: `${process.country.name} ${process.processName}`,
      eyebrow:
        process.processTypeLabel ||
        (process.processType === 'electronic_travel_authorisation'
          ? `Official ${process.country.name} digital arrival card`
          : `Official support for ${process.country.name} travellers`),
      accentLabel: isFree
        ? 'free and instant'
        : mappedProcess.standardEta || 'processed on time',
      isFree,
      weeklyApplications,
      highlights: getDemoHighlights(mappedProcess, process.country.name),
      stats: [
        {
          label: 'Entry validity',
          value: mappedProcess.entryValidity || 'Varies by traveler',
        },
        {
          label: 'Purpose',
          value: process.entryType || process.purpose.replace(/_/g, ' '),
        },
        {
          label: 'Max stay',
          value: mappedProcess.stayDuration || 'Check requirements',
        },
      ],
      overview:
        process.country.seo?.headline ||
        process.country.seo?.metaDescription ||
        (process.processType === 'electronic_travel_authorisation'
          ? `${process.processName} lets Indian travellers complete ${process.country.name}'s entry documentation online before departure. It is designed to be quick, low-friction, and easy to submit with the core travel documents you already have.`
          : `${process.processName} gives Indian travellers a guided application experience with document checks, timeline clarity, and transparent pricing before submission.`),
      requirements:
        dbRequirements.length > 0
          ? [...dbRequirements, ...questionRequirements]
          : [...getDemoRequirements(mappedProcess), ...questionRequirements],
      pricing: {
        priceOptions,
        usingDemoPrices: mappedProcess.priceOptions.length === 0,
        headline: priceOptions[0]?.formattedLabel ?? 'FREE',
        governmentFeeAmount: priceOptions[0]?.governmentFeeAmount ?? 0,
        serviceFeeAmount: priceOptions[0]?.serviceFeeAmount ?? 0,
        governmentGstFeeAmount: priceOptions[0]?.governmentGstFeeAmount ?? 0,
        governmentFeeLabel: priceOptions[0]?.governmentFeeLabel,
        serviceFeeLabel: priceOptions[0]?.serviceFeeLabel,
        governmentGstFeeLabel: priceOptions[0]?.governmentGstFeeLabel,
      },
      timeline:
        process.postCheckoutSteps.length > 0
          ? process.postCheckoutSteps.map((step, index) => ({
              id: step.id,
              title: step.heading,
              description:
                step.subheading || 'We guide you through this step end to end.',
              stepNumber: index + 1,
            }))
          : [
              {
                id: 'step-1',
                title: 'Share your details',
                description: `Add traveler information for ${process.processName} and confirm the trip purpose.`,
                stepNumber: 1,
              },
              {
                id: 'step-2',
                title: 'Upload documents',
                description:
                  'Passport, photo, and any extra questions configured for this destination.',
                stepNumber: 2,
              },
              {
                id: 'step-3',
                title: 'We review and file',
                description:
                  'Your application is checked against this process configuration, then submitted.',
                stepNumber: 3,
              },
              {
                id: 'step-4',
                title: 'Receive approval',
                description: mappedProcess.standardEta
                  ? `Typical turnaround is ${mappedProcess.standardEta}. You get status updates as it moves.`
                  : 'You receive approval details and the next steps before travel.',
                stepNumber: 4,
              },
            ],
      faqs:
        process.faqs.length > 0
          ? process.faqs
          : getDemoFaqs(process.country.name, mappedProcess),
      relatedQuestions: process.additionalQuestions.map((question) => ({
        id: question.id,
        label: question.label,
        required: question.required,
      })),
      exploreMore,
      visaKinds,
      applyForm: buildApplyFormConfig({
        purpose: process.purpose,
        countryName: process.country.name,
        processName: process.processName,
        showGeneralInfo: process.showGeneralInfo,
        showTripDetails: process.showTripDetails,
        components: process.componentsRequired,
        questions: process.additionalQuestions,
      }),
    },
  };
}

export type PublicProcessPageData = NonNullable<
  Awaited<ReturnType<typeof getPublicProcessPageData>>
>;
