export function formatDuration(
  duration: number | null | undefined,
  unit: string | null | undefined
) {
  if (!duration || !unit) return null;

  const label = duration === 1 ? unit.slice(0, -1) : unit;
  return `${duration} ${label}`;
}

export function formatPrice(
  amount: number | string | null | undefined,
  currency = 'INR'
) {
  const numericAmount =
    typeof amount === 'string' ? Number(amount) : (amount ?? 0);

  if (!numericAmount) return 'FREE';

  const symbol =
    currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;

  return `${symbol}${Math.round(numericAmount).toLocaleString('en-IN')}`;
}

export function stableDemoCount(seed: string, min = 420, max = 1840) {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return min + (hash % (max - min + 1));
}

export function formatProcessType(processType: string) {
  return processType.replace(/_/g, ' ');
}

export function formatGuaranteedOnDate(
  duration?: number | null,
  unit?: string | null,
  from = new Date()
) {
  if (!duration || !unit) return null;

  const date = new Date(from);

  switch (unit) {
    case 'minutes':
      date.setMinutes(date.getMinutes() + duration);
      break;
    case 'hours':
      date.setHours(date.getHours() + duration);
      break;
    case 'days':
      date.setDate(date.getDate() + duration);
      break;
    case 'months':
      date.setMonth(date.getMonth() + duration);
      break;
    case 'years':
      date.setFullYear(date.getFullYear() + duration);
      break;
    default:
      return null;
  }

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Display label for a visa listing purpose (e.g. tourism → Tourism). */
export function formatVisaKindLabel(input: {
  entryType?: string | null;
  purpose: string;
  processName?: string;
}) {
  const entryType = input.entryType?.trim();
  if (entryType) return entryType;

  return input.purpose
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getCountryCardImage(
  images?: {
    banner?: { url?: string; alt?: string };
    hero?: { url?: string; alt?: string };
  } | null
) {
  if (images?.banner?.url) {
    return {
      url: images.banner.url,
      alt: images.banner.alt,
    };
  }

  if (images?.hero?.url) {
    return {
      url: images.hero.url,
      alt: images.hero.alt,
    };
  }

  return null;
}

export function getFlagEmoji(iso2Code: string) {
  const codePoints = iso2Code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

export function slugifyProcessName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildProcessHref(countryCode: string, listingId: string) {
  return `/visa/${countryCode.toLowerCase()}/${listingId}`;
}
