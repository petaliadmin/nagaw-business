import { CONTACT_WHATSAPP_LINK } from '@/lib/legal';

/**
 * Floating WhatsApp button of the home page: the team answers there. The
 * word stays visible next to the logo, people recognise both. Green of the
 * sales module, as the other WhatsApp buttons (white on it is AA).
 */
export function WhatsAppButton() {
  return (
    <a
      href={CONTACT_WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Nous écrire sur WhatsApp (nouvelle fenêtre)"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 inline-flex min-h-14 items-center gap-2 rounded-full bg-sales-strong px-5 text-base font-bold text-white shadow-lg transition-shadow hover:shadow-xl print:hidden"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-7 shrink-0"
        fill="currentColor"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28Z" />
      </svg>
      WhatsApp
    </a>
  );
}
