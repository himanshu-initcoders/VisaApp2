/**
 * Resolve the form/client traveller slot id from JSON / upload payloads.
 * New writes prefer `travellerId`; older rows may still use `passengerId`.
 */
export function resolveFormTravellerId(source: {
  id?: unknown;
  travellerId?: unknown;
  formTravellerId?: unknown;
  passengerId?: unknown;
}): string {
  for (const value of [
    source.formTravellerId,
    source.travellerId,
    source.passengerId,
    source.id,
  ]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
