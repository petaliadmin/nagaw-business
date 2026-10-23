import type { OrganizationWithRoleDto } from '@nagaw/shared';

export const ACTIVE_ORGANIZATION_COOKIE = 'nagaw_org';

/**
 * Chooses the organization to display. The cookie is only a preference: it
 * is honored when it names one of the user's own organizations (as returned
 * by the API), otherwise the first organization is used. The API checks the
 * membership again on every tenant-scoped call.
 */
export function pickActiveOrganization(
  organizations: readonly OrganizationWithRoleDto[],
  preferredId: string | undefined,
): OrganizationWithRoleDto | undefined {
  return (
    organizations.find((org) => org.id === preferredId) ?? organizations[0]
  );
}
