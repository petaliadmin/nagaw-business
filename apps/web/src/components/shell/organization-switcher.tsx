'use client';

import type { OrganizationWithRoleDto } from '@nagaw/shared';
import { useId } from 'react';
import { selectOrganization } from '@/app/espace/actions';

/**
 * Switches the active shop (organization). Choosing in the list changes
 * nothing yet; the button opens the shop, so that moving through the list
 * with the arrow keys never reloads the page (WCAG 3.2.2).
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
  // On the dark sidebar the violet focus ring falls under 3:1.
  const focus = tone === 'sidebar' ? 'focus-visible:outline-white' : '';
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
          className={`min-h-12 min-w-0 flex-1 rounded-xl border-2 border-line-strong bg-surface px-3 text-base font-bold text-ink ${focus}`}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className={`min-h-12 rounded-xl border-2 border-line-strong bg-surface px-3 text-base font-bold text-ink hover:bg-surface-muted ${focus}`}
        >
          Ouvrir
        </button>
      </div>
    </form>
  );
}
