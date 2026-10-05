import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { visaListingPrices } from '@/lib/db/schema-extended';
import { rupeesDecimalToPaise } from '@/lib/payments/money';

export interface VisaFeeQuote {
  priceOptionId: string | null;
  governmentFeePaise: number;
  serviceFeePaise: number;
  gstFeePaise: number;
  travellerCount: number;
  amountPaise: number;
}

export type QuoteResult =
  | { ok: true; quote: VisaFeeQuote }
  | { ok: false; error: string };

/**
 * Recompute the checkout total from visa_listing_prices.
 * The browser never supplies an amount.
 */
export async function quoteVisaListing(input: {
  listingId: string;
  priceOptionId?: string | null;
  travellerCount: number;
}): Promise<QuoteResult> {
  if (
    !Number.isInteger(input.travellerCount) ||
    input.travellerCount < 1 ||
    input.travellerCount > 100
  ) {
    return { ok: false, error: 'Traveller count must be between 1 and 100.' };
  }

  const rows = await db
    .select({
      id: visaListingPrices.id,
      governmentFeeAmount: visaListingPrices.governmentFeeAmount,
      serviceFeeAmount: visaListingPrices.serviceFeeAmount,
      governmentGstFeeAmount: visaListingPrices.governmentGstFeeAmount,
    })
    .from(visaListingPrices)
    .where(eq(visaListingPrices.visaListingId, input.listingId));

  let selected = input.priceOptionId
    ? rows.find((row) => row.id === input.priceOptionId)
    : undefined;

  if (input.priceOptionId && !selected) {
    return {
      ok: false,
      error: 'That visa option does not belong to this listing.',
    };
  }

  if (!selected) {
    if (rows.length > 1) {
      return { ok: false, error: 'Choose a visa option before paying.' };
    }
    selected = rows[0];
  }

  if (!selected) {
    return {
      ok: true,
      quote: {
        priceOptionId: null,
        governmentFeePaise: 0,
        serviceFeePaise: 0,
        gstFeePaise: 0,
        travellerCount: input.travellerCount,
        amountPaise: 0,
      },
    };
  }

  const governmentFeePaise = rupeesDecimalToPaise(selected.governmentFeeAmount);
  const serviceFeePaise = rupeesDecimalToPaise(selected.serviceFeeAmount);
  const gstFeePaise = rupeesDecimalToPaise(selected.governmentGstFeeAmount);
  if (
    governmentFeePaise == null ||
    serviceFeePaise == null ||
    gstFeePaise == null
  ) {
    return {
      ok: false,
      error: 'This listing has an invalid fee. Ask an admin to fix the price.',
    };
  }

  const perTraveller = governmentFeePaise + serviceFeePaise + gstFeePaise;
  const amountPaise = perTraveller * input.travellerCount;
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 0) {
    return { ok: false, error: 'The fee total is invalid.' };
  }

  return {
    ok: true,
    quote: {
      priceOptionId: selected.id,
      governmentFeePaise,
      serviceFeePaise,
      gstFeePaise,
      travellerCount: input.travellerCount,
      amountPaise,
    },
  };
}
