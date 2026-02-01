"use client"

import { Suspense } from "react"

import NewRoleQuestionsPageInner from "./page.client"

export default function NewRoleQuestionsPage() {
  return (
    <Suspense fallback={null}>
      <NewRoleQuestionsPageInner />
    </Suspense>
  )
}
