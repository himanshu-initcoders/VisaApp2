import Link from 'next/link';
import Image from 'next/image';
import { Badge, Card, CardContent } from '@/components/ui';
import type { VisaListing } from '@/lib/db/schema';

/**
 * VisaCard Component
 *
 * Displays a visa listing card on the landing page
 * Following Portrait design system:
 * - 24px border radius
 * - Hover shadow-elevated
 * - Portrait Ink for headings, Graphite for body
 * - Image with country overlay
 */

interface VisaCardProps {
  listing: VisaListing;
}

export function VisaCard({ listing }: VisaCardProps) {
  // Parse JSON fields
  const images = listing.images as any;
  const pricing = listing.pricing as any;
  const pricingTiers = pricing?.tiers || [];

  // Get the lowest price tier
  const lowestTier = pricingTiers.reduce((min: any, tier: any) => {
    const total = (tier.serviceFee || 0) + (tier.governmentFee || 0);
    const minTotal = (min?.serviceFee || 0) + (min?.governmentFee || 0);
    return total < minTotal ? tier : min;
  }, pricingTiers[0]);

  const lowestPrice = lowestTier ? (lowestTier.serviceFee || 0) + (lowestTier.governmentFee || 0) : 0;
  const processingTime = pricingTiers[0]?.processingTime || '';

  return (
    <Link href={`/visa/${listing.slug}`}>
      <Card className="group hover:shadow-elevated transition-all duration-200 cursor-pointer overflow-hidden h-full">
        {/* Card Image */}
        <div className="relative w-full h-64 overflow-hidden">
          {images?.cardImage?.url ? (
            <Image
              src={images.cardImage.url}
              alt={images.cardImage.alt || listing.country}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-sky-wash flex items-center justify-center">
              <span className="text-slate-helper font-switzer text-sm">No image</span>
            </div>
          )}

          {/* Country overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-portrait-ink/70 backdrop-blur-sm p-4">
            <h3 className="font-switzer text-body-lg font-semibold text-white">
              {listing.country}
            </h3>
          </div>

          {/* Badges overlay */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {pricing?.isFree && (
              <Badge className="bg-mint-wash text-portrait-ink border-0">
                FREE
              </Badge>
            )}
            {listing.featured && (
              <Badge className="bg-sky-wash text-portrait-ink border-0">
                Featured
              </Badge>
            )}
          </div>
        </div>

        {/* Card Content */}
        <CardContent className="p-4 space-y-3">
          {/* Visa Type Badge */}
          <div>
            <Badge
              variant="default"
              className={`
                ${listing.visaType.toLowerCase().includes('tourist') ? 'bg-sky-wash' : ''}
                ${listing.visaType.toLowerCase().includes('business') ? 'bg-mint-wash' : ''}
                ${listing.visaType.toLowerCase().includes('student') ? 'bg-peach-wash' : ''}
                text-portrait-ink border-0
              `}
            >
              {listing.visaType}
            </Badge>
          </div>

          {/* Title */}
          <h4 className="font-switzer text-body font-medium text-portrait-ink line-clamp-2 min-h-[3rem] group-hover:text-nautical-teal transition-colors">
            {listing.title}
          </h4>

          {/* Short Description */}
          {listing.shortDescription && (
            <p className="font-switzer text-sm text-graphite line-clamp-2 min-h-[2.5rem]">
              {listing.shortDescription}
            </p>
          )}

          {/* Key Info Row */}
          <div className="flex items-center justify-between pt-2 border-t border-ash">
            {/* Processing Time */}
            {processingTime && (
              <div className="flex items-center gap-1.5 text-slate-helper">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-switzer text-xs">{processingTime}</span>
              </div>
            )}

            {/* Price */}
            <div className="text-right">
              {pricing?.isFree ? (
                <span className="font-switzer text-base font-semibold text-portrait-ink">
                  FREE
                </span>
              ) : lowestPrice > 0 ? (
                <div>
                  <span className="font-switzer text-xs text-slate-helper">From</span>
                  <span className="font-switzer text-base font-semibold text-portrait-ink ml-1">
                    ₹{(lowestPrice / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
