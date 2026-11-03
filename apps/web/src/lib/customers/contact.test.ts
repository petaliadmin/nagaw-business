import { describe, expect, it } from 'vitest';
import {
  contactToCustomer,
  customerVCard,
  parseVCard,
  vCardFileName,
} from './contact';

describe('customerVCard', () => {
  it('writes the name and the number with the country code', () => {
    expect(customerVCard({ name: 'Fatou Ndiaye', phone: '77 111 22 33' })).toBe(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Fatou Ndiaye\r\nN:;Fatou Ndiaye;;;\r\nTEL;TYPE=CELL:+221771112233\r\nEND:VCARD\r\n',
    );
  });

  it('uses the country code of the shop', () => {
    expect(
      customerVCard({ name: 'Awa', phone: '07 12 34 56' }, '225'),
    ).toContain('TEL;TYPE=CELL:+22507123456');
  });

  it('keeps a number too short to be completed as written', () => {
    expect(customerVCard({ name: 'Awa', phone: '1234' })).toContain(
      'TEL;TYPE=CELL:1234',
    );
  });

  it('adds the e-mail and the address, and escapes what vCard reserves', () => {
    const card = customerVCard({
      name: 'Diop; Fils',
      email: 'diop@exemple.sn',
      address: 'Rue 10, Médina\nDakar',
      phone: null,
    });
    expect(card).toContain('FN:Diop\\; Fils\r\n');
    expect(card).toContain('EMAIL:diop@exemple.sn\r\n');
    expect(card).toContain('ADR:;;Rue 10\\, Médina\\nDakar;;;;\r\n');
    expect(card).not.toContain('TEL');
  });
});

describe('vCardFileName', () => {
  it('names the file after the customer', () => {
    expect(vCardFileName('Fatou Ndiaye')).toBe('Fatou Ndiaye.vcf');
  });

  it('removes the characters files refuse', () => {
    expect(vCardFileName('A/B: "C"')).toBe('A B C.vcf');
    expect(vCardFileName(' / ')).toBe('Client.vcf');
  });
});

describe('contactToCustomer', () => {
  it('takes the first value of each list', () => {
    expect(
      contactToCustomer({
        name: [' Fatou Ndiaye '],
        tel: ['', '+221 77 111 22 33', '33 800 00 00'],
        email: [],
        address: [{ addressLine: ['Rue 10', 'Médina'], city: 'Dakar' }],
      }),
    ).toEqual({
      name: 'Fatou Ndiaye',
      phone: '+221 77 111 22 33',
      email: '',
      address: 'Rue 10, Médina, Dakar',
    });
  });

  it('leaves empty what the contact does not have', () => {
    expect(contactToCustomer({})).toEqual({
      name: '',
      phone: '',
      email: '',
      address: '',
    });
  });

  it('cuts values to the lengths of the form', () => {
    const picked = contactToCustomer({ name: ['x'.repeat(200)] });
    expect(picked.name).toHaveLength(120);
  });
});

describe('parseVCard', () => {
  it('reads a card exported by an iPhone', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Ndiaye;Fatou;;;',
      'FN:Fatou Ndiaye',
      'item1.TEL;type=CELL;type=pref:+221 77 111 22 33',
      'EMAIL;type=INTERNET:fatou@exemple.sn',
      'ADR;type=HOME:;;Rue 10\, Médina;Dakar;;;Sénégal',
      'END:VCARD',
    ].join('\r\n');
    expect(contactToCustomer(parseVCard(card)!)).toEqual({
      name: 'Fatou Ndiaye',
      phone: '+221 77 111 22 33',
      email: 'fatou@exemple.sn',
      address: 'Rue 10, Médina, Dakar',
    });
  });

  it('reads the accents of an Android card in quoted-printable', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Diop;Ch=C3=A9rif;;;',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Ch=C3=A9rif =',
      'Diop',
      'TEL;CELL:771234567',
      'END:VCARD',
    ].join('\n');
    expect(parseVCard(card)).toMatchObject({
      name: ['Chérif Diop'],
      tel: ['771234567'],
    });
  });

  it('builds the name from N when FN is missing, and unfolds lines', () => {
    const card =
      'BEGIN:VCARD\nVERSION:4.0\nN:Sow;Moustapha;;;\nTEL;VALUE=uri:tel:+22176\n 0001122\nEND:VCARD';
    expect(parseVCard(card)).toMatchObject({
      name: ['Moustapha Sow'],
      tel: ['+221760001122'],
    });
  });

  it('keeps only the first card of the file', () => {
    const card =
      'BEGIN:VCARD\nFN:Awa\nEND:VCARD\nBEGIN:VCARD\nFN:Binta\nEND:VCARD';
    expect(parseVCard(card)?.name).toEqual(['Awa']);
  });

  it('reads back the card it writes', () => {
    const written = customerVCard({
      name: 'Diop; Fils',
      phone: '77 111 22 33',
      email: 'diop@exemple.sn',
      address: 'Rue 10, Médina',
    });
    expect(contactToCustomer(parseVCard(written)!)).toEqual({
      name: 'Diop; Fils',
      phone: '+221771112233',
      email: 'diop@exemple.sn',
      address: 'Rue 10, Médina',
    });
  });

  it('refuses a file that is not a contact', () => {
    expect(parseVCard('Bonjour')).toBeNull();
  });
});
