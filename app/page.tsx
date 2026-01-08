import { Suspense } from "react"
import HomeUpdated from "./home-updated"

export default async function Home() {
  // Pass empty array to avoid server-side data fetching
  // Data will be loaded client-side in the HomeUpdated component
  return (
    <Suspense fallback={null}>
      <HomeUpdated initialRoleQuestions={[]} />
    </Suspense>
  )
}
