'use client';

import type { SupplierDto } from '@nagaw/shared';
import { MessageCircle, Pencil, Phone, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  ACTION_ROW,
  ActionIcon,
  SaveContactButton,
} from '@/components/contacts/contact-actions';
import { whatsappLink } from '@/lib/sales/ticket';
import { SupplierForm, SupplierStatusForm } from './supplier-forms';

type Step = 'menu' | 'edit' | 'status';

/**
 * What « ⋮ » offers on a supplier, in colours, the same as for customers.
 * Loaded when the sheet opens, so that the list stays light (performance
 * budget).
 */
export function SupplierActions({
  supplier,
  organizationId,
  countryCode,
  canManage,
  close,
}: {
  supplier: SupplierDto;
  organizationId: string;
  countryCode: string;
  canManage: boolean;
  close: () => void;
}) {
  const [step, setStep] = useState<Step>('menu');
  const archived = supplier.status === 'archived';
  return step === 'edit' ? (
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
  );
}
