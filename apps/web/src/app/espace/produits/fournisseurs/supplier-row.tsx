'use client';

import type { SupplierDto } from '@nagaw/shared';
import {
  EllipsisVertical,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useId, useState } from 'react';
import {
  ACTION_ROW,
  ActionIcon,
  ContactAvatar,
  SaveContactButton,
} from '@/components/contacts/contact-actions';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { whatsappLink } from '@/lib/sales/ticket';
import { SupplierForm, SupplierStatusForm } from './supplier-forms';

type Step = 'menu' | 'edit' | 'status';

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
  const [step, setStep] = useState<Step>('menu');
  const sheetId = useId();
  const close = () => {
    setOpen(false);
    setStep('menu');
  };
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
        {step === 'edit' ? (
          <SupplierForm
            organizationId={organizationId}
            supplier={supplier}
            onDone={close}
          />
        ) : step === 'status' ? (
          <SupplierStatusForm
            organizationId={organizationId}
            supplier={supplier}
            onCancel={() => setStep('menu')}
            onDone={close}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {supplier.phone && (
              <>
                <a
                  href={`tel:${supplier.phone.replace(/\s/g, '')}`}
                  className={ACTION_ROW}
                >
                  <ActionIcon icon={Phone} tone="brand" />
                  Appeler le {supplier.phone}
                </a>
                <a
                  href={whatsappLink('', supplier.phone, countryCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ACTION_ROW}
                >
                  <ActionIcon icon={MessageCircle} tone="sales" />
                  Écrire sur WhatsApp
                </a>
                <SaveContactButton
                  person={supplier}
                  countryCode={countryCode}
                  tone="stock"
                />
              </>
            )}
            {canManage && !archived && (
              <button
                type="button"
                onClick={() => setStep('edit')}
                className={ACTION_ROW}
              >
                <ActionIcon icon={Pencil} tone="invoices" />
                Modifier
              </button>
            )}
            {canManage &&
              (archived ? (
                <button
                  type="button"
                  onClick={() => setStep('status')}
                  className={ACTION_ROW}
                >
                  <ActionIcon icon={RotateCcw} tone="stats" />
                  Remettre dans la liste
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep('status')}
                  className={`${ACTION_ROW} text-danger-ink`}
                >
                  <ActionIcon icon={Trash2} tone="danger" />
                  Supprimer le fournisseur
                </button>
              ))}
          </div>
        )}
      </BottomSheet>
    </li>
  );
}
