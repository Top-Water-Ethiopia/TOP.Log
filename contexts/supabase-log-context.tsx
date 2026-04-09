"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useSupabaseAuth } from "./supabase-auth-context"
import { useSWRConfig } from "swr"
import { v4 as uuidv4 } from "uuid"
import * as supabaseData from "@/lib/supabase-data"
import type { CaptainLogEntry as DbCaptainLogEntry, AuditLog } from "@/lib/supabase-data"
import type { Json } from "@/lib/supabase.types"
import { canCreateEntryForDate, canUpdateEntryForDate } from "@/lib/date-restrictions"
import { deriveReportKindFromResponses, normalizeReportKind, type ReportKind } from "@/lib/reporting-model"

// Re-export types for components
export type { AuditLog } from "@/lib/supabase-data"

// Enhanced entry type with camelCase properties for components
export type CaptainLogEntry = {
  // Core properties
  id: string
  user_id: string
  entry_kind: string
  submitted_by_user_id: string | null
  report_kind: ReportKind
  date: string
  department_id: string | null
  subject_agent_id: string | null
  subject_agent_snapshot: Json | null
  subject_department_id: string | null
  subject_profession_id: string | null
  created_at: string
  updated_at: string
  version: number
  metadata: unknown | null

  // Standard question fields (now loaded from custom_responses)
  objectives: string
  keyResults: string
  challenges: string
  developmentTasks: string
  featuresCompleted: string
  challengesAndBlockers: string
  codeAndPriorities: string
  systemImprovements: string
  projectUpdates: string

  // Metadata fields
  createdAt: string
  updatedAt: string

  // Custom responses
  customResponses: unknown[]
}

type CaptainLogEntryDraftInput = {
  date: string
  department_id: string | null
  metadata: unknown | null
  objectives: string
  keyResults: string
  challenges: string
  developmentTasks: string
  featuresCompleted: string
  challengesAndBlockers: string
  codeAndPriorities: string
  systemImprovements: string
  projectUpdates: string
  createdAt?: string
  updatedAt?: string
  customResponses: unknown[]
  report_kind?: ReportKind
  entry_kind?: string
  subject_agent_id?: string | null
  subject_agent_snapshot?: Json | null
  subject_department_id?: string | null
  subject_profession_id?: string | null
}

// Helper function to get standard question labels
function getStandardQuestionLabel(key: string): string {
  const labels: Record<string, string> = {
    objectives: "Objectives",
    keyResults: "Key Results",
    challenges: "Challenges",
    developmentTasks: "Development Tasks",
    featuresCompleted: "Features Completed",
    challengesAndBlockers: "Challenges & Blockers",
    codeAndPriorities: "Code Review & Priorities",
    systemImprovements: "System Improvements",
    projectUpdates: "Project Updates",
  }
  return labels[key] || key
}

// Transform a batch of entries using pre-fetched custom responses
function transformEntriesWithCustomResponses(
  entries: DbCaptainLogEntry[],
  allCustomResponses: supabaseData.CustomResponse[]
): CaptainLogEntry[] {
  // Group custom responses by entry_id for O(1) lookup
  const responsesByEntryId = new Map<string, supabaseData.CustomResponse[]>()
  for (const response of allCustomResponses) {
    const entryResponses = responsesByEntryId.get(response.entry_id) || []
    entryResponses.push(response)
    responsesByEntryId.set(response.entry_id, entryResponses)
  }

  return entries.map((entry) => {
    const customResponsesData = responsesByEntryId.get(entry.id) || []

    // Transform custom responses to expected format
    const customResponses = customResponsesData.map((response) => ({
      questionId: response.question_id,
      questionKey: response.question_key,
      questionLabel: response.question_label,
      questionType: response.question_type,
      questionCategory: response.question_category,
      value: response.value as Json,
      timestamp: response.timestamp,
    }))

    // Extract standard fields from custom responses
    const standardResponses = customResponsesData.filter((r) => r.question_category === "standard")
    const getField = (key: string) => {
      const response = standardResponses.find((r) => r.question_key === key)
      return response ? (response.value as string) || "" : ""
    }

    return {
      ...entry,
      entry_kind: typeof entry.entry_kind === "string" ? entry.entry_kind : "standard",
      report_kind: normalizeReportKind(entry.report_kind),
      // Standard fields from custom responses
      objectives: getField("objectives"),
      keyResults: getField("keyResults"),
      challenges: getField("challenges"),
      developmentTasks: getField("developmentTasks"),
      featuresCompleted: getField("featuresCompleted"),
      challengesAndBlockers: getField("challengesAndBlockers"),
      codeAndPriorities: getField("codeAndPriorities"),
      systemImprovements: getField("systemImprovements"),
      projectUpdates: getField("projectUpdates"),

      // Metadata fields
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,

      // All custom responses
      customResponses,
    }
  })
}

// Compatibility layer: Transform single database entry + custom responses to component format
async function transformEntryForComponents(entry: DbCaptainLogEntry): Promise<CaptainLogEntry> {
  // Fetch custom responses for this entry
  let customResponsesData: unknown[] = []
  try {
    customResponsesData = await supabaseData.getCustomResponses(entry.id)
  } catch (error) {
    console.error(`Failed to load custom responses for entry ${entry.id}:`, error)
  }

  // Transform custom responses to expected format
  const customResponses = customResponsesData.map((response) => {
    const resp = response as Record<string, unknown>
    return {
      questionId: resp.question_id as string,
      questionKey: resp.question_key as string,
      questionLabel: resp.question_label as string,
      questionType: resp.question_type as string,
      questionCategory: resp.question_category as string | undefined,
      value: resp.value as Json,
      timestamp: resp.timestamp as string,
    }
  })

  // Extract standard fields from custom responses
  const standardResponses = customResponsesData.filter((r) => {
    const resp = r as Record<string, unknown>
    return resp.question_category === "standard"
  })
  const getField = (key: string) => {
    const response = standardResponses.find((r) => {
      const resp = r as Record<string, unknown>
      return resp.question_key === key
    })
    const resp = response as Record<string, unknown>
    return resp ? (resp.value as string) || "" : ""
  }

  return {
    ...entry,
    entry_kind: typeof entry.entry_kind === "string" ? entry.entry_kind : "standard",
    report_kind: normalizeReportKind(entry.report_kind),
    // Standard fields from custom responses
    objectives: getField("objectives"),
    keyResults: getField("keyResults"),
    challenges: getField("challenges"),
    developmentTasks: getField("developmentTasks"),
    featuresCompleted: getField("featuresCompleted"),
    challengesAndBlockers: getField("challengesAndBlockers"),
    codeAndPriorities: getField("codeAndPriorities"),
    systemImprovements: getField("systemImprovements"),
    projectUpdates: getField("projectUpdates"),

    // Metadata fields
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,

    // All custom responses
    customResponses,
  }
}

// Transform entry from components to database format (entry + custom responses)
function transformEntryForDatabase(entry: Partial<CaptainLogEntry>): Record<string, unknown> {
  const dbEntry: Record<string, unknown> = { ...entry }

  // Remove component-only fields
  delete dbEntry.objectives
  delete dbEntry.keyResults
  delete dbEntry.challenges
  delete dbEntry.developmentTasks
  delete dbEntry.featuresCompleted
  delete dbEntry.challengesAndBlockers
  delete dbEntry.codeAndPriorities
  delete dbEntry.systemImprovements
  delete dbEntry.projectUpdates
  delete dbEntry.createdAt
  delete dbEntry.updatedAt
  delete dbEntry.customResponses

  return dbEntry
}

// Context type
interface CaptainLogContextType {
  entries: CaptainLogEntry[]
  isLoading: boolean
  error: Error | null
  auditLogs: AuditLog[]

  // Enhanced CRUD operations
  addEntry: (entry: CaptainLogEntryDraftInput) => Promise<void>
  updateEntry: (id: string, entry: Partial<CaptainLogEntry>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  getEntryByDate: (date: string, departmentId?: string | null) => CaptainLogEntry | undefined
  getEntryById: (id: string) => CaptainLogEntry | undefined

  // Batch operations
  batchDelete: (ids: string[]) => Promise<void>

  // Query operations
  searchEntries: (query: string) => Promise<CaptainLogEntry[]>
  getEntriesByDateRange: (from: string, to: string) => Promise<CaptainLogEntry[]>

  // Utility
  exportData: () => string
  importData: (data: string) => Promise<void>
  migrateFromLocalStorage: () => Promise<void>
  clearError: () => void

  // Refresh data
  refreshEntries: () => Promise<void>
}

// Create the context
const SupabaseLogContext = createContext<CaptainLogContextType | undefined>(undefined)

// Provider component
export function SupabaseLogProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useSupabaseAuth()
  const { mutate: globalMutate } = useSWRConfig()

  // State
  const [entries, setEntries] = useState<CaptainLogEntry[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Load entries from Supabase
  const loadEntries = useCallback(async () => {
    if (!user) {
      setEntries([])
      return
    }

    setIsLoading(true)
    try {
      const data = await supabaseData.getEntriesByUserId(user.id)
      // Batch fetch all custom responses in a single query
      const entryIds = data.map((entry) => entry.id)
      const allCustomResponses = await supabaseData.getCustomResponsesForEntries(entryIds)
      // Transform entries with pre-fetched custom responses
      const transformedEntries = transformEntriesWithCustomResponses(data, allCustomResponses)
      setEntries(transformedEntries)
      setError(null)
    } catch (error) {
      console.error("Failed to load entries:", error)
      setError(error as Error)
      toast.error("Failed to load your entries")
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    if (!user) {
      setAuditLogs([])
      return
    }

    try {
      const data = await supabaseData.getAuditLogs(user.id)
      setAuditLogs(data)
    } catch (error) {
      console.error("Failed to load audit logs:", error)
    }
  }, [user])

  // Initialize data on mount or user change
  useEffect(() => {
    if (user) {
      loadEntries()
      loadAuditLogs()
    } else {
      setEntries([])
      setAuditLogs([])
      setIsLoading(false)
    }
  }, [user, loadEntries, loadAuditLogs]) // Include callbacks to ensure stable dependency array

  // CRUD Operations

  // Add entry
  const addEntry = useCallback(
    async (entry: CaptainLogEntryDraftInput) => {
      if (!user) {
        throw new Error("Authentication required")
      }

      const dateValidation = canCreateEntryForDate(entry.date)
      if (!dateValidation.isValid) {
        throw new Error(dateValidation.error || "This date is locked for new reports")
      }

      console.log("[addEntry] start", {
        userId: user.id,
        profileRoleId: profile?.role_id ?? null,
        profileDepartmentId: profile?.department_id ?? null,
        entryDate: entry.date,
        entryDepartmentId: entry.department_id,
      })

      if (!("department_id" in entry)) {
        throw new Error("department_id is required")
      }

      setIsLoading(true)
      setError(null)

      try {
        // Transform entry from camelCase to snake_case for database
        const dbEntry = transformEntryForDatabase(entry)

        const derivedProfession =
          typeof entry.department_id === "string" && entry.department_id
            ? await supabaseData.getProfessionRoleForUserInDepartment(user.id, entry.department_id)
            : null
        const reportKind = entry.report_kind || deriveReportKindFromResponses(entry.customResponses as any[])
        const entryKind = entry.entry_kind || "standard"
        const subjectDepartmentId =
          typeof entry.subject_department_id === "string" ? entry.subject_department_id : entry.department_id
        const subjectProfessionId =
          typeof entry.subject_profession_id === "string"
            ? entry.subject_profession_id
            : derivedProfession?.roleId || null
        const subjectAgentId = typeof entry.subject_agent_id === "string" ? entry.subject_agent_id : null
        const subjectAgentSnapshot = entry.subject_agent_snapshot ?? null

        // Create the entry
        const now = new Date().toISOString()
        console.log("[addEntry] creating", {
          userId: user.id,
          date: entry.date,
          departmentId: entry.department_id,
        })
        const newEntry = await supabaseData.createEntry({
          ...dbEntry,
          id: uuidv4(),
          user_id: user.id,
          entry_kind: entryKind,
          submitted_by_user_id: user.id,
          report_kind: reportKind,
          date: entry.date,
          department_id: entry.department_id,
          subject_agent_id: subjectAgentId,
          subject_agent_snapshot: subjectAgentSnapshot,
          subject_department_id: subjectDepartmentId,
          subject_profession_id: subjectProfessionId,
          created_at: now,
          updated_at: now,
          version: 1,
        })

        console.log("[addEntry] created", {
          entryId: newEntry.id,
          userId: newEntry.user_id,
          entryKind: newEntry.entry_kind,
          submittedByUserId: newEntry.submitted_by_user_id,
          date: newEntry.date,
          departmentId: newEntry.department_id,
          subjectAgentId: newEntry.subject_agent_id,
          subjectDepartmentId: newEntry.subject_department_id,
          subjectProfessionId: newEntry.subject_profession_id,
          reportKind: newEntry.report_kind,
        })

        // Save standard fields as custom responses
        const standardResponses = [
          { key: "objectives", value: entry.objectives || "" },
          { key: "keyResults", value: entry.keyResults || "" },
          { key: "challenges", value: entry.challenges || "" },
          { key: "developmentTasks", value: entry.developmentTasks || "" },
          { key: "featuresCompleted", value: entry.featuresCompleted || "" },
          { key: "challengesAndBlockers", value: entry.challengesAndBlockers || "" },
          { key: "codeAndPriorities", value: entry.codeAndPriorities || "" },
          { key: "systemImprovements", value: entry.systemImprovements || "" },
          { key: "projectUpdates", value: entry.projectUpdates || "" },
        ]

        for (const response of standardResponses) {
          if (typeof response.value !== "string" || response.value.trim() === "") {
            continue
          }
          await supabaseData.createCustomResponse({
            entry_id: newEntry.id,
            question_id: `std_${response.key}`,
            question_key: response.key,
            question_label: getStandardQuestionLabel(response.key),
            question_type: "textarea",
            question_category: "standard",
            value: response.value,
            timestamp: now,
          })
        }

        // Save any additional custom responses
        if (entry.customResponses && Array.isArray(entry.customResponses)) {
          for (const response of entry.customResponses) {
            const resp = response as Record<string, unknown>
            const value = resp.value as Json
            if (value === null || value === undefined) {
              continue
            }
            if (typeof value === "string" && value.trim() === "") {
              continue
            }
            if (Array.isArray(value) && value.length === 0) {
              continue
            }
            await supabaseData.createCustomResponse({
              entry_id: newEntry.id,
              question_id: resp.questionId as string,
              question_key: resp.questionKey as string,
              question_label: resp.questionLabel as string,
              question_type: resp.questionType as string,
              question_category: (resp.questionCategory as string) || "custom",
              value,
              timestamp: now, // Always use current timestamp for new entries
            })
          }
        }

        // Create audit log
        await supabaseData.createAuditLog({
          operation: "CREATE",
          entity_id: newEntry.id,
          user_id: user.id,
          metadata: { date: newEntry.date } as Json,
        })

        // Transform back to camelCase for state
        const transformedEntry = await transformEntryForComponents(newEntry)
        setEntries((prev) => [...prev, transformedEntry])

        // Refresh SWR caches for admin views
        globalMutate("/api/admin/captain-log-entries")

        toast.success("Entry saved successfully")
      } catch (error) {
        console.error("Failed to add entry:", error)
        const duplicateAgentCallMessage =
          error instanceof supabaseData.SupabaseDataError &&
          error.code === "duplicate" &&
          entry.entry_kind === "agent_call"
            ? "A call report for this agent already exists on this date."
            : null

        const normalizedError = duplicateAgentCallMessage ? new Error(duplicateAgentCallMessage) : (error as Error)
        setError(normalizedError)

        const message = duplicateAgentCallMessage || (error instanceof Error ? error.message : "Failed to create entry")
        toast.error(message)
        throw normalizedError
      } finally {
        setIsLoading(false)
      }
    },
    [profile?.department_id, profile?.role_id, user, globalMutate]
  )

  // Update entry
  const updateEntry = useCallback(
    async (id: string, updates: Partial<CaptainLogEntry>) => {
      if (!user) {
        throw new Error("Authentication required")
      }

      setIsLoading(true)
      setError(null)

      try {
        // Find the existing entry
        const existingEntry = entries.find((e) => e.id === id)
        if (!existingEntry) {
          throw new Error(`Entry ${id} not found`)
        }

        const dateValidation = canUpdateEntryForDate(existingEntry.date, existingEntry.createdAt)
        if (!dateValidation.isValid) {
          throw new Error(dateValidation.error || "This entry is locked for edits")
        }

        // Transform updates from camelCase to snake_case for database
        const dbUpdates = transformEntryForDatabase(updates)

        // Update the entry
        const updatedEntry = await supabaseData.updateEntry(id, {
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        })

        // For updates, we'll recreate all custom responses to keep it simple
        // First delete existing custom responses for this entry
        console.log("[updateEntry] Deleting existing custom responses for entry:", id)
        await supabaseData.deleteCustomResponses(id)
        console.log("[updateEntry] Deleted existing custom responses")

        // Then recreate standard fields as custom responses
        const standardResponses = [
          { key: "objectives", value: updates.objectives || "" },
          { key: "keyResults", value: updates.keyResults || "" },
          { key: "challenges", value: updates.challenges || "" },
          { key: "developmentTasks", value: updates.developmentTasks || "" },
          { key: "featuresCompleted", value: updates.featuresCompleted || "" },
          { key: "challengesAndBlockers", value: updates.challengesAndBlockers || "" },
          { key: "codeAndPriorities", value: updates.codeAndPriorities || "" },
          { key: "systemImprovements", value: updates.systemImprovements || "" },
          { key: "projectUpdates", value: updates.projectUpdates || "" },
        ]

        console.log("[updateEntry] Standard responses to create:", standardResponses)

        const now = new Date().toISOString()

        for (const response of standardResponses) {
          if (typeof response.value !== "string" || response.value.trim() === "") {
            continue
          }
          await supabaseData.createCustomResponse({
            entry_id: id,
            question_id: `std_${response.key}`,
            question_key: response.key,
            question_label: getStandardQuestionLabel(response.key),
            question_type: "textarea",
            question_category: "standard",
            value: response.value,
            timestamp: now,
          })
        }

        // Handle additional custom responses if provided
        if (updates.customResponses && Array.isArray(updates.customResponses)) {
          console.log("[updateEntry] Additional custom responses to create:", updates.customResponses)
          for (const response of updates.customResponses) {
            const resp = response as Record<string, unknown>
            const value = resp.value as Json
            if (value === null || value === undefined) {
              continue
            }
            if (typeof value === "string" && value.trim() === "") {
              continue
            }
            if (Array.isArray(value) && value.length === 0) {
              continue
            }
            await supabaseData.createCustomResponse({
              entry_id: id,
              question_id: resp.questionId as string,
              question_key: resp.questionKey as string,
              question_label: resp.questionLabel as string,
              question_type: resp.questionType as string,
              question_category: (resp.questionCategory as string) || "custom",
              value,
              timestamp: now, // Always use current timestamp for updates
            })
          }
        } else {
          console.log("[updateEntry] No additional custom responses to create")
        }

        // Create audit log
        await supabaseData.createAuditLog({
          operation: "UPDATE",
          entity_id: id,
          user_id: user.id,
          changes: {
            from: Object.keys(updates).reduce(
              (acc, key) => {
                acc[key] = (existingEntry as Record<string, unknown>)[key]
                return acc
              },
              {} as Record<string, unknown>
            ),
            to: updates,
          } as Json,
        })

        // Wait a moment for database consistency before transforming
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Transform back to camelCase for state
        const transformedEntry = await transformEntryForComponents(updatedEntry)
        setEntries((prev) => prev.map((e) => (e.id === id ? transformedEntry : e)))

        // Refresh SWR caches for admin views
        globalMutate("/api/admin/captain-log-entries")

        toast.success("Entry updated successfully")
      } catch (error) {
        console.error("Failed to update entry:", error)
        setError(error as Error)

        const message = error instanceof Error ? error.message : "Failed to update entry"
        toast.error(message)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [entries, user, globalMutate]
  )

  // Delete entry
  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user) {
        throw new Error("Authentication required")
      }

      setIsLoading(true)
      setError(null)

      try {
        // Find the existing entry
        const existingEntry = entries.find((e) => e.id === id)
        if (!existingEntry) {
          throw new Error(`Entry ${id} not found`)
        }

        // Delete the entry
        await supabaseData.deleteEntry(id)

        // Create audit log
        await supabaseData.createAuditLog({
          operation: "DELETE",
          entity_id: id,
          user_id: user.id,
          metadata: { date: existingEntry.date },
        })

        // Update local state
        setEntries((prev) => prev.filter((e) => e.id !== id))

        // Refresh SWR caches for admin views
        globalMutate("/api/admin/captain-log-entries")

        toast.success("Entry deleted successfully")
      } catch (error) {
        console.error("Failed to delete entry:", error)
        setError(error as Error)

        const message = error instanceof Error ? error.message : "Failed to delete entry"
        toast.error(message)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [entries, user, globalMutate]
  )

  // Get entry by date
  const getEntryByDate = useCallback(
    (date: string, departmentId?: string | null) => {
      if (departmentId === undefined) {
        return entries.find((entry) => entry.date === date)
      }
      return entries.find((entry) => entry.date === date && entry.department_id === departmentId)
    },
    [entries]
  )

  // Get entry by id
  const getEntryById = useCallback(
    (id: string) => {
      return entries.find((entry) => entry.id === id)
    },
    [entries]
  )

  // Batch Operations

  // Batch delete
  const batchDelete = useCallback(
    async (ids: string[]) => {
      if (!user) {
        throw new Error("Authentication required")
      }

      setIsLoading(true)
      setError(null)

      try {
        // Delete entries one by one
        for (const id of ids) {
          await supabaseData.deleteEntry(id)

          // Create audit log for each deletion
          await supabaseData.createAuditLog({
            operation: "DELETE",
            entity_id: id,
            user_id: user.id,
          })
        }

        // Update local state
        setEntries((prev) => prev.filter((e) => !ids.includes(e.id)))

        toast.success(`Deleted ${ids.length} entries`)
      } catch (error) {
        console.error("Failed to batch delete entries:", error)
        setError(error as Error)

        const message = error instanceof Error ? error.message : "Failed to delete entries"
        toast.error(message)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [user]
  )

  // Query Operations

  // Search entries
  const searchEntries = useCallback(
    async (query: string) => {
      if (!user) {
        return []
      }

      try {
        const results = await supabaseData.searchEntries(user.id, query)
        // Batch fetch all custom responses in a single query
        const entryIds = results.map((entry) => entry.id)
        const allCustomResponses = await supabaseData.getCustomResponsesForEntries(entryIds)
        // Transform results with pre-fetched custom responses
        return transformEntriesWithCustomResponses(results, allCustomResponses)
      } catch (error) {
        console.error("Search failed:", error)
        toast.error("Search failed")
        return []
      }
    },
    [user]
  )

  // Get entries by date range
  const getEntriesByDateRange = useCallback(
    async (from: string, to: string) => {
      if (!user) {
        return []
      }

      try {
        const results = await supabaseData.getEntriesByDateRange(user.id, from, to)
        // Batch fetch all custom responses in a single query
        const entryIds = results.map((entry) => entry.id)
        const allCustomResponses = await supabaseData.getCustomResponsesForEntries(entryIds)
        // Transform results with pre-fetched custom responses
        return transformEntriesWithCustomResponses(results, allCustomResponses)
      } catch (error) {
        console.error("Failed to get entries by date range:", error)
        toast.error("Failed to fetch entries")
        return []
      }
    },
    [user]
  )

  // Utility Functions

  // Export data
  const exportData = useCallback(() => {
    if (!user) {
      throw new Error("Authentication required")
    }

    const data = {
      entries,
      auditLogs: auditLogs.slice(-100), // Last 100 audit logs
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
      version: "2.0",
    }

    return JSON.stringify(data, null, 2)
  }, [entries, auditLogs, user])

  // Import data
  const importData = useCallback(
    async (data: string) => {
      if (!user) {
        throw new Error("Authentication required")
      }

      setIsLoading(true)
      setError(null)

      try {
        const parsedData = JSON.parse(data)
        const importedEntries = Array.isArray(parsedData.entries) ? parsedData.entries : parsedData

        if (!Array.isArray(importedEntries)) {
          throw new Error("Invalid import data format")
        }

        // Import entries one by one
        for (const entry of importedEntries) {
          const importedDepartmentId =
            entry && typeof entry === "object" && "department_id" in entry
              ? ((entry as Record<string, unknown>).department_id as string | null)
              : undefined
          // Check if entry already exists by date
          const existingEntry = await supabaseData.getEntryByDate(user.id, entry.date, importedDepartmentId)

          if (existingEntry) {
            console.log(`Entry for ${entry.date} already exists, skipping`)
            continue
          }

          // Transform entry to database format
          const dbEntry = transformEntryForDatabase(entry)

          // Create new entry
          await supabaseData.createEntry({
            ...dbEntry,
            id: uuidv4(), // Generate new ID to avoid conflicts
            user_id: user.id,
            date: entry.date,
            department_id: importedDepartmentId ?? null,
            created_at: entry.created_at || entry.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            version: 1,
          })
        }

        // Create audit log
        await supabaseData.createAuditLog({
          operation: "IMPORT",
          entity_id: "batch",
          user_id: user.id,
          metadata: { count: importedEntries.length },
        })

        // Refresh entries
        await loadEntries()

        toast.success(`Imported ${importedEntries.length} entries`)
      } catch (error) {
        console.error("Import failed:", error)
        setError(error as Error)

        const message = error instanceof Error ? error.message : "Failed to import data"
        toast.error(message)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [user, loadEntries]
  )

  // Migrate from localStorage
  const migrateFromLocalStorage = useCallback(async () => {
    if (!user) {
      throw new Error("Authentication required")
    }

    setIsLoading(true)
    setError(null)

    try {
      // Load entries from localStorage
      const STORAGE_KEY = "captain-log-entries-v2"
      const stored = localStorage.getItem(STORAGE_KEY)

      if (!stored) {
        toast.info("No local entries found to migrate")
        return
      }

      const localEntries = JSON.parse(stored)

      if (!Array.isArray(localEntries) || localEntries.length === 0) {
        toast.info("No local entries found to migrate")
        return
      }

      // Show migration toast
      toast.loading(`Migrating ${localEntries.length} entries to Supabase...`, { duration: 0, id: "migration" })

      // Migrate entries
      const result = await supabaseData.migrateLocalStorageToSupabase(localEntries, user.id, (current, total) => {
        toast.loading(`Migrating entries: ${current}/${total}`, { duration: 0, id: "migration" })
      })

      // Create audit log
      await supabaseData.createAuditLog({
        operation: "MIGRATION",
        entity_id: "batch",
        user_id: user.id,
        metadata: {
          total: result.total,
          success: result.success,
          errors: result.errors,
        },
      })

      // Refresh entries
      await loadEntries()

      toast.dismiss("migration")

      if (result.errors === 0) {
        toast.success(`Successfully migrated ${result.success} entries`)
      } else {
        toast.warning(`Migrated ${result.success} entries, ${result.errors} failed`)
      }

      // Optional: rename the old localStorage key to avoid re-migration
      localStorage.setItem("captain-log-entries-v2-migrated", stored)
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error("Migration failed:", error)
      setError(error as Error)

      toast.dismiss("migration")
      const message = error instanceof Error ? error.message : "Failed to migrate data"
      toast.error(message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [user, loadEntries])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Refresh entries
  const refreshEntries = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      await loadEntries()
    } catch (error) {
      console.error("Failed to refresh entries:", error)
    } finally {
      setIsLoading(false)
    }
  }, [user, loadEntries])

  // Context value
  const contextValue: CaptainLogContextType = {
    entries,
    isLoading,
    error,
    auditLogs,
    addEntry,
    updateEntry,
    deleteEntry,
    getEntryByDate,
    getEntryById,
    batchDelete,
    searchEntries,
    getEntriesByDateRange,
    exportData,
    importData,
    migrateFromLocalStorage,
    clearError,
    refreshEntries,
  }

  return <SupabaseLogContext.Provider value={contextValue}>{children}</SupabaseLogContext.Provider>
}

// Custom hook
export function useSupabaseLog() {
  const context = useContext(SupabaseLogContext)

  if (context === undefined) {
    throw new Error("useSupabaseLog must be used within a SupabaseLogProvider")
  }

  return context
}

// Alias for backward compatibility with existing components
export const useCaptainLog = useSupabaseLog
