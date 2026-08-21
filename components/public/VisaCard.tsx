import Link from 'next/link';
import Image from 'next/image';
import { Badge, Card, CardContent } from '@/components/ui';

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

export interface VisaCardListing {
  id: string;
  processName: string;
  destinationCountry: string;
  purpose: string;
  processType: string;
  processTypeLabel?: string | null;
  href: string;
  countryName?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  lowestPriceInr?: number | null;
  isFree?: boolean;
  featured?: boolean;
  processingTime?: string | null;
  shortDescription?: string | null;
}

interface VisaCardProps {
  listing: VisaCardListing;
}

export function VisaCard({ listing }: VisaCardProps) {
  const priceLabel =
    listing.isFree
      ? 'FREE'
      : listing.lowestPriceInr != null
        ? `₹${listing.lowestPriceInr.toLocaleString('en-IN')}`
        : null;

  return (
    <Link href={listing.href}>
      <Card className="group hover:shadow-elevated transition-all duration-200 cursor-pointer overflow-hidden h-full">
        <div className="relative w-full h-64 overflow-hidden">
          {listing.imageUrl ? (
            <Image
              src={listing.imageUrl}
              alt={listing.imageAlt || listing.countryName || listing.processName}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-sky-wash flex items-center justify-center">
              <span className="text-slate-helper font-switzer text-sm">No image</span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-portrait-ink/70 backdrop-blur-sm p-4">
            <h3 className="font-switzer text-body-lg font-semibold text-white">
              {listing.countryName || listing.destinationCountry}
            </h3>
          </div>

          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {listing.isFree && (
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

        <CardContent className="p-4 space-y-3">
          <div>
            <Badge
              variant="default"
              className={`
                ${listing.purpose.toLowerCase().includes('tourism') ? 'bg-sky-wash' : ''}
                ${listing.purpose.toLowerCase().includes('business') ? 'bg-mint-wash' : ''}
                ${listing.purpose.toLowerCase().includes('study') ? 'bg-peach-wash' : ''}
                text-portrait-ink border-0
              `}
            >
              {listing.processTypeLabel || listing.processType}
            </Badge>
          </div>

          <h4 className="font-switzer text-body font-medium text-portrait-ink line-clamp-2 min-h-[3rem] group-hover:text-nautical-teal transition-colors">
            {listing.processName}
          </h4>

          {listing.shortDescription && (
            <p className="font-switzer text-sm text-graphite line-clamp-2 min-h-[2.5rem]">
              {listing.shortDescription}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-ash">
            {listing.processingTime && (
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
                <span className="font-switzer text-xs">{listing.processingTime}</span>
              </div>
            )}

            <div className="text-right">
              {priceLabel && (
                <span className="font-switzer text-body font-semibold text-portrait-ink">
                  {priceLabel}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
