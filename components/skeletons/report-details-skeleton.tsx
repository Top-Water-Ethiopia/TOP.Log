import { Skeleton } from "@/components/ui/skeleton"

export function ReportDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />

        <div>
          <Skeleton className="h-9 w-64 mb-4" />
        </div>

        <div className="space-y-6">
          {/* User Info Card */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>

          {/* Report Details */}
          <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </div>

          {/* Custom Responses */}
          <div className="space-y-4">
            <Skeleton className="h-7 w-48" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
