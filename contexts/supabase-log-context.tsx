"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useSupabaseAuth } from "./supabase-auth-context"
import { v4 as uuidv4 } from "uuid"
import * as supabaseData from "@/lib/supabase-data"
import type { CaptainLogEntry as DbCaptainLogEntry, AuditLog } from "@/lib/supabase-data"
import { canCreateEntryForDate, canUpdateEntryForDate } from "@/lib/date-restrictions"

// Re-export types for components
export type { AuditLog } from "@/lib/supabase-data"

// Enhanced entry type with camelCase properties for components
export type CaptainLogEntry = {
  // Core properties
  id: string
  user_id: string
  date: string
  department_id: string | null
  created_at: string
  updated_at: string
  version: number
  metadata: any | null

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
  customResponses: any[]
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

// Compatibility layer: Transform database entry + custom responses to component format
async function transformEntryForComponents(entry: DbCaptainLogEntry): Promise<CaptainLogEntry> {
  // Fetch custom responses for this entry
  let customResponsesData: any[] = []
  try {
    customResponsesData = await supabaseData.getCustomResponses(entry.id)
  } catch (error) {
    console.error(`Failed to load custom responses for entry ${entry.id}:`, error)
  }

  // Transform custom responses to expected format
  const customResponses = customResponsesData.map((response) => ({
    questionId: response.question_id,
    questionKey: response.question_key,
    questionLabel: response.question_label,
    questionType: response.question_type,
    questionCategory: response.question_category,
    value: response.value,
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
function transformEntryForDatabase(entry: any) {
  const dbEntry: any = { ...entry }

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
  addEntry: (entry: Omit<CaptainLogEntry, "id" | "user_id" | "created_at" | "updated_at" | "version">) => Promise<void>
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

  // State
  const [entries, setEntries] = useState<CaptainLogEntry[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  // Load entries from Supabase
  const loadEntries = useCallback(async () => {
    if (!user) {
      setEntries([])
      return
    }

    setIsLoading(true)
    try {
      const data = await supabaseData.getEntriesByUserId(user.id)
      // Transform entries for component compatibility
      const transformedEntries = await Promise.all(data.map(transformEntryForComponents))
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
      setIsInitialized(true)
    } else {
      setEntries([])
      setAuditLogs([])
      setIsInitialized(false)
      setIsLoading(false)
    }
  }, [user?.id, loadEntries, loadAuditLogs]) // Include callbacks to ensure stable dependency array

  // CRUD Operations

  // Add entry
  const addEntry = useCallback(
    async (entry: Omit<CaptainLogEntry, "id" | "user_id" | "created_at" | "updated_at" | "version">) => {
      if (!user) {
        throw new Error("Authentication required")
      }

      const dateValidation = canCreateEntryForDate(entry.date)
      if (!dateValidation.isValid) {
        throw new Error(dateValidation.error || "This date is locked for new reports")
      }

      if (!("department_id" in entry)) {
        throw new Error("department_id is required")
      }

      setIsLoading(true)
      setError(null)

      try {
        // Transform entry from camelCase to snake_case for database
        const dbEntry = transformEntryForDatabase(entry)

        // Check for duplicate by date
        const existingEntry = await supabaseData.getEntryByDate(user.id, entry.date, entry.department_id)
        if (existingEntry) {
          throw new Error(`Entry already exists for ${entry.date}`)
        }

        // Create the entry
        const now = new Date().toISOString()
        const newEntry = await supabaseData.createEntry({
          ...dbEntry,
          id: uuidv4(),
          user_id: user.id,
          date: entry.date,
          department_id: entry.department_id,
          created_at: now,
          updated_at: now,
          version: 1,
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

        // Create custom responses for standard fields
        for (const response of standardResponses) {
          if (response.value) {
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
        }

        // Save any additional custom responses
        if (entry.customResponses && Array.isArray(entry.customResponses)) {
          for (const response of entry.customResponses) {
            await supabaseData.createCustomResponse({
              entry_id: newEntry.id,
              question_id: response.questionId,
              question_key: response.questionKey,
              question_label: response.questionLabel,
              question_type: response.questionType,
              question_category: response.questionCategory || "custom",
              value: response.value,
              timestamp: response.timestamp || now,
            })
          }
        }

        // Create audit log
        await supabaseData.createAuditLog({
          operation: "CREATE",
          entity_id: newEntry.id,
          user_id: user.id,
          metadata: { date: newEntry.date },
        })

        // Transform back to camelCase for state
        const transformedEntry = await transformEntryForComponents(newEntry)
        setEntries((prev) => [...prev, transformedEntry])

        toast.success("Entry saved successfully")
      } catch (error) {
        console.error("Failed to add entry:", error)
        setError(error as Error)

        const message = error instanceof Error ? error.message : "Failed to create entry"
        toast.error(message)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [user]
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
        await supabaseData.deleteCustomResponses(id)

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

        const now = new Date().toISOString()

        // Create standard responses
        for (const response of standardResponses) {
          if (response.value) {
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
        }

        // Handle additional custom responses if provided
        if (updates.customResponses && Array.isArray(updates.customResponses)) {
          for (const response of updates.customResponses) {
            await supabaseData.createCustomResponse({
              entry_id: id,
              question_id: response.questionId,
              question_key: response.questionKey,
              question_label: response.questionLabel,
              question_type: response.questionType,
              question_category: response.questionCategory || "custom",
              value: response.value,
              timestamp: response.timestamp || now,
            })
          }
        }

        // Create audit log
        await supabaseData.createAuditLog({
          operation: "UPDATE",
          entity_id: id,
          user_id: user.id,
          changes: {
            from: Object.keys(updates).reduce(
              (acc, key) => {
                acc[key] = (existingEntry as any)[key]
                return acc
              },
              {} as Record<string, any>
            ),
            to: updates,
          },
        })

        // Transform back to camelCase for state
        const transformedEntry = await transformEntryForComponents(updatedEntry)
        setEntries((prev) => prev.map((e) => (e.id === id ? transformedEntry : e)))

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
    [entries, user]
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
    [entries, user]
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
        // Transform results for component compatibility
        return await Promise.all(results.map(transformEntryForComponents))
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
        // Transform results for component compatibility
        return await Promise.all(results.map(transformEntryForComponents))
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
              ? ((entry as any).department_id as string | null)
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
