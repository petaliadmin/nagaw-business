'use client';

import { MessageCircle, Send } from 'lucide-react';
import { useId, useState } from 'react';
import { whatsappLink } from '@/lib/sales/ticket';

/**
 * The reminder, already written, at the bottom of the customer's thread
 * like a WhatsApp message (ADR-063): the shopkeeper may change a word, then
 * one touch opens WhatsApp with it. Nothing is sent from Nagaw itself.
 */
export function ReminderComposer({
  text,
  phone,
  countryCode,
  customerName,
}: {
  text: string;
  phone: string;
  countryCode: string;
  customerName: string;
}) {
  const [message, setMessage] = useState(text);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-center gap-2 font-bold">
        <MessageCircle aria-hidden className="size-5 text-sales-ink" />
        Relancer sur WhatsApp
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={id}
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-24 flex-1 resize-none rounded-3xl border-2 border-line-strong bg-canvas px-4 py-3 text-base text-ink focus:border-ink"
        />
        <a
          href={whatsappLink(message, phone, countryCode)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Envoyer le rappel à ${customerName} sur WhatsApp`}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-ink text-canvas"
        >
          <Send aria-hidden className="size-6" />
        </a>
      </div>
    </div>
  );
}
