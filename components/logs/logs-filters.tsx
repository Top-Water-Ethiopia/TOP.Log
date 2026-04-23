"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { buildLogsPageHrefFromState } from "@/lib/logs-page-filters"
import { cn } from "@/lib/utils"
import type { LogsViewMode } from "@/lib/logs-page-filters"
import { useMemo, useRef, useState, useEffect, useCallback } from "react"
import {
  normalizeDraft,
  toSnapshotKey,
  type LogsFiltersDraft,
  FILTER_KEYS,
} from "@/lib/logs/filters-state"

interface LogsFiltersProps {
  currentView: LogsViewMode
  date?: string
  departmentId?: string
  departments: Array<{ id: string; name: string }>
  hasFilters: boolean
  isBasicUser: boolean
  month: string
  searchName?: string
  professionRoleId?: string
  entryKind?: string
  professionRoles: Array<{ id: string; name: string; label: string }>
  entryKinds: Array<{ entry_kind: string; label: string }>
}

export function LogsFilters({
  currentView,
  date,
  departmentId,
  departments,
  hasFilters,
  isBasicUser,
  month,
  searchName,
  professionRoleId,
  entryKind,
  professionRoles,
  entryKinds,
}: LogsFiltersProps) {
  const router = useRouter()

  const appliedDraft: LogsFiltersDraft = useMemo(
    () => ({
      view: currentView,
      month,
      date,
      departmentId,
      professionRoleId,
      entryKind,
      searchRaw: searchName || "",
    }),
    [currentView, month, date, departmentId, professionRoleId, entryKind, searchName]
  )

  const appliedSnapshot = useMemo(() => normalizeDraft(appliedDraft), [appliedDraft])
  const appliedSnapshotKey = useMemo(() => toSnapshotKey(appliedSnapshot), [appliedSnapshot])

  const [draftDepartmentId, setDraftDepartmentId] = useState<string>(departmentId || "")
  const [draftProfessionRoleId, setDraftProfessionRoleId] = useState<string>(professionRoleId || "")
  const [draftEntryKind, setDraftEntryKind] = useState<string>(entryKind || "")
  const [draftSearchRaw, setDraftSearchRaw] = useState<string>(searchName || "")
  const [draftDate, setDraftDate] = useState<string>(date || "")

  const draft: LogsFiltersDraft = useMemo(
    () => ({
      view: currentView,
      month,
      date: draftDate || undefined,
      departmentId: draftDepartmentId || undefined,
      professionRoleId: draftProfessionRoleId || undefined,
      entryKind: draftEntryKind || undefined,
      searchRaw: draftSearchRaw,
    }),
    [currentView, month, draftDate, draftDepartmentId, draftProfessionRoleId, draftEntryKind, draftSearchRaw]
  )

  const snapshot = useMemo(() => normalizeDraft(draft), [draft])
  const snapshotKey = useMemo(() => toSnapshotKey(snapshot), [snapshot])
  const applyEnabled = snapshotKey !== appliedSnapshotKey

  const userDirtyKeysRef = useRef<Set<(typeof FILTER_KEYS)[number]>>(new Set())
  const [dirtyCount, setDirtyCount] = useState<number>(0)

  const applyVersionRef = useRef(0)
  const pendingTimerRef = useRef<number | null>(null)
  const pendingApplyRef = useRef(false)
  const isProfessionPendingRef = useRef(false)
  const lastScheduledSnapshotKeyRef = useRef<string | null>(null)
  const lastAppliedSnapshotKeyRef = useRef<string>(appliedSnapshotKey)

  const isUserInteractingRef = useRef(false)
  const interactionTimerRef = useRef<number | null>(null)
  const forceSyncRef = useRef(false)
  const draftRef = useRef<LogsFiltersDraft>(draft)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const markInteracting = useCallback(() => {
    isUserInteractingRef.current = true
    if (interactionTimerRef.current) {
      window.clearTimeout(interactionTimerRef.current)
    }
    interactionTimerRef.current = window.setTimeout(() => {
      if (!pendingApplyRef.current) {
        isUserInteractingRef.current = false
      }
    }, 800)
  }, [])

  const syncDraftFromApplied = useCallback(() => {
    setDraftDepartmentId(departmentId || "")
    setDraftProfessionRoleId(professionRoleId || "")
    setDraftEntryKind(entryKind || "")
    setDraftSearchRaw(searchName || "")
    setDraftDate(date || "")
  }, [departmentId, professionRoleId, entryKind, searchName, date])

  // Sync draft from applied only when not interacting and nothing is dirty.
  useEffect(() => {
    if (forceSyncRef.current) {
      forceSyncRef.current = false
      syncDraftFromApplied()
      return
    }
    if (isUserInteractingRef.current) return
    if (applyEnabled) return
    syncDraftFromApplied()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSnapshotKey])

  // Clear dirty tracking when navigation settles on the last applied snapshot.
  useEffect(() => {
    if (appliedSnapshotKey === lastAppliedSnapshotKeyRef.current) {
      pendingApplyRef.current = false
      isProfessionPendingRef.current = false
      isUserInteractingRef.current = false
      userDirtyKeysRef.current.clear()
      setDirtyCount(0)
    }
  }, [appliedSnapshotKey])

  const clearPendingApply = useCallback(() => {
    applyVersionRef.current += 1
    pendingApplyRef.current = false
    isProfessionPendingRef.current = false
    lastScheduledSnapshotKeyRef.current = null
    if (pendingTimerRef.current) {
      window.clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
  }, [])

  // Forced sync on popstate must cancel pending applies.
  useEffect(() => {
    const handler = () => {
      clearPendingApply()
      forceSyncRef.current = true
      isUserInteractingRef.current = false
      userDirtyKeysRef.current.clear()
      setDirtyCount(0)
    }
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [clearPendingApply])

  const buildHrefFromSnapshot = useCallback(
    (next: ReturnType<typeof normalizeDraft>) => {
      return buildLogsPageHrefFromState({
        view: next.view,
        month: next.month,
        date: next.date || "",
        departmentId: next.departmentId || "",
        page: 1,
        searchName: next.searchName || "",
        selectedLogId: "",
        nextCursorDate: "",
        nextCursorId: "",
        professionRoleId: next.professionRoleId || "",
        entryKind: next.entryKind || "",
      })
    },
    []
  )

  const scheduleApply = useCallback(
    (delayMs: number) => {
      const currentSnapshot = normalizeDraft(draftRef.current)
      const currentKey = toSnapshotKey(currentSnapshot)
      if (currentKey === lastAppliedSnapshotKeyRef.current) return

      pendingApplyRef.current = true
      const version = (applyVersionRef.current += 1)
      lastScheduledSnapshotKeyRef.current = currentKey

      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current)
      }

      pendingTimerRef.current = window.setTimeout(() => {
        if (version !== applyVersionRef.current) return
        const latestSnapshot = normalizeDraft(draftRef.current)
        const latestKey = toSnapshotKey(latestSnapshot)
        if (latestKey === lastAppliedSnapshotKeyRef.current) return

        lastAppliedSnapshotKeyRef.current = latestKey
        router.replace(buildHrefFromSnapshot(latestSnapshot))
      }, delayMs)
    },
    [draft, router, buildHrefFromSnapshot]
  )

  const updateDirtyKey = useCallback((key: (typeof FILTER_KEYS)[number]) => {
    userDirtyKeysRef.current.add(key)
    setDirtyCount(userDirtyKeysRef.current.size)
  }, [])

  const appliedProfessionRoleId = professionRoleId || ""
  const appliedDepartmentId = departmentId || ""

  const clearFilters = useCallback(() => {
    clearPendingApply()
    userDirtyKeysRef.current.clear()
    setDirtyCount(0)
    const cleared = normalizeDraft({
      view: currentView,
      month,
      searchRaw: "",
    })
    lastAppliedSnapshotKeyRef.current = toSnapshotKey(cleared)
    router.replace(buildHrefFromSnapshot(cleared))
  }, [clearPendingApply, currentView, month, router, buildHrefFromSnapshot])

  return (
    <form action="/logs" className="space-y-4">
      <input type="hidden" name="view" value={currentView} />

      {currentView === "calendar" || currentView === "files" ? (
        <input type="hidden" name="month" value={month} />
      ) : null}
      {currentView === "calendar" && date ? <input type="hidden" name="date" value={date} /> : null}
      {currentView === "files" && date ? <input type="hidden" name="date" value={date} /> : null}

      {/* Primary row: date, department, search */}
      <div className="flex flex-wrap items-end gap-4">
        {currentView === "list" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="logs-date-filter" className="text-sm font-medium">
              Date
            </label>
            <input
              id="logs-date-filter"
              type="date"
              name="date"
              value={draftDate}
              onChange={(e) => {
                markInteracting()
                setDraftDate(e.target.value)
                draftRef.current = {
                  ...draftRef.current,
                  date: e.target.value || undefined,
                }
                updateDirtyKey("date")
              }}
              className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
            />
          </div>
        ) : date ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Selected date</span>
            <div className="flex items-center gap-2">
              <span className="bg-muted text-muted-foreground inline-flex h-9 items-center rounded-md px-3 text-sm">
                {date}
              </span>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link
                  href={buildLogsPageHref({
                    view: "calendar",
                    departmentId,
                    month,
                  })}
                >
                  Clear day
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        {!isBasicUser && departments.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="logs-department-filter" className="text-sm font-medium">
              Department
            </label>
            <select
              id="logs-department-filter"
              name="departmentId"
              value={draftDepartmentId}
              onChange={(e) => {
                markInteracting()
                const nextDepartmentId = e.target.value
                setDraftDepartmentId(nextDepartmentId)
                setDraftProfessionRoleId("")
                setDraftEntryKind("")
                draftRef.current = {
                  ...draftRef.current,
                  departmentId: nextDepartmentId || undefined,
                  professionRoleId: undefined,
                  entryKind: undefined,
                }
                updateDirtyKey("departmentId")
              }}
              className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {!isBasicUser ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="logs-search-filter" className="text-sm font-medium">
              Search by name
            </label>
            <input
              id="logs-search-filter"
              type="text"
              name="searchName"
              value={draftSearchRaw}
              onChange={(e) => {
                markInteracting()
                setDraftSearchRaw(e.target.value)
                draftRef.current = {
                  ...draftRef.current,
                  searchRaw: e.target.value,
                }
                updateDirtyKey("searchName")

                // Only auto-apply search if department draft matches applied department (no applying against pending switch).
                if ((draftDepartmentId || "") !== appliedDepartmentId) return
                scheduleApply(400)
              }}
              placeholder="Enter name to search..."
              className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
            />
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!applyEnabled}
            onClick={() => {
              clearPendingApply()
              const href = buildHrefFromSnapshot(snapshot)
              lastAppliedSnapshotKeyRef.current = snapshotKey
              router.replace(href)
            }}
          >
            {dirtyCount > 0 ? `Apply (${dirtyCount})` : "Apply"}
          </Button>
          {hasFilters ? (
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {/* Hidden filter indicator (when URL has filters but controls are not visible) */}
      {!isBasicUser && !draftDepartmentId && (professionRoleId || entryKind) ? (
        <div className="bg-muted/20 text-muted-foreground flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="font-medium">Filtered by:</span>
          {professionRoleId ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                markInteracting()
                setDraftProfessionRoleId("")
                setDraftEntryKind("")
                updateDirtyKey("professionRoleId")
                updateDirtyKey("entryKind")
              }}
            >
              Profession (clear)
            </Button>
          ) : null}
          {entryKind ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                markInteracting()
                setDraftEntryKind("")
                updateDirtyKey("entryKind")
              }}
            >
              Entry kind (clear)
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Secondary row: profession, entry kind (only shown when department selected) */}
      {draftDepartmentId && !isBasicUser && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="logs-profession-filter" className="text-sm font-medium">
              Profession
            </label>
            <select
              id="logs-profession-filter"
              name="professionRoleId"
              value={draftProfessionRoleId}
              onChange={(e) => {
                markInteracting()
                const nextProfessionRoleId = e.target.value
                setDraftProfessionRoleId(nextProfessionRoleId)
                setDraftEntryKind("")
                draftRef.current = {
                  ...draftRef.current,
                  professionRoleId: nextProfessionRoleId || undefined,
                  entryKind: undefined,
                }
                updateDirtyKey("professionRoleId")

                // Only auto-apply profession if department is already applied.
                if ((draftDepartmentId || "") !== appliedDepartmentId) return
                isProfessionPendingRef.current = true
                scheduleApply(250)
              }}
              className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All Professions</option>
              {professionRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="logs-entry-kind-filter" className="text-sm font-medium">
              Entry Kind
            </label>
            <select
              id="logs-entry-kind-filter"
              name="entryKind"
              value={draftEntryKind}
              onChange={(e) => {
                markInteracting()
                const nextEntryKind = e.target.value
                setDraftEntryKind(nextEntryKind)
                draftRef.current = {
                  ...draftRef.current,
                  entryKind: nextEntryKind || undefined,
                }
                updateDirtyKey("entryKind")

                // If profession apply is pending, piggyback into that scheduled apply.
                if (isProfessionPendingRef.current) return

                // Only auto-apply entry kind if profession is already applied.
                if ((draftProfessionRoleId || "") !== appliedProfessionRoleId) return
                scheduleApply(0)
              }}
              disabled={!draftProfessionRoleId}
              className={cn(
                "border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm",
                !draftProfessionRoleId && "cursor-not-allowed opacity-50"
              )}
            >
              <option value="">{draftProfessionRoleId ? "All Entry Kinds" : "Select a profession first"}</option>
              {entryKinds.map((kind) => (
                <option key={kind.entry_kind} value={kind.entry_kind}>
                  {kind.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </form>
  )
}
