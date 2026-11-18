/**
 * Canonical public contact details for UI chrome and transactional email.
 * Keep Footer / ContactBar / email templates aligned through this module.
 */

export const CONTACT_PHONE = '+917019902821';
export const CONTACT_EMAIL = 'hello@viserv.in';
export const CONTACT_ADDRESS =
  'Viserv, No 5/1, 1st Cross, RRMR Extn, KH Road, Bengaluru, Karnataka 560027';
export const CONTACT_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  CONTACT_ADDRESS
)}`;

/** Display form for email footers (spaces for readability). */
export const CONTACT_PHONE_DISPLAY = '+91 70199 02821';
