'use client';

import type { OrganizationWithRoleDto } from '@nagaw/shared';
import { useId } from 'react';
import { selectOrganization } from '@/app/espace/actions';

/**
 * Switches the active shop (organization). Submits on change; the button
 * keeps it usable without JavaScript and for assistive technologies.
 */
export function OrganizationSwitcher({
  organizations,
  activeId,
  tone = 'sheet',
}: {
  organizations: OrganizationWithRoleDto[];
  activeId: string;
  tone?: 'sidebar' | 'sheet';
}) {
  const selectId = useId();
  return (
    <form action={selectOrganization} className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className={`text-base font-semibold ${tone === 'sidebar' ? 'text-white' : 'text-ink-muted'}`}
      >
        Boutique
      </label>
      <div className="flex gap-2">
        <select
          id={selectId}
          name="organizationId"
          defaultValue={activeId}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-line-strong bg-surface px-3 text-base font-bold text-ink"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <noscript>
          <button
            type="submit"
            className="min-h-12 rounded-xl border-2 border-line-strong bg-surface px-3 text-base font-bold text-ink"
          >
            Ouvrir
          </button>
        </noscript>
      </div>
    </form>
  );
}
