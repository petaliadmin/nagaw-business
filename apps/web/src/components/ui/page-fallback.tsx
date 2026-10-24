export function PageFallback({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <div
        aria-hidden
        className="h-9 w-56 animate-pulse rounded-xl bg-surface-muted"
      />
      <div
        aria-hidden
        className="h-36 animate-pulse rounded-2xl bg-surface-muted"
      />
    </div>
  );
}
