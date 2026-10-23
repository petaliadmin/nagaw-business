'use client';

import type { OrganizationWithRoleDto } from '@nagaw/shared';
import { useId } from 'react';
import { selectOrganization } from '@/app/espace/actions';

/**
 * Switches the active organization. Submits on change; the button keeps it
 * usable without JavaScript and for assistive technologies.
 */
export function OrganizationSwitcher({
  organizations,
  activeId,
}: {
  organizations: OrganizationWithRoleDto[];
  activeId: string;
}) {
  const selectId = useId();
  return (
    <form action={selectOrganization} className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className="text-xs font-medium uppercase tracking-wide text-zinc-500"
      >
        Organisation
      </label>
      <div className="flex gap-2">
        <select
          id={selectId}
          name="organizationId"
          defaultValue={activeId}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="rounded-md border px-2 text-sm">
            Ouvrir
          </button>
        </noscript>
      </div>
    </form>
  );
}
