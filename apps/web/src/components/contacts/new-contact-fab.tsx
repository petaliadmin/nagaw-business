'use client';

import { BookUser, Plus, UserPlus, X, type LucideIcon } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { Alert } from '@/components/ui/alert';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import {
  contactToCustomer,
  parseVCard,
  type CustomerContact,
  type PickedContact,
} from '@/lib/customers/contact';

/** Contact Picker API: Chrome on Android, not yet in the DOM types. */
interface ContactsManager {
  getProperties(): Promise<string[]>;
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<PickedContact[]>;
}

function contactsManager(): ContactsManager | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { contacts?: ContactsManager }).contacts;
}

const noSubscription = () => () => {};

/** A contact file is a few kilobytes; a photo inside can make it bigger. */
const MAX_CARD_BYTES = 1_000_000;

// Above the phone bottom bar, under the « Plus » sheet, as « Vendre »
// (SellFab).
const PLACE =
  'fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 md:right-8 md:bottom-8 print:hidden';
const PILL =
  'inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-brand-strong px-7 text-xl font-bold text-white shadow-lg transition-shadow hover:shadow-xl';

type Notice = { tone: 'info' | 'error'; text: string };

/** What the sheet opens with: an empty form, or one filled by a contact. */
interface Draft {
  key: string;
  initial?: CustomerContact;
  notice?: Notice;
}

/** A draft from a contact; without name nor number, a message instead. */
function draftOf(
  contact: PickedContact,
  empty: string,
  submitLabel: string,
): Draft {
  const initial = contactToCustomer(contact);
  const key = crypto.randomUUID();
  return initial.name || initial.phone
    ? {
        key,
        initial,
        notice: {
          tone: 'info',
          text: `Vérifiez les informations, puis appuyez sur « ${submitLabel} ».`,
        },
      }
    : { key, notice: { tone: 'error', text: empty } };
}

function failure(what: string, error: unknown): Draft {
  const detail =
    error instanceof Error && error.message ? ` (${error.message})` : '';
  return {
    key: crypto.randomUUID(),
    notice: {
      tone: 'error',
      text: `${what}${detail}. Remplissez le formulaire à la main.`,
    },
  };
}

function MenuButton({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={PILL}>
      <Icon aria-hidden className="size-6" />
      <span className="flex flex-col items-start leading-tight">
        {label}
        {hint && <span className="text-base font-semibold">{hint}</span>}
      </span>
    </button>
  );
}

/**
 * « + » floating on a list of people (customers, suppliers): it opens
 * « Créer » and « Importer » above it, then the new person's form in a
 * sheet. « Importer » takes a contact of the phone (Chrome on Android) or a
 * contact file (.vcf, shared from the Contacts app on iPhone or a computer)
 * and fills the form. Escape, a touch outside or the « + » again closes the
 * choices.
 */
export function NewContactFab({
  label,
  title,
  submitLabel,
  children,
}: {
  /** Name of the « + » button: « Ajouter un client ». */
  label: string;
  /** Title of the choices and of the sheet: « Nouveau client ». */
  title: string;
  /** Label of the form's button, quoted in the « check » message. */
  submitLabel: string;
  /**
   * The form, filled with what the contact gives when imported; `close`
   * closes the sheet, once saved.
   */
  children: (
    initial: CustomerContact | undefined,
    close: () => void,
  ) => ReactNode;
}) {
  const canOpenContacts = useSyncExternalStore(
    noSubscription,
    () => contactsManager() !== undefined,
    () => false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      toggle.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  function create() {
    setMenuOpen(false);
    setDraft({ key: crypto.randomUUID() });
  }

  async function openContacts(manager: ContactsManager) {
    try {
      const available = await manager.getProperties();
      const wanted = ['name', 'tel', 'email', 'address'].filter((p) =>
        available.includes(p),
      );
      const [contact] = await manager.select(wanted, { multiple: false });
      // Closing the list without choosing is not a failure.
      if (!contact) return;
      setDraft(
        draftOf(contact, 'Ce contact n’a ni nom ni numéro.', submitLabel),
      );
    } catch (error) {
      setDraft(failure('Vos contacts n’ont pas pu être ouverts', error));
    }
  }

  function importContact() {
    setMenuOpen(false);
    const manager = contactsManager();
    // Both need the touch itself: the browser refuses them later.
    if (manager) void openContacts(manager);
    else fileInput.current?.click();
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // The same file can be chosen again after a correction.
    input.value = '';
    if (!file) return;
    if (file.size > MAX_CARD_BYTES) {
      setDraft({
        key: crypto.randomUUID(),
        notice: {
          tone: 'error',
          text: 'Ce fichier est trop gros pour une fiche contact.',
        },
      });
      return;
    }
    try {
      const contact = parseVCard(await file.text());
      setDraft(
        contact
          ? draftOf(contact, 'Cette fiche n’a ni nom ni numéro.', submitLabel)
          : {
              key: crypto.randomUUID(),
              notice: {
                tone: 'error',
                text: 'Ce fichier n’est pas une fiche contact (.vcf).',
              },
            },
      );
    } catch (error) {
      setDraft(failure('La fiche n’a pas pu être lue', error));
    }
  }

  return (
    <>
      {/* The page keeps room under its last block: the button never hides it. */}
      <div aria-hidden className="h-20 shrink-0 md:h-12 print:hidden" />
      {menuOpen && (
        <div
          aria-hidden
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-20 bg-ink/20 print:hidden"
        />
      )}
      <div className={`${PLACE} flex flex-col items-end gap-3`}>
        {menuOpen && (
          <ul
            id={menuId}
            aria-label={title}
            className="flex flex-col items-end gap-3"
          >
            <li>
              <MenuButton icon={UserPlus} label="Créer" onClick={create} />
            </li>
            <li>
              <MenuButton
                icon={BookUser}
                label="Importer"
                hint={canOpenContacts ? 'de mes contacts' : 'une fiche .vcf'}
                onClick={importContact}
              />
            </li>
          </ul>
        )}
        <button
          ref={toggle}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          aria-label={menuOpen ? 'Fermer' : label}
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex size-16 items-center justify-center rounded-full bg-brand-strong text-white shadow-lg transition-shadow hover:shadow-xl"
        >
          {menuOpen ? (
            <X aria-hidden className="size-8" />
          ) : (
            <Plus aria-hidden className="size-8" />
          )}
        </button>
      </div>
      {/* No name: the file never goes to the server, only its fields. */}
      <input
        ref={fileInput}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        onChange={readFile}
        hidden
        aria-hidden
        tabIndex={-1}
      />
      <BottomSheet
        open={draft !== null}
        title={title}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <div key={draft.key} className="flex flex-col gap-4">
            {draft.notice && (
              <div role={draft.notice.tone === 'info' ? 'status' : undefined}>
                <Alert tone={draft.notice.tone}>{draft.notice.text}</Alert>
              </div>
            )}
            {children(draft.initial, () => setDraft(null))}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
