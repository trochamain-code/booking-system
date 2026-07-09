import { Skeleton, SkeletonList } from "@/app/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-7 w-56" />
      <SkeletonList rows={4} />
    </div>
  );
}
