"use client"

import { useRouter } from "next/navigation"
import { EntryFormMultistep } from "@/components/entry-form-multistep"

interface EntryFormMultistepClientProps {
  departmentId: string
  departmentName: string
  date: string
  allowedDates: string[]
  initialRoleQuestions: unknown[]
}

export function EntryFormMultistepClient({
  departmentId,
  departmentName,
  date,
  allowedDates,
  initialRoleQuestions,
}: EntryFormMultistepClientProps) {
  const router = useRouter()

  const handleSave = () => {
    // After save, redirect to home (dashboard)
    router.push("/")
  }

  const handleCancel = () => {
    // Deterministic: always go to dashboard
    router.push("/")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <EntryFormMultistep
        date={date}
        departmentId={departmentId}
        departmentName={departmentName}
        allowedDates={allowedDates}
        onSave={handleSave}
        onCancel={handleCancel}
        initialRoleQuestions={initialRoleQuestions}
      />
    </div>
  )
}
