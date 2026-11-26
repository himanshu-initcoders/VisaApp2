/**
 * Generated Q&A for country visa hubs (AEO citability when admin FAQs are sparse).
 */

import { SITE_NAME } from '@/lib/seo/site';

type HubListing = {
  processName: string;
  purpose: string;
  formattedStartingPrice: string;
  startingPrice: number;
  standardEta: string | null;
  isFree: boolean;
};

export function buildCountryHubFaqs(input: {
  countryName: string;
  listings: HubListing[];
}): Array<{ id: string; question: string; answer: string }> {
  const { countryName, listings } = input;
  const names = listings.map((listing) => listing.processName);
  const cheapest =
    listings.length === 0
      ? null
      : [...listings].sort((a, b) => a.startingPrice - b.startingPrice)[0];
  const etaSample = listings.find((listing) => listing.standardEta)?.standardEta;

  return [
    {
      id: 'hub-types',
      question: `What ${countryName} visas can Indian citizens apply for on ${SITE_NAME}?`,
      answer:
        names.length > 0
          ? `Currently listed for ${countryName}: ${names.join(', ')}. Open a listing for documents, price packages, and processing time.`
          : `${SITE_NAME} lists ${countryName} visa options for Indian travellers when they are available. Check back or browse other destinations from the home page.`,
    },
    {
      id: 'hub-price',
      question: `How much does a ${countryName} visa cost for Indians?`,
      answer: cheapest
        ? cheapest.isFree
          ? `Some ${countryName} products start with no government fee (shown as FREE on the card). Open the listing to see any Viserv service charges and the full breakdown before you pay.`
          : `Prices start from ${cheapest.formattedStartingPrice} for ${cheapest.processName}. Each listing separates government fee, service fee, and GST where they apply.`
        : `Open a ${countryName} listing on ${SITE_NAME} to see live price packages before checkout.`,
    },
    {
      id: 'hub-time',
      question: `How long does a ${countryName} visa take?`,
      answer: etaSample
        ? `Typical processing shown on listings includes ${etaSample}. Exact ETA is confirmed on each visa product page before you apply.`
        : `Processing time is shown on each ${countryName} visa listing before you pay or submit.`,
    },
    {
      id: 'hub-docs',
      question: `What documents do I need for a ${countryName} visa?`,
      answer: `Document checklists are listing-specific. Open the ${countryName} visa you need to see required uploads (passport, photo, trip details, and any extras) before you start.`,
    },
  ];
}

export function buildCountryHubPath(iso2Code: string) {
  return `/visa/${iso2Code.toLowerCase()}`;
}
