'use client';

import type { CustomerDto } from '@nagaw/shared';
import { EllipsisVertical } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useId, useState } from 'react';
import {
  ContactAvatar,
  SheetLoading,
} from '@/components/contacts/contact-actions';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';

// Loaded when « ⋮ » is touched: the list stays light (performance budget).
const CustomerActions = dynamic(
  () => import('./customer-actions').then((mod) => mod.CustomerActions),
  { ssr: false, loading: SheetLoading },
);

/**
 * One customer of the list: avatar, name and what they owe open the card;
 * « ⋮ » opens the actions on this customer in a sheet.
 */
export function CustomerRow({
  customer,
  organizationId,
  shopName,
  countryCode,
  owed,
  canManage,
  canDocument,
}: {
  customer: CustomerDto;
  organizationId: string;
  shopName: string;
  countryCode: string;
  /** What the customer owes, formatted; null when nothing. */
  owed: string | null;
  canManage: boolean;
  canDocument: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const href = `/espace/clients/${customer.id}`;

  return (
    // One card: the link fills it, « ⋮ » sits discreetly at its end.
    <li className="flex items-center rounded-2xl border border-line bg-surface pr-1">
      <Link
        href={href}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl py-3 pl-3 md:pl-4"
      >
        <ContactAvatar person={customer} />
        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="flex min-w-0 flex-col">
            <span className="font-bold break-words">{customer.name}</span>
            {customer.phone && (
              <span className="text-ink-muted">{customer.phone}</span>
            )}
          </span>
          {owed ? (
            <Badge tone="warning">Doit {owed}</Badge>
          ) : (
            <Badge tone="success">Ne doit rien</Badge>
          )}
        </span>
      </Link>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        aria-label={`Plus d’actions pour ${customer.name}`}
        onClick={() => setOpen(true)}
        // 48 px to touch (DESIGN.md), but no border: the card stays calm.
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <EllipsisVertical aria-hidden className="size-5" />
      </button>
      <BottomSheet
        id={sheetId}
        open={open}
        title={customer.name}
        onClose={() => setOpen(false)}
      >
        <CustomerActions
          customer={customer}
          organizationId={organizationId}
          shopName={shopName}
          countryCode={countryCode}
          owed={owed}
          canManage={canManage}
          canDocument={canDocument}
        />
      </BottomSheet>
    </li>
  );
}
