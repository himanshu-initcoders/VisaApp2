import { formatDuration, formatPrice } from '@/lib/public';

const INR = 'INR';

type ProcessLike = {
  id: string;
  processName: string;
  processType: string;
  purpose: string;
  familyEnabled: boolean;
  visaOnArrival: boolean | null;
  visaFree: boolean | null;
  governmentFeeAmount: number;
  serviceFeeAmount?: number;
  governmentGstFeeAmount?: number;
  startingPrice?: number;
  standardEta: string | null;
  stayDuration: string | null;
  entryValidity: string | null;
};

export function getDemoRequirements(process: ProcessLike) {
  const extras = process.familyEnabled
    ? [
        {
          id: 'demo-family',
          key: 'family_details',
          title: 'Family traveler details',
          description: 'Names and passport numbers for additional travelers',
          helper: 'This process supports family applications',
          chargeable: false,
        },
      ]
    : [];

  return [
    {
      id: 'demo-passport',
      key: 'passport',
      title: 'Passport',
      description: 'Valid for at least 6 months from travel date',
      helper: 'Clear photo of the bio page is enough to start',
      chargeable: false,
    },
    {
      id: 'demo-photo',
      key: 'photo',
      title: 'Recent photo',
      description: 'White background, face fully visible',
      helper: 'ICAO-style photo recommended',
      chargeable: false,
    },
    {
      id: 'demo-flight',
      key: 'flight_details',
      title: 'Flight details',
      description: 'Onward ticket or booked itinerary',
      helper: 'A hold booking is usually accepted',
      chargeable: false,
    },
    {
      id: 'demo-hotel',
      key: 'hotel_details',
      title: 'Stay details',
      description: 'Hotel booking or host address',
      helper: 'Needed before final submission',
      chargeable: false,
    },
    ...extras,
  ];
}

export function getDemoFaqs(countryName: string, process: ProcessLike) {
  const listedAmount = process.startingPrice ?? process.governmentFeeAmount;

  return [
    {
      id: 'demo-faq-1',
      question: `Who needs the ${process.processName}?`,
      answer: `Indian travelers heading to ${countryName} typically need this ${process.processType.replace(/_/g, ' ')} before travel. Check the requirements section for documents and eligibility.`,
    },
    {
      id: 'demo-faq-2',
      question: 'How long does processing take?',
      answer: process.standardEta
        ? `Current processing time is ${process.standardEta}. Validity and stay packages may offer different totals, but processing ETA is set at the listing level.`
        : 'Processing time is confirmed after document review. You will see the expected timeline before you pay or submit.',
    },
    {
      id: 'demo-faq-3',
      question: 'What documents do I need?',
      answer:
        'Most travelers start with a valid passport, a recent photo, and trip details such as flights or hotel. The requirements grid on this page lists the exact items for this destination.',
    },
    {
      id: 'demo-faq-4',
      question: 'Is the price shown the final amount?',
      answer:
        listedAmount > 0
          ? `The listed amount starts from ${formatPrice(listedAmount, INR)} for the first validity/stay package. Government fee, service fee, and GST stay separated so you can see what you are paying for.`
          : 'This product can start without a platform fee. Any official charges, if they apply later, are shown before you submit.',
    },
    {
      id: 'demo-faq-5',
      question: 'Can I apply for family members together?',
      answer: process.familyEnabled
        ? 'Yes. Family applications are enabled for this process, so additional travelers can be added in the same flow.'
        : 'This process is currently set up for individual travelers. Family support can be added from the admin configuration if needed.',
    },
  ];
}

export function getDemoPriceOptions(process: ProcessLike) {
  const governmentFeeAmount = process.governmentFeeAmount || 0;
  const serviceFeeAmount = process.serviceFeeAmount || 0;
  const governmentGstFeeAmount = process.governmentGstFeeAmount || 0;
  const totalAmount =
    governmentFeeAmount + serviceFeeAmount + governmentGstFeeAmount;
  const daysLabel = process.stayDuration || process.entryValidity || '30 days';

  return [
    {
      id: 'demo-price-standard',
      sortOrder: 0,
      entryValidity: process.entryValidity || formatDuration(90, 'days'),
      stayDuration: process.stayDuration || formatDuration(30, 'days'),
      daysLabel,
      governmentFeeAmount,
      serviceFeeAmount,
      governmentGstFeeAmount,
      governmentFeeLabel: formatPrice(governmentFeeAmount, INR),
      serviceFeeLabel: formatPrice(serviceFeeAmount, INR),
      governmentGstFeeLabel: formatPrice(governmentGstFeeAmount, INR),
      totalAmount,
      formattedTotal: formatPrice(totalAmount, INR),
      formattedLabel: `${formatPrice(totalAmount, INR)} · ${daysLabel}`,
    },
  ];
}

export function getDemoHighlights(process: ProcessLike, countryName: string) {
  return [
    process.standardEta
      ? `${process.standardEta} typical processing`
      : 'Timeline shown before you submit',
    process.stayDuration
      ? `Stay up to ${process.stayDuration}`
      : `Guidance tailored for ${countryName} travel`,
    process.familyEnabled
      ? 'Family applications supported'
      : process.visaOnArrival
        ? 'Visa on arrival option available'
        : 'Document checks before filing',
  ];
}
