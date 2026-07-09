import { Skeleton, SkeletonList } from "@/app/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-11 w-56" />
      </div>
      <SkeletonList rows={5} />
    </div>
  );
}
