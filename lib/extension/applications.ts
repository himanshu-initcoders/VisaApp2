import 'server-only';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  formVersions,
  visaApplicationTravellers,
  visaApplications,
} from '@/lib/db/schema';
import { reviewerOwnsVisa } from '@/lib/reviewer-access';
import type { ExtensionStaff } from '@/lib/extension/token';
import {
  asApplyFormConfig,
  buildVisaExtensionSchema,
  type ExtensionStoredTraveller,
} from '@/lib/extension/visaSchema';

const LIST_LIMIT = 200;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ExtensionApplicationCard = {
  id: string;
  reqType: 'visa';
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
  country: string | null;
  visaType: string;
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseExtensionApplicationId(
  raw: string
): { applicationId: string; passengerId: string } | null {
  const sep = raw.indexOf(':');
  if (sep <= 0) return null;
  const applicationId = raw.slice(0, sep);
  const passengerId = raw.slice(sep + 1);
  if (!UUID_RE.test(applicationId) || !passengerId) return null;
  return { applicationId, passengerId };
}

function splitName(traveller: ExtensionStoredTraveller): {
  firstName: string;
  lastName: string;
} {
  const passport = traveller.passportData ?? {};
  const given = str(passport.givenNames);
  const surname = str(passport.surname);
  if (given || surname) {
    return {
      firstName: given || str(traveller.name) || 'Traveller',
      lastName: surname,
    };
  }
  const parts = str(traveller.name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Traveller', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function asTravellers(raw: unknown): ExtensionStoredTraveller[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ExtensionStoredTraveller =>
      Boolean(item) && typeof item === 'object'
  );
}

export async function listExtensionApplications(
  staff: ExtensionStaff
): Promise<ExtensionApplicationCard[]> {
  const rows = await db
    .select({
      id: visaApplications.id,
      status: visaApplications.status,
      travellers: visaApplications.travellers,
      visaType: visaApplications.visaType,
      country: visaApplications.country,
      submittedAt: visaApplications.submittedAt,
      createdAt: visaApplications.createdAt,
    })
    .from(visaApplications)
    .where(
      staff.role === 'reviewer'
        ? and(
            ne(visaApplications.status, 'draft'),
            eq(visaApplications.assignedReviewerId, staff.id)
          )
        : ne(visaApplications.status, 'draft')
    )
    .orderBy(desc(visaApplications.submittedAt))
    .limit(LIST_LIMIT);

  if (rows.length === 0) return [];

  const statusRows = await db
    .select({
      applicationId: visaApplicationTravellers.applicationId,
      passengerId: visaApplicationTravellers.passengerId,
      status: visaApplicationTravellers.status,
    })
    .from(visaApplicationTravellers)
    .where(
      inArray(
        visaApplicationTravellers.applicationId,
        rows.map((row) => row.id)
      )
    );

  const statusByPassenger = new Map<string, string>();
  for (const row of statusRows) {
    statusByPassenger.set(`${row.applicationId}:${row.passengerId}`, row.status);
  }

  const cards: ExtensionApplicationCard[] = [];
  for (const row of rows) {
    const travellers = asTravellers(row.travellers);
    if (travellers.length === 0) continue;
    travellers.forEach((traveller, index) => {
      const passengerId = str(traveller.passengerId) || `traveller-${index}`;
      const names = splitName(traveller);
      const when = row.submittedAt ?? row.createdAt;
      cards.push({
        id: `${row.id}:${passengerId}`,
        reqType: 'visa',
        firstName: names.firstName,
        lastName: names.lastName,
        status:
          statusByPassenger.get(`${row.id}:${passengerId}`) || row.status,
        createdAt: when.toISOString(),
        country: row.country,
        visaType: row.visaType,
      });
    });
  }
  return cards;
}

export async function getExtensionApplication(
  staff: ExtensionStaff,
  rawId: string
) {
  const parsed = parseExtensionApplicationId(rawId);
  if (!parsed) return null;

  if (staff.role === 'reviewer') {
    const allowed = await reviewerOwnsVisa(staff.id, parsed.applicationId);
    if (!allowed) return null;
  }

  const [row] = await db
    .select({
      id: visaApplications.id,
      status: visaApplications.status,
      visaListingId: visaApplications.visaListingId,
      formSnapshot: visaApplications.formSnapshot,
      travellers: visaApplications.travellers,
    })
    .from(visaApplications)
    .where(eq(visaApplications.id, parsed.applicationId))
    .limit(1);

  if (!row || row.status === 'draft') return null;

  const travellers = asTravellers(row.travellers);
  const traveller =
    travellers.find((item) => str(item.passengerId) === parsed.passengerId) ??
    (parsed.passengerId.startsWith('traveller-')
      ? travellers[Number(parsed.passengerId.slice('traveller-'.length))]
      : undefined);

  if (!traveller) return null;

  const built = buildVisaExtensionSchema(
    asApplyFormConfig(row.formSnapshot),
    traveller
  );

  return {
    formId: row.visaListingId ?? row.id,
    schema: built.schema,
    data: built.data,
  };
}

export async function listPublishedExtensionForms() {
  const rows = await db
    .select({
      listingId: formVersions.listingId,
      version: formVersions.version,
      config: formVersions.config,
    })
    .from(formVersions)
    .orderBy(desc(formVersions.version));

  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.listingId)) latest.set(row.listingId, row);
  }

  const visa = [...latest.values()].map((row) => {
    const config = asApplyFormConfig(row.config);
    const built = buildVisaExtensionSchema(config, null);
    return {
      formId: row.listingId,
      type: 'visa' as const,
      typeName: config.processName || 'Visa form',
      countryName: config.countryName || '',
      schema: built.schema,
    };
  });

  return { visa, passport: [] as [] };
}
