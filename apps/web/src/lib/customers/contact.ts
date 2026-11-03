import { internationalPhone } from '@nagaw/shared';

/** What a customer card holds that a phone contact can hold too. */
export interface CustomerContact {
  name: string;
  phone: string;
  email: string;
  address: string;
}

/** Text of a vCard value: `\`, `,`, `;` and line breaks are escaped. */
function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * The customer as a contact card (vCard 3.0, read by Android and iPhone).
 * The number goes out with the country code of the shop, so that it still
 * works when the phone travels or calls through WhatsApp.
 */
export function customerVCard(
  customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  },
  countryCode?: string,
): string {
  const name = escapeValue(customer.name.trim());
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`, `N:;${name};;;`];
  const phone = customer.phone?.trim();
  if (phone) {
    const international = internationalPhone(phone, countryCode);
    lines.push(
      `TEL;TYPE=CELL:${international ? `+${international}` : escapeValue(phone)}`,
    );
  }
  const email = customer.email?.trim();
  if (email) lines.push(`EMAIL:${escapeValue(email)}`);
  const address = customer.address?.trim();
  if (address) lines.push(`ADR:;;${escapeValue(address)};;;;`);
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}

/** File name of the card: the customer's name, without what files refuse. */
export function vCardFileName(name: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${safe || 'Client'}.vcf`;
}

/** Postal address as the Contact Picker API returns it. */
export interface PickedAddress {
  addressLine?: readonly string[];
  city?: string;
}

/** One contact as the Contact Picker API returns it: lists, maybe empty. */
export interface PickedContact {
  name?: readonly string[];
  tel?: readonly string[];
  email?: readonly string[];
  address?: readonly PickedAddress[];
}

/** `\n`, `\,`, `\;` and `\\` of a vCard value back to plain text. */
function unescapeValue(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) =>
    c === 'n' || c === 'N' ? '\n' : c,
  );
}

/** Components of a structured value (`N`, `ADR`), split on unescaped `;`. */
function components(value: string): string[] {
  return value.split(/(?<!\\);/).map((part) => unescapeValue(part).trim());
}

/** Quoted-printable text (`=C3=A9` → `é`), as Android exports accents. */
function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const hex = value.slice(i + 1, i + 3);
    if (value[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(value[i]));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * The first contact of a contact file (.vcf, vCard 2.1, 3.0 or 4.0), as the
 * Contact Picker API would give it. Null when the text is not a vCard.
 */
export function parseVCard(text: string): PickedContact | null {
  // Folded lines continue with a space or a tab (RFC 6350, 3.2).
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
  const contact = {
    name: [] as string[],
    tel: [] as string[],
    email: [] as string[],
    address: [] as PickedAddress[],
  };
  let structuredName = '';
  let inCard = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] ?? '';
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const [rawName = '', ...params] = line.slice(0, colon).split(';');
    // `item1.TEL` from iPhone: the group is not needed.
    const property = rawName.replace(/^.*\./, '').toUpperCase();
    const upperParams = params.map((p) => p.toUpperCase());
    const quotedPrintable = upperParams.some((p) =>
      p.endsWith('QUOTED-PRINTABLE'),
    );
    // A quoted-printable line ending with `=` goes on with the next one.
    while (quotedPrintable && line.endsWith('=') && i + 1 < lines.length) {
      line = line.slice(0, -1) + (lines[++i] ?? '');
    }
    let value = line.slice(colon + 1);
    if (quotedPrintable) value = decodeQuotedPrintable(value);
    if (property === 'BEGIN' && value.trim().toUpperCase() === 'VCARD') {
      inCard = true;
    } else if (!inCard) {
      continue;
    } else if (property === 'END') {
      break;
    } else if (property === 'FN') {
      contact.name.push(unescapeValue(value).trim());
    } else if (property === 'N') {
      const [family = '', given = ''] = components(value);
      structuredName = [given, family].filter(Boolean).join(' ');
    } else if (property === 'TEL') {
      contact.tel.push(unescapeValue(value).replace(/^tel:/i, '').trim());
    } else if (property === 'EMAIL') {
      contact.email.push(unescapeValue(value).trim());
    } else if (property === 'ADR') {
      const [, , street = '', city = ''] = components(value);
      contact.address.push({
        addressLine: street ? street.split('\n') : [],
        city,
      });
    }
  }
  if (!inCard) return null;
  if (!contact.name.some(Boolean) && structuredName)
    contact.name.push(structuredName);
  return contact;
}

const first = (values?: readonly string[]) =>
  values?.map((v) => v.trim()).find(Boolean) ?? '';

/**
 * A contact chosen in the phone, as the fields of the customer form. Values
 * are cut to the lengths the form accepts; a missing value is empty.
 */
export function contactToCustomer(contact: PickedContact): CustomerContact {
  const place = contact.address?.[0];
  const address = place
    ? [...(place.addressLine ?? []), place.city ?? '']
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', ')
    : '';
  return {
    name: first(contact.name).slice(0, 120),
    phone: first(contact.tel).slice(0, 30),
    email: first(contact.email).slice(0, 320),
    address: address.slice(0, 300),
  };
}

/** Up to two initials for the round avatar: `Fatou Ndiaye` → `FN`. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? [words[0], words[words.length - 1]].map((w) => [...w][0])
      : [...(words[0] ?? '')].slice(0, 2);
  return letters.join('').toLocaleUpperCase('fr') || '?';
}

const AVATAR_TONES = [
  'bg-brand-soft text-brand-ink',
  'bg-sales-soft text-sales-ink',
  'bg-stock-soft text-stock-ink',
  'bg-invoices-soft text-invoices-ink',
  'bg-stats-soft text-stats-ink',
  'bg-accounting-soft text-accounting-ink',
] as const;

/** Colour of an avatar: always the same one for the same customer. */
export function avatarTone(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}
