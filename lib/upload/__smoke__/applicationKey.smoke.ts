import assert from 'node:assert/strict';
import {
  applicationPublicId,
  buildApplicationObjectKey,
  sanitizeSlotKey,
} from '@/lib/upload/applicationKey';

/**
 * Smoke: key builder stays isomorphic for S3/local (with ext) and Cloudinary (public_id).
 * Run: npx tsx lib/upload/__smoke__/applicationKey.smoke.ts
 */
const key = buildApplicationObjectKey({
  countryCode: 'ae',
  listingId: 'listing-uuid',
  userId: 'user-uuid',
  applicationId: 'app-uuid',
  passengerId: 'pax-1',
  slotKey: 'Passport Front!',
  ext: 'JPG',
});

assert.equal(
  key,
  'applications/AE/listing-uuid/user-uuid/app-uuid/passengers/pax-1/passport_front.jpg'
);
assert.equal(
  applicationPublicId(key),
  'applications/AE/listing-uuid/user-uuid/app-uuid/passengers/pax-1/passport_front'
);
assert.equal(sanitizeSlotKey('bank_statement'), 'bank_statement');
assert.equal(sanitizeSlotKey('Bank Statement'), 'bank_statement');

console.log('applicationKey.smoke: ok');
