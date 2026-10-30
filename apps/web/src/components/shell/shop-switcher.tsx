'use client';

import type { OrganizationWithRoleDto } from '@nagaw/shared';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { selectOrganization } from '@/app/espace/actions';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { buttonClasses } from '@/components/ui/button-styles';
import { ShopMark } from '@/components/ui/shop-mark';
import { ROLE_LABELS } from '@/lib/labels';

/**
 * The shop in front of the menu: its logo and name. With several shops, a
 * touch opens the list and another touch changes shop, which the server
 * checks against the shops of the account (\`selectOrganization\`).
 */
export function ShopSwitcher({
  organization,
  organizations,
  tone,
}: {
  organization: OrganizationWithRoleDto;
  organizations: OrganizationWithRoleDto[];
  tone: 'sidebar' | 'surface';
}) {
  const [open, setOpen] = useState(false);
  const sidebar = tone === 'sidebar';
  const content = (
    <>
      <ShopMark
        version={organization.logoVersion}
        size={sidebar ? 'sm' : 'md'}
      />
      <span className="min-w-0 flex-1 truncate text-left text-lg font-extrabold">
        {organization.name}
      </span>
    </>
  );
  const frame = `flex min-h-12 min-w-0 items-center gap-2 ${
    sidebar
      ? 'w-full rounded-xl border-2 border-white/40 px-3 py-2 text-white'
      : 'flex-1'
  }`;

  if (organizations.length < 2) return <div className={frame}>{content}</div>;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`${frame} rounded-xl ${sidebar ? 'focus-visible:outline-white' : ''}`}
      >
        {content}
        <span className="sr-only">, changer de boutique</span>
        <ChevronsUpDown aria-hidden className="size-5 shrink-0" />
      </button>
      <BottomSheet
        open={open}
        title="Changer de boutique"
        onClose={() => setOpen(false)}
      >
        <ul className="flex flex-col gap-2">
          {organizations.map((shop) => {
            const active = shop.id === organization.id;
            const row =
              'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left';
            const details = (
              <>
                <ShopMark version={active ? shop.logoVersion : null} />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="max-w-full font-bold">{shop.name}</span>
                  <Badge tone={active ? 'brand' : 'neutral'}>
                    {ROLE_LABELS[shop.role]}
                  </Badge>
                </span>
              </>
            );
            return (
              <li key={shop.id}>
                {active ? (
                  <div aria-current="true" className={`${row} border-ink`}>
                    {details}
                    <Check aria-hidden className="size-6 shrink-0" />
                    <span className="sr-only">Boutique ouverte</span>
                  </div>
                ) : (
                  <form
                    action={selectOrganization}
                    onSubmit={() => setOpen(false)}
                  >
                    <input
                      type="hidden"
                      name="organizationId"
                      value={shop.id}
                    />
                    <button
                      type="submit"
                      className={`${row} border-line-strong hover:bg-surface-muted`}
                    >
                      {details}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        <Link
          href="/espace/nouvelle-boutique"
          onClick={() => setOpen(false)}
          className={buttonClasses('secondary')}
        >
          <Plus aria-hidden className="size-5" />
          Créer une boutique
        </Link>
      </BottomSheet>
    </>
  );
}
