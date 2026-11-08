import {
  CardSkeleton,
  FormSkeleton,
  HeaderSkeleton,
  KpiSkeleton,
  ListSkeleton,
} from './skeleton';

/** The shape of the page that is loading. */
export type PageFallbackVariant =
  'page' | 'dashboard' | 'list' | 'detail' | 'form';

/**
 * Shown while a page loads (Suspense fallback): a skeleton with the shape of
 * the page, so that nothing jumps when the content arrives. Screen readers
 * hear the label only.
 */
export function PageFallback({
  label = 'Chargement…',
  variant = 'page',
}: {
  label?: string;
  variant?: PageFallbackVariant;
}) {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">{label}</span>
      {variant === 'dashboard' && (
        <>
          <HeaderSkeleton />
          <KpiSkeleton />
          <CardSkeleton lines={4} />
        </>
      )}
      {variant === 'list' && (
        <>
          <HeaderSkeleton action />
          <ListSkeleton />
        </>
      )}
      {variant === 'detail' && (
        <>
          <HeaderSkeleton action />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={4} />
        </>
      )}
      {variant === 'form' && (
        <>
          <HeaderSkeleton />
          <FormSkeleton />
        </>
      )}
      {variant === 'page' && (
        <>
          <HeaderSkeleton />
          <CardSkeleton />
        </>
      )}
    </div>
  );
}
