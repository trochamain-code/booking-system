import { Skeleton, SkeletonList } from "@/app/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <SkeletonList rows={3} />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}
