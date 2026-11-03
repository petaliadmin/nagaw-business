'use client';

import { Contact, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { MODULE_TONES, type ModuleTone } from '@/components/dashboard/tones';
import { buttonClasses } from '@/components/ui/button-styles';
import {
  avatarTone,
  customerVCard,
  initials,
  vCardFileName,
} from '@/lib/customers/contact';

/** A person of the shop's address book: a customer or a supplier. */
export interface ContactPerson {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

/** Full-width row of an actions sheet. */
export const ACTION_ROW = buttonClasses(
  'secondary',
  'w-full justify-start gap-3 px-3',
);

/** Round avatar with the initials; the name beside it says who it is. */
export function ContactAvatar({
  person,
  size = 'size-12 text-lg',
}: {
  person: Pick<ContactPerson, 'id' | 'name'>;
  size?: string;
}) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${size} ${avatarTone(person.id)}`}
    >
      {initials(person.name)}
    </span>
  );
}

/** Icon of an action, in the colour of its module: each one stands out. */
export function ActionIcon({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone: ModuleTone;
}) {
  return (
    <span
      aria-hidden
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${MODULE_TONES[tone].badge}`}
    >
      <Icon className="size-5" />
    </span>
  );
}

/**
 * Saves the person in the phone's contacts: a contact file (.vcf) that
 * Android and iPhone offer to add once opened. Made on the phone, so it
 * works without network. With a tone: a row of an actions sheet.
 */
export function SaveContactButton({
  person,
  countryCode,
  tone,
}: {
  person: Omit<ContactPerson, 'id'>;
  countryCode: string;
  tone?: ModuleTone;
}) {
  const [saved, setSaved] = useState(false);
  function save() {
    const file = new Blob([customerVCard(person, countryCode)], {
      type: 'text/vcard;charset=utf-8',
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = vCardFileName(person.name);
    document.body.append(link);
    link.click();
    link.remove();
    // The download has started; the address is no longer needed.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setSaved(true);
  }
  return (
    <>
      <button
        type="button"
        onClick={save}
        className={tone ? ACTION_ROW : buttonClasses('secondary')}
      >
        {tone ? (
          <ActionIcon icon={Contact} tone={tone} />
        ) : (
          <Contact aria-hidden className="size-5" />
        )}
        {tone ? 'Ajouter à mes contacts' : 'Enregistrer dans mon téléphone'}
      </button>
      {saved && (
        <p role="status" className="basis-full text-ink-muted">
          Ouvrez le fichier téléchargé pour ajouter {person.name} à vos
          contacts.
        </p>
      )}
    </>
  );
}
