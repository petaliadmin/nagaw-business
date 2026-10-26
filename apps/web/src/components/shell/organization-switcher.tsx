'use client';

import type { OrganizationWithRoleDto } from '@nagaw/shared';
import { useId } from 'react';
import { selectOrganization } from '@/app/espace/actions';

/**
 * Switches the active shop (organization): choosing in the list opens the
 * shop at once. The change is announced under the label, so that it is
 * not a surprise (WCAG 3.2.2); without JavaScript, a button submits.
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
  const hintId = useId();
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
      <p
        id={hintId}
        className={`text-base ${tone === 'sidebar' ? 'text-white/90' : 'text-ink-muted'}`}
      >
        La boutique choisie s’ouvre aussitôt.
      </p>
      <div className="flex gap-2">
        <select
          id={selectId}
          name="organizationId"
          defaultValue={activeId}
          aria-describedby={hintId}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className={`min-h-12 min-w-0 flex-1 rounded-xl border-2 border-line-strong bg-surface px-3 text-base font-bold text-ink ${focus}`}
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
