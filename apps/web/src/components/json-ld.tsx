import { serializeJsonLd } from '@/lib/seo';

/** Structured data for search engines and AI assistants (schema.org). */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
