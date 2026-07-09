import { Skeleton, SkeletonList } from "@/app/skeletons";

export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <SkeletonList rows={4} />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}
