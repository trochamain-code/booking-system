import { Skeleton } from "@/app/skeletons";

export default function Loading() {
  return (
    <main className="mx-auto max-w-lg p-4 sm:p-6">
      <div className="card overflow-hidden">
        <div style={{ height: "4px", backgroundColor: "var(--color-border)" }} />
        <header className="flex items-center gap-4 p-5">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </header>
        <div className="p-5 pt-0">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Skeleton className="h-16 w-full sm:w-24" />
            <Skeleton className="h-16 w-full sm:w-44" />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
