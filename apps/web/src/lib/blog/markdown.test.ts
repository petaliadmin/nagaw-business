import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, slugify } from './markdown';

describe('slugify', () => {
  it('drops accents and punctuation', () => {
    expect(slugify('Qu’est-ce que la clôture de caisse ?')).toBe(
      'qu-est-ce-que-la-cloture-de-caisse',
    );
  });
});

describe('parseInline', () => {
  it('reads bold and links between plain text', () => {
    expect(
      parseInline('Un **stock** juste, voir [le guide](/blog/stock).'),
    ).toEqual([
      { type: 'text', text: 'Un ' },
      { type: 'strong', text: 'stock' },
      { type: 'text', text: ' juste, voir ' },
      { type: 'link', text: 'le guide', href: '/blog/stock' },
      { type: 'text', text: '.' },
    ]);
  });
});

describe('parseMarkdown', () => {
  it('parses every block type', () => {
    const blocks = parseMarkdown(`
## Un titre
Première ligne
suite du paragraphe.
### Sous-titre

- un
- deux

1. premier
2. second

> À retenir : **important**.

| Produit | Prix |
| --- | --- |
| Savon | 500 F |
`);
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'list',
      'list',
      'callout',
      'table',
    ]);
    expect(blocks[0]).toEqual({
      type: 'heading',
      level: 2,
      id: 'un-titre',
      text: 'Un titre',
    });
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Première ligne suite du paragraphe.' }],
    });
    expect(blocks[4]).toMatchObject({ ordered: true });
    expect(blocks[6]).toEqual({
      type: 'table',
      head: [
        [{ type: 'text', text: 'Produit' }],
        [{ type: 'text', text: 'Prix' }],
      ],
      rows: [
        [[{ type: 'text', text: 'Savon' }], [{ type: 'text', text: '500 F' }]],
      ],
    });
  });
});
