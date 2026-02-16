import { Suspense } from "react"
import { redirect } from "next/navigation"
import HomeUpdated from "./home-updated"
import { getUserRouteRedirect } from "@/lib/route-guards"
import { getInitialRoleQuestions } from "@/lib/initial-data"
import { PageSkeleton } from "@/components/page-skeleton"
import { ErrorBoundary } from "@/components/error-boundary"

/**
 * Home page with optimized authentication and routing logic
 * Features: Parallel queries, caching, enhanced UX, error boundaries
 */
export default async function Home() {
  // Check if user needs to be redirected based on role/permissions
  // This now uses parallel queries and caching for optimal performance
  const redirectPath = await getUserRouteRedirect()

  if (redirectPath) {
    redirect(redirectPath)
  }

  // Get initial role questions (currently empty, loaded dynamically)
  const initialRoleQuestions = await getInitialRoleQuestions()

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <HomeUpdated initialRoleQuestions={initialRoleQuestions} />
      </Suspense>
    </ErrorBoundary>
  )
}
