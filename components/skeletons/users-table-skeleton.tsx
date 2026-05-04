"use client"

import { Skeleton } from "@/components/ui/skeleton"

// Gray theme colors
const skeletonBg = "bg-gray-200 dark:bg-gray-800"
const skeletonBgLighter = "bg-gray-100 dark:bg-gray-700"

export function UsersTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search and filter bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-96">
          <Skeleton className={`h-10 w-full ${skeletonBg}`} />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Skeleton className={`h-10 w-24 ${skeletonBg}`} />
          <Skeleton className={`h-10 w-32 ${skeletonBg}`} />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <Skeleton className={`h-4 w-24 ${skeletonBg}`} />
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <Skeleton className={`h-4 w-24 ${skeletonBg}`} />
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <Skeleton className={`h-4 w-24 ${skeletonBg}`} />
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <Skeleton className={`h-4 w-24 ${skeletonBg}`} />
                </th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                  <Skeleton className={`h-4 w-24 ml-auto ${skeletonBg}`} />
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <td className="p-4 align-middle">
                    <div className="flex items-center gap-3">
                      <Skeleton className={`h-8 w-8 rounded-full ${skeletonBg}`} />
                      <div className="space-y-1">
                        <Skeleton className={`h-4 w-32 ${skeletonBg}`} />
                        <Skeleton className={`h-3 w-24 ${skeletonBgLighter}`} />
                      </div>
                    </div>
                  </td>
                  <td className="p-4 align-middle">
                    <Skeleton className={`h-4 w-24 ${skeletonBg}`} />
                  </td>
                  <td className="p-4 align-middle">
                    <Skeleton className={`h-4 w-20 ${skeletonBg}`} />
                  </td>
                  <td className="p-4 align-middle">
                    <Skeleton className={`h-4 w-32 ${skeletonBg}`} />
                  </td>
                  <td className="p-4 align-middle text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className={`h-8 w-9 ${skeletonBg}`} />
                      <Skeleton className={`h-8 w-9 ${skeletonBg}`} />
                      <Skeleton className={`h-8 w-9 ${skeletonBg}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-2 mt-4">
        <Skeleton className={`h-8 w-24 ${skeletonBg}`} />
        <div className="flex items-center space-x-2">
          <Skeleton className={`h-8 w-20 ${skeletonBg}`} />
          <Skeleton className={`h-8 w-9 ${skeletonBg}`} />
          <Skeleton className={`h-8 w-9 ${skeletonBg}`} />
          <Skeleton className={`h-8 w-20 ${skeletonBg}`} />
        </div>
      </div>
    </div>
  )
}
