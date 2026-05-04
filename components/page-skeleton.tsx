export function PageSkeleton() {
  return (
    <div
      className="bg-background min-h-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading your dashboard"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-40 animate-pulse rounded bg-gray-200/80 dark:bg-gray-800" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200/60 dark:bg-gray-800" />
            </div>
            <div className="h-9 w-36 animate-pulse rounded bg-gray-200/70 dark:bg-gray-800" />
          </div>

          {/* Loading Progress Indicator */}
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            <span>Authenticating and loading your data...</span>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left Column - Entry Form */}
            <div className="bg-card rounded-xl border p-6 shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200/70 dark:bg-gray-800" />
                <div className="h-4 w-28 animate-pulse rounded bg-gray-200/70 dark:bg-gray-800" />
                <div className="h-3 w-56 animate-pulse rounded bg-gray-200/60 dark:bg-gray-800" />
              </div>
            </div>

            {/* Right Column - Calendar */}
            <div className="bg-card rounded-xl border p-6 shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200/70 dark:bg-gray-800" />
                <div className="h-4 w-28 animate-pulse rounded bg-gray-200/70 dark:bg-gray-800" />
                <div className="h-3 w-56 animate-pulse rounded bg-gray-200/60 dark:bg-gray-800" />
              </div>
            </div>
          </div>

          {/* Recent Entries Section */}
          <div className="space-y-4">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200/70 dark:bg-gray-800" />
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-2">
                    <div className="h-4 w-56 animate-pulse rounded bg-gray-200/80 dark:bg-gray-800" />
                    <div className="h-3 w-80 animate-pulse rounded bg-gray-200/60 dark:bg-gray-800" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-20 animate-pulse rounded bg-gray-200/70 dark:bg-gray-800" />
                    <div className="h-6 w-16 animate-pulse rounded bg-gray-200/70 dark:bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
