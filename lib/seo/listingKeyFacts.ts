/**
 * Derive plain key facts for visa listing pages (UI + Service JSON-LD).
 */

import { formatPrice } from '@/lib/public';

type PriceOption = {
  totalAmount: number;
  entryValidity?: string | null;
  stayDuration?: string | null;
  formattedTotal?: string;
};

export function buildListingKeyFacts(input: {
  startingPrice?: number | null;
  isFree?: boolean;
  formattedStartingPrice?: string | null;
  processingEta?: string | null;
  priceOption?: PriceOption | null;
  documentCount: number;
}): Array<{ label: string; value: string }> {
  const priceValue = input.isFree
    ? input.formattedStartingPrice?.trim() || 'FREE'
    : input.formattedStartingPrice?.trim() ||
      (typeof input.startingPrice === 'number'
        ? formatPrice(input.startingPrice, 'INR')
        : 'See listing');

  const validity =
    input.priceOption?.entryValidity?.trim() ||
    input.priceOption?.stayDuration?.trim() ||
    null;

  return [
    { label: 'Starting price', value: priceValue },
    {
      label: 'Processing time',
      value: input.processingEta?.trim() || 'Shown before you submit',
    },
    {
      label: 'Validity / stay',
      value: validity || 'Varies by package',
    },
    {
      label: 'Documents',
      value:
        input.documentCount > 0
          ? `${input.documentCount} required`
          : 'None required to continue',
    },
    { label: 'Audience', value: 'Indian citizens' },
  ];
}
