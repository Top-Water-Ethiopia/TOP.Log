"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { EntryFormMultistep } from "@/components/entry-form-multistep"

interface EntryFormMultistepClientProps {
  departmentId: string
  departmentName: string
  date: string
  allowedDates: string[]
  initialExistingEntryId: string | null
  initialRoleQuestions: unknown[]
  initialQuestionsByKind?: Record<string, unknown[]>
  initialAvailableEntryKinds?: Array<{
    entry_kind: string
    label?: string
    is_default?: boolean
    allow_multiple_per_day?: boolean
  }>
  role?: string | null
}

export function EntryFormMultistepClient({
  departmentId,
  departmentName,
  date,
  allowedDates,
  initialExistingEntryId,
  initialRoleQuestions,
  initialQuestionsByKind,
  initialAvailableEntryKinds,
  role,
}: EntryFormMultistepClientProps) {
  const router = useRouter()

  const buildLogsHref = useCallback(
    (targetDate: string) => {
      const query = new URLSearchParams()
      query.set("departmentId", departmentId)
      query.set("date", targetDate)
      return `/logs?${query.toString()}`
    },
    [departmentId]
  )

  const buildNewLogHref = useCallback(
    (targetDate: string) => {
      const query = new URLSearchParams()
      query.set("departmentId", departmentId)
      query.set("date", targetDate)
      return `/logs/new?${query.toString()}`
    },
    [departmentId]
  )

  const handleSave = useCallback(
    (result?: { entryKind?: string; date?: string }) => {
      if (result?.entryKind === "agent_call") {
        return
      }

      router.push(buildLogsHref(result?.date || date))
    },
    [buildLogsHref, date, router]
  )

  const handleCancel = useCallback(
    (selectedDate?: string) => {
      router.push(buildLogsHref(selectedDate || date))
    },
    [buildLogsHref, date, router]
  )

  const handleDateChange = useCallback(
    (nextDate: string) => {
      if (nextDate === date) {
        return
      }

      router.replace(buildNewLogHref(nextDate), { scroll: false })
    },
    [buildNewLogHref, date, router]
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <EntryFormMultistep
        date={date}
        departmentId={departmentId}
        departmentName={departmentName}
        allowedDates={allowedDates}
        initialExistingEntryId={initialExistingEntryId}
        onDateChange={handleDateChange}
        onSave={handleSave}
        onCancel={handleCancel}
        stayOnAgentCallSave
        initialRoleQuestions={initialRoleQuestions}
        initialQuestionsByKind={initialQuestionsByKind}
        initialAvailableEntryKinds={initialAvailableEntryKinds}
        role={role}
      />
    </div>
  )
}
