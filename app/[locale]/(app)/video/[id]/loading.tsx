import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown by Next.js while the video page Server Component is loading.
 * Matches the StudyRoom layout: header + two-column grid.
 */
export default function VideoLoading() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 shrink-0">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-px" />
        <Skeleton className="h-4 w-48" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-52 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Main two-column grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">

        {/* Left — video area */}
        <div className="flex flex-col p-4 gap-3 border-r border-border/50">
          {/* Video info bar */}
          <div className="flex flex-col gap-1 px-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          {/* Player */}
          <Skeleton className="aspect-video w-full rounded-xl" />
          {/* Controls */}
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>

        {/* Right — editor/transcript area */}
        <div className="flex flex-col p-4 gap-2">
          <Skeleton className="h-8 w-full rounded-lg mb-1" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>

      </div>
    </div>
  );
}
