import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 rounded-xl border bg-background p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-80 bg-gray-200/70 dark:bg-gray-800" />
          <Skeleton className="h-9 w-64 bg-gray-200/80 dark:bg-gray-800" />
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
          <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
          <Skeleton className="h-9 w-24 bg-gray-200/70 dark:bg-gray-800" />
        </div>
      </div>

      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-gray-200/60 dark:bg-gray-800" />
        ))}
      </div>
    </div>
  )
}
