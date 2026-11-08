'use client';

import { FileText, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { receiptPdf, receiptPng } from '@/lib/sales/receipt-file';

/**
 * Sends the ticket as a photo or a PDF with the phone's share sheet
 * (WhatsApp, SMS, e-mail…), the file made on the phone, offline too. A
 * browser that cannot share files downloads it instead.
 */
export function ShareReceipt({
  text,
  fileName,
}: {
  /** `ticketText` of the sale. */
  text: string;
  /** Without extension: « Ticket A-000001 ». */
  fileName: string;
}) {
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function send(kind: 'png' | 'pdf') {
    setMessage(null);
    setBusy(kind);
    try {
      const blob =
        kind === 'png' ? await receiptPng(text) : await receiptPdf(text);
      const file = new File([blob], `${fileName}.${kind}`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return;
      }
      // No share sheet (computer): the file is saved, to attach it.
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage(
        `${kind === 'png' ? 'La photo' : 'Le PDF'} du ticket est enregistré sur l’appareil : joignez-le à votre message.`,
      );
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Ticket non envoyé', error);
      setMessage('Le ticket n’a pas pu être préparé. Réessayez.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void send('png')}
        disabled={busy !== null}
        className={buttonClasses('secondary')}
      >
        <ImageIcon aria-hidden className="size-5" />
        {busy === 'png' ? 'Préparation…' : 'Envoyer en photo'}
      </button>
      <button
        type="button"
        onClick={() => void send('pdf')}
        disabled={busy !== null}
        className={buttonClasses('secondary')}
      >
        <FileText aria-hidden className="size-5" />
        {busy === 'pdf' ? 'Préparation…' : 'Envoyer en PDF'}
      </button>
      <div role="status" className="w-full empty:hidden">
        {message && <Alert tone="info">{message}</Alert>}
      </div>
    </>
  );
}
