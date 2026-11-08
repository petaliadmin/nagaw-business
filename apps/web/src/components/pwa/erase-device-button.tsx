'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { eraseLocalData } from '@/lib/offline/db';
import { outboxStatus } from '@/lib/offline/store';

/**
 * The only way to empty a phone (ADR-053), when it changes hands. It is
 * refused while sales wait there: they exist nowhere else.
 */
export function EraseDeviceButton() {
  const [waiting, setWaiting] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    outboxStatus()
      .then((status) =>
        setWaiting(
          status.pendingSales +
            status.pendingOther +
            status.rejected.length +
            status.blocked.reduce((sum, b) => sum + b.sales, 0),
        ),
      )
      .catch((error: unknown) => {
        console.warn('État de ce téléphone illisible', error);
        setWaiting(0);
      });
  }, []);

  if (message) return <Alert tone="success">{message}</Alert>;
  if (waiting === null) return null;
  if (waiting > 0)
    return (
      <p className="text-ink-muted">
        {waiting > 1
          ? `${waiting} opérations attendent`
          : 'Une opération attend'}{' '}
        sur ce téléphone : il ne peut pas être vidé avant leur envoi.
      </p>
    );
  return (
    <>
      {confirmDialog}
      <button
        type="button"
        className={buttonClasses('secondary')}
        onClick={async () => {
          const ok = await confirm({
            title: 'Effacer ce téléphone ?',
            message:
              'Tout ce qu’il garde sera effacé : produits, clients et tickets. Ce qui a été envoyé reste sur le serveur.',
            confirmLabel: 'Effacer',
          });
          if (!ok) return;
          eraseLocalData()
            .then(() => {
              localStorage.clear();
              setMessage('Ce téléphone a été vidé.');
            })
            .catch((error: unknown) => {
              console.error('Effacement de ce téléphone', error);
              setMessage(
                'Ce téléphone n’a pas pu être vidé. Rechargez la page, puis réessayez.',
              );
            });
        }}
      >
        <Trash2 aria-hidden className="size-5" />
        Effacer ce téléphone
      </button>
    </>
  );
}
