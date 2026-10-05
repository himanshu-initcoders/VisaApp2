import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-utils';
import {
  EMPTY_TRIP_EXPORT,
  getApplicationsForCsvExport,
} from '@/lib/admin-queries';
import { travellerSummaryLabel } from '@/lib/visa/caseStatus';
import type { ApplicationFilters } from '@/types/admin';

export const dynamic = 'force-dynamic';

const CSV_CAP = 5000;

function csvEscape(value: string | null | undefined): string {
  const s = value ?? '';
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'reviewer']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const filters: ApplicationFilters = {
    search: sp.get('q') || sp.get('search') || undefined,
    phone: sp.get('phone') || undefined,
    country: sp.get('country') || undefined,
    countryCodes: (sp.get('countries') || '')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length === 2),
    visaListingIds: (sp.get('listings') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    passenger: sp.get('passenger') || undefined,
    dateFrom: sp.get('from') || undefined,
    dateTo: sp.get('to') || undefined,
    status: sp.get('status') || undefined,
    type: (sp.get('type') as ApplicationFilters['type']) || 'all',
    sortBy: 'submittedAt',
    sortOrder: 'desc',
  };

  const { rows, tripById, truncated, total } = await getApplicationsForCsvExport(
    filters,
    CSV_CAP
  );

  const header = [
    'id',
    'type',
    'applicant',
    'phone',
    'country',
    'countryCode',
    'status',
    'travellerStatus',
    'submittedAt',
    'passengerNames',
    'formVersion',
    'visaType',
    'arrivalDate',
    'returnDate',
    'arrivalFlights',
    'returnFlights',
    'arrivalCity',
    'hotel',
    'stayAddress',
  ];

  const lines = [
    header.join(','),
    ...rows.map((r) => {
      const trip =
        r.type === 'visa'
          ? tripById.get(r.id) || EMPTY_TRIP_EXPORT
          : EMPTY_TRIP_EXPORT;
      return [
        csvEscape(r.id),
        csvEscape(r.type),
        csvEscape(r.applicantName || r.userName),
        csvEscape(r.applicantPhone || r.userPhone || ''),
        csvEscape(r.country || ''),
        csvEscape(r.countryCode || ''),
        csvEscape(r.status),
        csvEscape(
          r.type === 'visa'
            ? travellerSummaryLabel(
                r.travellerCount ?? 0,
                r.approvedTravellerCount ?? 0
              )
            : ''
        ),
        csvEscape(
          r.submittedAt
            ? new Date(r.submittedAt).toISOString()
            : ''
        ),
        csvEscape(r.passengerNames || ''),
        csvEscape(
          r.formVersionNumber != null ? String(r.formVersionNumber) : ''
        ),
        csvEscape(r.visaType || r.serviceType || ''),
        csvEscape(trip.arrivalDate),
        csvEscape(trip.returnDate),
        csvEscape(trip.arrivalFlights),
        csvEscape(trip.returnFlights),
        csvEscape(trip.arrivalCity),
        csvEscape(trip.hotel),
        csvEscape(trip.stayAddress),
      ].join(',');
    }),
  ];

  if (truncated) {
    lines.push(
      csvEscape(
        `# Truncated at ${CSV_CAP} rows (matched ${total}). Narrow filters and export again.`
      )
    );
  }

  const body = lines.join('\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      'X-Export-Truncated': truncated ? '1' : '0',
      'X-Export-Total': String(total),
    },
  });
}
