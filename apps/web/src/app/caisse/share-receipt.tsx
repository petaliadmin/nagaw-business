'use client';

import { FileText, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { TicketActionButton } from '@/components/ui/ticket-action';
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
  // Made as soon as the ticket shows: the touch then opens the share sheet
  // at once. Safari on iPhone refuses a share that comes too long after it.
  const [ready, setReady] = useState<Partial<Record<'png' | 'pdf', File>>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [png, pdf] = await Promise.all([
          receiptPng(text),
          receiptPdf(text),
        ]);
        if (cancelled) return;
        setReady({
          png: new File([png], `${fileName}.png`, { type: png.type }),
          pdf: new File([pdf], `${fileName}.pdf`, { type: pdf.type }),
        });
      } catch (error) {
        // Made again at the touch, which reports any failure.
        console.warn('Ticket non préparé à l’avance', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, fileName]);

  async function fileOf(kind: 'png' | 'pdf'): Promise<File> {
    const made = ready[kind];
    if (made) return made;
    const blob =
      kind === 'png' ? await receiptPng(text) : await receiptPdf(text);
    return new File([blob], `${fileName}.${kind}`, { type: blob.type });
  }

  async function send(kind: 'png' | 'pdf') {
    setMessage(null);
    setBusy(kind);
    try {
      const file = await fileOf(kind);
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
      <TicketActionButton
        icon={ImageIcon}
        verb="Envoyer"
        rest="en photo"
        busy={busy === 'png' ? 'Préparation…' : null}
        onClick={() => void send('png')}
        disabled={busy !== null}
      />
      <TicketActionButton
        icon={FileText}
        verb="Envoyer"
        rest="en PDF"
        busy={busy === 'pdf' ? 'Préparation…' : null}
        onClick={() => void send('pdf')}
        disabled={busy !== null}
      />
      <div role="status" className="col-span-full empty:hidden">
        {message && <Alert tone="info">{message}</Alert>}
      </div>
    </>
  );
}
