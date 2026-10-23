export function PageFallback({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <div
        aria-hidden
        className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
      />
      <div
        aria-hidden
        className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
      />
    </div>
  );
}
