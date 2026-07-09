// Loading-skeleton primitives. Server-safe (no client directive). Pulse is
// disabled under prefers-reduced-motion by the global rule in globals.css.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** A card containing N list rows — matches the app's `.card divide-y` lists. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Page heading placeholder. */
export function SkeletonHeading() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}
