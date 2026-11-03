'use client';

import type { SupplierDto } from '@nagaw/shared';
import { EllipsisVertical } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import {
  ContactAvatar,
  SheetLoading,
} from '@/components/contacts/contact-actions';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';

// Loaded when « ⋮ » is touched: the list stays light (performance budget).
const SupplierActions = dynamic(
  () => import('./supplier-actions').then((mod) => mod.SupplierActions),
  { ssr: false, loading: SheetLoading },
);

/**
 * One supplier of the list: avatar, name and number; « ⋮ » opens the
 * actions on this supplier in a sheet, the same as for customers.
 */
export function SupplierRow({
  supplier,
  organizationId,
  countryCode,
  canManage,
}: {
  supplier: SupplierDto;
  organizationId: string;
  countryCode: string;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const close = () => setOpen(false);
  const archived = supplier.status === 'archived';
  const hasActions = Boolean(supplier.phone) || canManage;

  return (
    // One card: « ⋮ » sits discreetly at its end.
    <li className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface py-3 pr-1 pl-3 md:pl-4">
      <ContactAvatar person={supplier} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold break-words">{supplier.name}</span>
          {archived && <Badge>Supprimé</Badge>}
        </span>
        <span className="text-ink-muted">
          {supplier.phone || 'Pas de téléphone'}
        </span>
      </span>
      {hasActions && (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? sheetId : undefined}
          aria-label={`Plus d’actions pour ${supplier.name}`}
          onClick={() => setOpen(true)}
          // 48 px to touch (DESIGN.md), but no border: the card stays calm.
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <EllipsisVertical aria-hidden className="size-5" />
        </button>
      )}
      <BottomSheet
        id={sheetId}
        open={open}
        title={supplier.name}
        onClose={close}
      >
        <SupplierActions
          supplier={supplier}
          organizationId={organizationId}
          countryCode={countryCode}
          canManage={canManage}
          close={close}
        />
      </BottomSheet>
    </li>
  );
}
