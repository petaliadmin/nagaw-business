/**
 * The small Markdown subset the blog articles are written in, parsed into
 * plain data and rendered by React (no HTML string, so nothing to sanitize):
 * `##` and `###` headings, paragraphs, `-` and `1.` lists, `>` callouts,
 * tables, `**bold**` and `[links](/path)`.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string };

export type Block =
  | { type: 'heading'; level: 2 | 3; id: string; text: string }
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'callout'; content: Inline[] }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] };

/** URL fragment of a heading: lowercase, no accent, words joined by `-`. */
export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last)
      out.push({ type: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) out.push({ type: 'strong', text: match[1] });
    else out.push({ type: 'link', text: match[2], href: match[3] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => parseInline(cell.trim()));

function parseChunk(lines: string[]): Block {
  const first = lines[0];
  const heading = /^(#{2,3}) (.+)$/.exec(first);
  if (heading && lines.length === 1) {
    const text = heading[2].trim();
    return {
      type: 'heading',
      level: heading[1].length as 2 | 3,
      id: slugify(text),
      text,
    };
  }
  if (lines.every((line) => line.startsWith('- ')))
    return {
      type: 'list',
      ordered: false,
      items: lines.map((line) => parseInline(line.slice(2).trim())),
    };
  if (lines.every((line) => /^\d+\. /.test(line)))
    return {
      type: 'list',
      ordered: true,
      items: lines.map((line) => parseInline(line.replace(/^\d+\. /, ''))),
    };
  if (lines.every((line) => line.startsWith('>')))
    return {
      type: 'callout',
      content: parseInline(
        lines.map((line) => line.replace(/^>\s?/, '')).join(' '),
      ),
    };
  if (
    lines.length >= 2 &&
    lines.every((line) => line.startsWith('|')) &&
    /^\|[\s|:-]+\|$/.test(lines[1])
  )
    return {
      type: 'table',
      head: cells(first),
      rows: lines.slice(2).map(cells),
    };
  return { type: 'paragraph', content: parseInline(lines.join(' ')) };
}

/** Blocks are separated by a blank line; a heading may also stand alone. */
export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let chunk: string[] = [];
  const flush = () => {
    if (chunk.length > 0) blocks.push(parseChunk(chunk));
    chunk = [];
  };
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line === '') flush();
    else if (/^#{2,3} /.test(line)) {
      flush();
      chunk.push(line);
      flush();
    } else chunk.push(line);
  }
  flush();
  return blocks;
}

/** Plain text of some inline content, for word counts and search. */
export function inlineText(content: Inline[]) {
  return content.map((part) => part.text).join('');
}
