"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { EntryFormMultistep } from "@/components/entry-form-multistep"

interface EntryFormMultistepClientProps {
  departmentId: string
  departmentName: string
  date: string
  allowedDates: string[]
  initialExistingStandardEntryId: string | null
  initialRoleQuestions: unknown[]
}

export function EntryFormMultistepClient({
  departmentId,
  departmentName,
  date,
  allowedDates,
  initialExistingStandardEntryId,
  initialRoleQuestions,
}: EntryFormMultistepClientProps) {
  const router = useRouter()

  const buildLogsHref = useCallback((targetDate: string) => {
    const query = new URLSearchParams()
    query.set("departmentId", departmentId)
    query.set("date", targetDate)
    return `/logs?${query.toString()}`
  }, [departmentId])

  const buildNewLogHref = useCallback((targetDate: string) => {
    const query = new URLSearchParams()
    query.set("departmentId", departmentId)
    query.set("date", targetDate)
    return `/logs/new?${query.toString()}`
  }, [departmentId])

  const handleSave = useCallback(
    (result?: { entryKind?: "standard" | "agent_call"; date?: string }) => {
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
        initialExistingStandardEntryId={initialExistingStandardEntryId}
        onDateChange={handleDateChange}
        onSave={handleSave}
        onCancel={handleCancel}
        stayOnAgentCallSave
        initialRoleQuestions={initialRoleQuestions}
      />
    </div>
  )
}
