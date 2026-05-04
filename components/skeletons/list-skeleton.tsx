"use client"

import { Skeleton } from "@/components/ui/skeleton"

// Gray theme colors
const skeletonBg = "bg-gray-200 dark:bg-gray-800"
const skeletonBgLighter = "bg-gray-100 dark:bg-gray-700"

interface ListSkeletonProps {
  titleWidth?: string
  descriptionWidth?: string
  itemCount?: number
  hasDescription?: boolean
  hasActions?: boolean
}

export function ListSkeleton({
  titleWidth = "w-32",
  descriptionWidth = "w-24",
  itemCount = 5,
  hasDescription = true,
  hasActions = true,
}: ListSkeletonProps) {
  return (
    <div className="space-y-4">
      <Skeleton className={`h-10 w-40 ${skeletonBg}`} />
      <div className="border rounded-lg">
        <div className="p-4 space-y-3">
          {Array.from({ length: itemCount }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className={`h-4 ${titleWidth} ${skeletonBg}`} />
                {hasDescription && (
                  <Skeleton className={`h-3 ${descriptionWidth} ${skeletonBgLighter}`} />
                )}
              </div>
              {hasActions && (
                <div className="flex gap-2">
                  <Skeleton className={`h-8 w-8 rounded ${skeletonBg}`} />
                  <Skeleton className={`h-8 w-8 rounded ${skeletonBg}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
