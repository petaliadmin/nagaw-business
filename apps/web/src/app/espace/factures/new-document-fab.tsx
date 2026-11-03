'use client';

import { FilePlus2, FileText, Plus, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

// Above the phone bottom bar, under the « Plus » sheet, as « Vendre »
// (SellFab).
const PLACE =
  'fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 md:right-8 md:bottom-8 print:hidden';
const PILL =
  'inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-invoices-strong px-7 text-xl font-bold text-white shadow-lg transition-shadow hover:shadow-xl';

const NEW_INVOICE = {
  href: '/espace/factures/nouvelle',
  icon: FilePlus2,
  label: 'Facture',
  long: 'Nouvelle facture',
} as const;
const NEW_QUOTE = {
  href: '/espace/factures/devis/nouveau',
  icon: FileText,
  label: 'Devis',
  long: 'Nouveau devis',
} as const;

/** The page keeps room under its last block: the button never hides it. */
function Room() {
  return <div aria-hidden className="h-20 shrink-0 md:h-12 print:hidden" />;
}

function FabLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  children: string;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className={PILL}>
      <Icon aria-hidden className="size-6" />
      {children}
    </Link>
  );
}

/** « Nouvelle facture » or « Nouveau devis », floating on its list. */
export function NewDocumentFab({ kind }: { kind: 'invoice' | 'quote' }) {
  const target = kind === 'invoice' ? NEW_INVOICE : NEW_QUOTE;
  return (
    <>
      <Room />
      <div className={PLACE}>
        <FabLink href={target.href} icon={target.icon}>
          {target.long}
        </FabLink>
      </div>
    </>
  );
}

/**
 * « + » floating on the summary: it opens « Facture » and « Devis » above
 * it. Escape, a touch outside or the « + » again closes them.
 */
export function NewDocumentMenuFab() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => setOpen(false);
  return (
    <>
      <Room />
      {open && (
        <div
          aria-hidden
          onClick={close}
          className="fixed inset-0 z-20 bg-ink/20 print:hidden"
        />
      )}
      <div className={`${PLACE} flex flex-col items-end gap-3`}>
        {open && (
          <ul
            id={menuId}
            aria-label="Créer"
            className="flex flex-col items-end gap-3"
          >
            {[NEW_INVOICE, NEW_QUOTE].map((item) => (
              <li key={item.href}>
                <FabLink href={item.href} icon={item.icon} onClick={close}>
                  {item.label}
                </FabLink>
              </li>
            ))}
          </ul>
        )}
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={open ? 'Fermer' : 'Créer une facture ou un devis'}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex size-16 items-center justify-center rounded-full bg-invoices-strong text-white shadow-lg transition-shadow hover:shadow-xl"
        >
          {open ? (
            <X aria-hidden className="size-8" />
          ) : (
            <Plus aria-hidden className="size-8" />
          )}
        </button>
      </div>
    </>
  );
}
