"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCaptainLog, type CaptainLogEntry } from "@/contexts/supabase-log-context"
import { ArrowLeft, Edit, AlertTriangle, Lock } from "lucide-react"
import type { CustomQuestion, QuestionResponse } from "@/lib/rbac/types"
import { canUpdateEntryForDate } from "@/lib/date-restrictions"
import { useRoleQuestions } from "@/hooks/use-role-questions"
import { useRBAC } from "@/hooks/use-rbac"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"
import { ImageResponsePreview } from "@/components/image-response-preview"
import { getQuestionReactKey } from "@/lib/role-question-identity"
import { toast } from "sonner"
import type { CloudinaryUploadAsset } from "@/lib/cloudinary"
import { normalizeImageResponseValue } from "@/lib/image-upload"

interface EntryDetailsProps {
  date: string
  departmentId: string
  entry?: CaptainLogEntry | null
  isLoading?: boolean
  hideHeader?: boolean
  onBack: () => void
  onViewEntry?: (date: string) => void
}

type EditableRoleQuestion = {
  id?: string
  key: string
  type: string
  defaultValue?: unknown
}

export function EntryDetails({ date, departmentId, entry, isLoading, hideHeader, onBack }: EntryDetailsProps) {
  const { entries, updateEntry } = useCaptainLog()
  const { questions: roleQuestions, isLoading: isRoleQuestionsLoading } = useRoleQuestions(undefined, departmentId)
  const { processResponses } = useRBAC()

  const didInitEditResponsesRef = useRef(false)

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editResponses, setEditResponses] = useState<Record<string, unknown>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [didSaveRecently, setDidSaveRecently] = useState(false)

  const getQuestionLabel = (question: unknown) => {
    const label = (question as { label?: unknown })?.label
    return typeof label === "string" && label.trim().length > 0 ? label : "Question"
  }

  const getQuestionId = (question: unknown) => {
    const id = (question as { id?: unknown })?.id
    return typeof id === "string" && id.trim().length > 0 ? id : null
  }

  const findResponseForQuestion = (entryToSearch: CaptainLogEntry, question: unknown, questionKey: string) => {
    const questionId = getQuestionId(question)
    return (entryToSearch.customResponses || []).find((r: unknown) => {
      if (!r || typeof r !== "object") return false
      const response = r as { questionId?: unknown; questionKey?: unknown }
      if (questionId && response.questionId === questionId) return true
      return response.questionKey === questionKey
    }) as QuestionResponse | undefined
  }

  // Use useMemo to avoid re-creating on every render and prevent audit log spam
  const currentEntry = useMemo(() => {
    if (entry !== undefined) {
      return entry ?? undefined
    }
    return entries.find((e) => e.date === date && e.department_id === departmentId)
  }, [departmentId, date, entries, entry])

  const formatCustomResponseValue = (response: QuestionResponse) => {
    const questionType = response.questionType ?? "text"
    const { value } = response

    if (questionType === "image") {
      const assets = normalizeImageResponseValue(value)
      if (assets.length > 0) {
        return assets.map((asset) => asset.originalFilename).join(", ")
      }
    }

    if (value === null || value === undefined || value === "") {
      return "Not provided"
    }

    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : "Not provided"
    }

    if (questionType === "checkbox") {
      return value ? "Yes" : "No"
    }

    if (questionType === "date" && typeof value === "string") {
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
    }

    return String(value)
  }

  const renderCustomResponseValue = (response: QuestionResponse) => {
    const questionType = response.questionType ?? "text"
    const { value } = response
    const imageAssets = questionType === "image" ? normalizeImageResponseValue(value) : []

    if (questionType === "image" && imageAssets.length > 0) {
      return <ImageResponsePreview value={value} />
    }

    if (
      questionType === "file" &&
      value &&
      typeof value === "object" &&
      (value as Partial<CloudinaryUploadAsset>).provider === "cloudinary"
    ) {
      const asset = value as CloudinaryUploadAsset
      return (
        <div className="space-y-3">
          {questionType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.secureUrl} alt={asset.originalFilename} className="max-h-64 rounded-md border object-cover" />
          ) : null}
          <a href={asset.secureUrl} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">
            {asset.originalFilename}
          </a>
        </div>
      )
    }

    return <span>{formatCustomResponseValue(response)}</span>
  }

  // Check if entry can be edited (within 2-day window)
  const canEdit = useMemo(() => {
    if (!currentEntry) return false
    const validation = canUpdateEntryForDate(currentEntry.date, currentEntry.createdAt)
    return validation.isValid
  }, [currentEntry])

  const roleQuestionsKey = useMemo(() => {
    if (!Array.isArray(roleQuestions)) return ""
    return roleQuestions.map((q) => String((q as { key?: unknown })?.key ?? "")).join("|")
  }, [roleQuestions])

  const showHeader = !hideHeader

  useEffect(() => {
    if (!didSaveRecently) return
    const t = window.setTimeout(() => setDidSaveRecently(false), 2000)
    return () => window.clearTimeout(t)
  }, [didSaveRecently])

  // Initialize edit responses when entering edit mode (once) or when entry changes.
  useEffect(() => {
    if (!isEditing) {
      didInitEditResponsesRef.current = false
      return
    }
    if (!currentEntry) return
    if (didInitEditResponsesRef.current) return
    if (!Array.isArray(roleQuestions) || roleQuestions.length === 0) return

    const initial: Record<string, unknown> = {}

    const qs = roleQuestions as EditableRoleQuestion[]

    qs.forEach((q) => {
      const key = q.key
      const existing = (currentEntry.customResponses || []).find(
        (r: unknown) =>
          typeof r === "object" &&
          r !== null &&
          (((r as { questionId?: unknown }).questionId === q.id && typeof q.id === "string") ||
            (r as { questionKey?: unknown }).questionKey === key)
      )

      if (existing && Object.prototype.hasOwnProperty.call(existing as object, "value")) {
        initial[key] = (existing as { value?: unknown }).value
      } else if (q.defaultValue !== undefined) {
        initial[key] = q.defaultValue
      } else if (q.type === "multiselect") {
        initial[key] = []
      } else if (q.type === "checkbox") {
        initial[key] = false
      } else {
        initial[key] = ""
      }
    })

    setEditResponses(initial)
    setEditErrors({})
    didInitEditResponsesRef.current = true
  }, [currentEntry, isEditing, roleQuestionsKey, roleQuestions])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" })
  }

  // Industrial standard: Show ONLY role-specific responses in Daily Log view
  // No legacy fields, no generic questions - only custom role-based Q&A

  // Show skeleton while loading entry or role questions
  if (isLoading || isRoleQuestionsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Card>
      </div>
    )
  }

  if (!currentEntry) {
    // Show skeleton while role questions are loading even if no entry exists
    if (isRoleQuestionsLoading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
          <Card className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-2xl font-semibold">Entry Details</h2>
            <p className="text-muted-foreground mt-2 text-sm">{formatDate(date)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No entry found for this date</p>
        </Card>
      </div>
    )
  }

  const handleStartEdit = () => {
    if (!canEdit) return
    setDidSaveRecently(false)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setIsSaving(false)
    setEditErrors({})
    setDidSaveRecently(false)
  }

  const handleSaveEdit = async () => {
    if (!currentEntry) return
    if (isSaving) return

    try {
      setIsSaving(true)
      setEditErrors({})

      const processed = processResponses(roleQuestions as unknown as CustomQuestion[], editResponses)
      if (!processed.valid) {
        setEditErrors(processed.errors)
        toast.error("Please fix the highlighted fields")
        return
      }

      const nowIso = new Date().toISOString()

      await updateEntry(currentEntry.id, {
        // Preserve existing standard fields so we don't wipe them.
        objectives: currentEntry.objectives,
        keyResults: currentEntry.keyResults,
        challenges: currentEntry.challenges,
        developmentTasks: currentEntry.developmentTasks,
        featuresCompleted: currentEntry.featuresCompleted,
        challengesAndBlockers: currentEntry.challengesAndBlockers,
        codeAndPriorities: currentEntry.codeAndPriorities,
        systemImprovements: currentEntry.systemImprovements,
        projectUpdates: currentEntry.projectUpdates,
        updatedAt: nowIso,
        customResponses: processed.processedResponses,
      })

      toast.success("Entry updated")
      setDidSaveRecently(true)
      setIsEditing(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update entry")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      {/* Header */}
      <div className="flex w-full shrink-0 items-start justify-between gap-4">
        {showHeader ? (
          <div className="min-w-0 flex-1">
            <h2 className="text-foreground text-2xl font-semibold">Daily Log</h2>
            <p className="text-muted-foreground mt-2 text-sm">{formatDate(date)}</p>
            {!canEdit ? (
              <div className="mt-2">
                <Badge variant="secondary" className="gap-2" title="Entries older than 2 days are locked for editing">
                  <Lock className="h-3.5 w-3.5" />
                  Locked
                </Badge>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-2">
          {isSaving ? (
            <span className="text-muted-foreground text-xs">Saving...</span>
          ) : didSaveRecently ? (
            <span className="text-muted-foreground text-xs">Saved</span>
          ) : null}
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSaveEdit()} disabled={isSaving || isRoleQuestionsLoading}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleStartEdit}
              className="gap-2"
              disabled={!canEdit}
              title={!canEdit ? "Entries older than 2 days cannot be edited" : "Edit this entry"}
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Entry Content - Only Role-Specific Responses */}
      <Card className="flex-1 overflow-y-auto p-6 shadow-sm">
        <div className="space-y-8">
          {isEditing ? (
            Array.isArray(roleQuestions) && roleQuestions.length > 0 ? (
              <div className="space-y-4">
                {(roleQuestions as unknown as CustomQuestion[]).map((question, index) => {
                  const reactKey = getQuestionReactKey(question, index)
                  const key = String((question as { key?: unknown })?.key ?? "")
                  const required = !!(question as { required?: unknown })?.required
                  const questionType = (question as { type?: unknown })?.type
                  const valueForCount = (editResponses as Record<string, unknown>)[key]
                  const showCharacterCount =
                    (questionType === "text" || questionType === "textarea") && typeof valueForCount === "string"

                  return (
                    <div key={reactKey} className="bg-background rounded-xl border p-6">
                      <div className="flex items-start gap-4">
                        <div className="bg-muted mt-0 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                          <span className="text-muted-foreground text-xs font-medium">{index + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="text-sm font-medium">{getQuestionLabel(question)}</h3>
                            {required ? <span className="text-muted-foreground text-xs">Required field</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <RoleBasedQuestionFields
                          questions={[question]}
                          responses={editResponses as unknown as Record<string, unknown>}
                          errors={editErrors}
                          onChange={(questionKey, value) => {
                            setEditResponses((prev) => ({ ...prev, [questionKey]: value as unknown }))
                            setEditErrors((prev) => {
                              if (!prev[questionKey]) return prev
                              return { ...prev, [questionKey]: "" }
                            })
                          }}
                          renderMode="fieldsOnly"
                        />

                        {showCharacterCount ? (
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">{valueForCount.length} characters</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <RoleBasedQuestionFields
                  questions={roleQuestions as unknown as CustomQuestion[]}
                  responses={editResponses as unknown as Record<string, unknown>}
                  errors={editErrors}
                  onChange={(questionKey, value) => {
                    setEditResponses((prev) => ({ ...prev, [questionKey]: value as unknown }))
                    setEditErrors((prev) => {
                      if (!prev[questionKey]) return prev
                      return { ...prev, [questionKey]: "" }
                    })
                  }}
                />
              </div>
            )
          ) : Array.isArray(roleQuestions) && roleQuestions.length > 0 ? (
            <div className="space-y-4">
              {(roleQuestions as unknown as CustomQuestion[]).map((question, index) => {
                const reactKey = getQuestionReactKey(question, index)
                const key = String((question as { key?: unknown })?.key ?? "")
                const required = !!(question as { required?: unknown })?.required
                const response = findResponseForQuestion(currentEntry, question, key)

                return (
                  <div key={reactKey} className="bg-background rounded-xl border p-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-muted mt-0 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                        <span className="text-muted-foreground text-xs font-medium">{index + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="text-sm font-medium">{getQuestionLabel(question)}</h3>
                          {required ? <span className="text-muted-foreground text-xs">Required field</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                        {response ? renderCustomResponseValue(response) : "Not provided"}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : currentEntry.customResponses &&
            currentEntry.customResponses.length > 0 &&
            Array.isArray(roleQuestions) &&
            roleQuestions.length > 0 ? (
            <div>
              <div className="space-y-4">
                {currentEntry.customResponses.map((response, index) => {
                  const resp = response as QuestionResponse
                  return (
                    <div
                      key={`${resp.questionId}-${resp.timestamp}`}
                      className="bg-muted/30 border-border/50 space-y-2 rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-foreground text-sm font-medium">
                          {index + 1}) {resp.questionLabel ?? resp.questionKey}
                        </p>
                      </div>
                      <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                        {renderCustomResponseValue(resp)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <AlertTriangle className="h-10 w-10 text-amber-500" />
                <div>
                  <p className="text-foreground text-base font-medium">No Role-Specific Responses</p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    This entry does not contain any role-specific question responses.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Metadata */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>Created {formatTime(currentEntry.createdAt)}</span>
            {currentEntry.createdAt !== currentEntry.updatedAt && (
              <>
                <span>•</span>
                <span>Updated {formatTime(currentEntry.updatedAt)}</span>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
