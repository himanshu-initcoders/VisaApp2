/**
 * Post-payment / free-submit navigation targets.
 * Staff land on admin application detail; applicants on their dashboard detail.
 */

export function isStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'reviewer';
}

export function submittedApplicationHref(input: {
  product: 'visa' | 'passport';
  referenceOrId: string;
  role?: string | null;
}): string {
  const { product, referenceOrId, role } = input;
  const staff = isStaffRole(role);

  if (product === 'visa') {
    return staff
      ? `/admin/applications/visa/${referenceOrId}`
      : `/applications/visa/${referenceOrId}`;
  }

  return staff
    ? `/admin/applications/passport/${referenceOrId}`
    : `/applications/passport/${referenceOrId}`;
}

export function postSubmitHomeHref(role?: string | null): string {
  return isStaffRole(role) ? '/admin' : '/';
}
