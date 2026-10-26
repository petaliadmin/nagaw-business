import { Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { ScrollRegion } from '@/components/ui/scroll-region';
import type { Block, Inline } from '@/lib/blog/markdown';

const LINK = 'font-semibold text-brand-ink underline underline-offset-4';

function InlineContent({ content }: { content: Inline[] }) {
  return content.map((part, index) => {
    if (part.type === 'strong') return <strong key={index}>{part.text}</strong>;
    if (part.type === 'link')
      return part.href.startsWith('/') ? (
        <Link key={index} href={part.href} className={LINK}>
          {part.text}
        </Link>
      ) : (
        <a key={index} href={part.href} className={LINK} rel="noopener">
          {part.text}
        </a>
      );
    return part.text;
  });
}

/** An article body: the blocks of `parseMarkdown`, as accessible HTML. */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-5 text-lg leading-relaxed">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return block.level === 2 ? (
              <h2
                key={index}
                id={block.id}
                className="mt-6 scroll-mt-20 text-2xl font-extrabold md:text-3xl"
              >
                {block.text}
              </h2>
            ) : (
              <h3
                key={index}
                id={block.id}
                className="mt-2 scroll-mt-20 text-xl font-extrabold"
              >
                {block.text}
              </h3>
            );
          case 'paragraph':
            return (
              <p key={index}>
                <InlineContent content={block.content} />
              </p>
            );
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List
                key={index}
                className={`flex flex-col gap-2 pl-6 ${
                  block.ordered ? 'list-decimal' : 'list-disc'
                } marker:font-bold marker:text-brand-ink`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="pl-1">
                    <InlineContent content={item} />
                  </li>
                ))}
              </List>
            );
          }
          case 'callout':
            return (
              <div
                key={index}
                className="flex items-start gap-3 rounded-2xl bg-brand-soft p-4 text-brand-ink"
              >
                <Lightbulb aria-hidden className="mt-1 size-6 shrink-0" />
                <p className="font-semibold">
                  <InlineContent content={block.content} />
                </p>
              </div>
            );
          case 'table':
            return (
              <ScrollRegion
                key={index}
                label="Tableau, défilable sur le côté"
                className="rounded-2xl border border-line"
              >
                <table
                  className={`w-full border-collapse text-left text-base ${
                    block.head.length > 3 ? 'min-w-xl' : ''
                  }`}
                >
                  <thead className="bg-surface-muted">
                    <tr>
                      {block.head.map((cell, cellIndex) => (
                        <th
                          key={cellIndex}
                          scope="col"
                          className="px-3 py-2 font-extrabold"
                        >
                          <InlineContent content={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-line">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 align-top">
                            <InlineContent content={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
            );
        }
      })}
    </div>
  );
}
